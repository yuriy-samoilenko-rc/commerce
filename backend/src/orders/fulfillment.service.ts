import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { conflict } from '../common/errors';
import { LONG_TX } from '../common/transactions';
import {
  DeliveryMethod,
  DocumentType,
  OrderEventType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SerialUnitStatus,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import { PickDto, ShipDto } from './dto/fulfillment.dto';
import { OrdersService, wrongState } from './orders.service';

/** Warehouse side of an order: picking (сборка, ТЗ UI п.14) and handover (п.15). */
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly orders: OrdersService,
  ) {}

  async startPicking(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.get(tx, id);
      if (order.status !== OrderStatus.CONFIRMED)
        throw wrongState(order, 'picked');
      // Only cash-on-delivery may be prepared before the money arrives.
      if (
        order.paymentStatus === PaymentStatus.UNPAID &&
        order.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY
      ) {
        throw conflict(
          'ORDER_NOT_PAID',
          'The order must be paid before picking',
        );
      }
      await this.transition(
        tx,
        id,
        OrderStatus.CONFIRMED,
        { status: OrderStatus.PICKING },
        'picked',
      );
      await this.event(tx, id, OrderEventType.PICKING_STARTED, userId);
      await this.notifications.orderEvent(tx, 'ORDER_TO_PICK', id);
    });
    return this.orders.findForStaff(id);
  }

  async pick(id: string, dto: PickDto) {
    await this.scan(id, dto, +1);
    return this.pickSheet(id, dto.warehouseId);
  }

  /** Undo a wrong scan. */
  async unpick(id: string, dto: PickDto) {
    await this.scan(id, dto, -1);
    return this.pickSheet(id, dto.warehouseId);
  }

  private async scan(id: string, dto: PickDto, direction: 1 | -1) {
    const code = dto.code.trim();
    const qty = dto.quantity ?? 1;
    await this.prisma.$transaction(async (tx) => {
      // Touching the order row serializes scans and keeps them from racing "complete picking".
      await this.transition(
        tx,
        id,
        OrderStatus.PICKING,
        { updatedAt: new Date() },
        'picked',
      );

      const unit = await tx.serialUnit.findUnique({
        where: { serialNumber: code },
        select: { productId: true },
      });
      const productId =
        unit?.productId ??
        (
          await tx.product.findFirst({
            where: { OR: [{ barcode: code }, { sku: code }] },
            select: { id: true },
          })
        )?.id;
      if (!productId) throw new NotFoundException(`Unknown code "${code}"`);

      const res = await tx.stockReservation.findFirst({
        where: {
          orderItem: { orderId: id, productId },
          warehouseId: dto.warehouseId,
          releasedAt: null,
        },
        select: {
          id: true,
          quantity: true,
          pickedQuantity: true,
          orderItemId: true,
          product: { select: { name: true, trackSerial: true } },
        },
      });
      if (!res) {
        throw new BadRequestException(
          'This product is not to be picked from this warehouse for this order',
        );
      }
      const { name, trackSerial } = res.product;
      if (trackSerial && !unit) {
        throw new BadRequestException(
          `"${name}" is picked by serial number: scan the serial, not the barcode`,
        );
      }
      if (trackSerial && qty !== 1)
        throw new BadRequestException(
          'A serial number is always exactly one unit',
        );

      // The bound in WHERE keeps picked within 0..quantity even with parallel scans.
      const { count } = await tx.stockReservation.updateMany({
        where:
          direction > 0
            ? { id: res.id, pickedQuantity: { lte: res.quantity - qty } }
            : { id: res.id, pickedQuantity: { gte: qty } },
        data: { pickedQuantity: { increment: direction * qty } },
      });
      if (!count) {
        throw new ConflictException(
          direction > 0
            ? `"${name}": only ${res.quantity - res.pickedQuantity} left to pick`
            : `"${name}": only ${res.pickedQuantity} picked`,
        );
      }

      if (trackSerial) {
        if (direction > 0) {
          await this.ledger.linkUnit(tx, {
            serialNumber: code,
            productId,
            warehouseId: dto.warehouseId,
            orderItemId: res.orderItemId,
          });
        } else {
          await this.ledger.unlinkUnit(tx, code, res.orderItemId);
        }
      }
    });
  }

  async completePicking(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.transition(
        tx,
        id,
        OrderStatus.PICKING,
        { status: OrderStatus.READY_TO_SHIP },
        'marked as picked',
      );
      const unfinished = await tx.stockReservation.findMany({
        where: {
          orderItem: { orderId: id },
          releasedAt: null,
          pickedQuantity: { lt: tx.stockReservation.fields.quantity },
        },
        select: {
          quantity: true,
          pickedQuantity: true,
          product: { select: { name: true } },
        },
      });
      if (unfinished.length) {
        const list = unfinished
          .map((r) => `"${r.product.name}" ${r.pickedQuantity}/${r.quantity}`)
          .join(', ');
        throw new ConflictException(`Not everything is picked: ${list}`);
      }
      await this.event(tx, id, OrderEventType.PICKING_COMPLETED, userId);
      await this.notifications.orderEvent(tx, 'ORDER_READY_TO_SHIP', id);
    });
    return this.orders.findForStaff(id);
  }

  /**
   * Handover to the courier, or to the customer at pickup. This is when stock is
   * written off (SALE) and the warranty of serial units starts.
   */
  async ship(id: string, dto: ShipDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.get(tx, id);
      if (order.status !== OrderStatus.READY_TO_SHIP)
        throw wrongState(order, 'shipped');
      const pickup = order.deliveryMethod === DeliveryMethod.PICKUP;
      if (pickup && order.paymentStatus === PaymentStatus.UNPAID) {
        throw conflict(
          'ORDER_NOT_PAID',
          'Take the payment before handing the order to the customer',
        );
      }

      const now = new Date();
      await this.transition(
        tx,
        id,
        OrderStatus.READY_TO_SHIP,
        {
          status: pickup ? OrderStatus.DELIVERED : OrderStatus.SHIPPED,
          carrier: dto.carrier ?? null,
          trackingNumber: dto.trackingNumber ?? null,
          shippedAt: now,
          deliveredAt: pickup ? now : null,
        },
        'shipped',
      );
      await this.ledger.shipOrder(tx, id, userId, now);
      // Freeze the cost of what was sold: later purchase price changes must not rewrite past profit.
      await tx.$executeRaw`
        UPDATE "order_items" oi SET "unitCost" = p."purchasePrice"
        FROM "products" p
        WHERE p."id" = oi."productId" AND oi."orderId" = ${id}`;
      const deliveryNote = await this.documents.issue(
        tx,
        DocumentType.DELIVERY_NOTE,
        id,
        userId,
      );
      const warrantyCard = await this.documents.issue(
        tx,
        DocumentType.WARRANTY_CARD,
        id,
        userId,
      );
      await this.mail.orderEmail(tx, 'SHIPPED', id, [
        deliveryNote,
        warrantyCard,
      ]);

      const note =
        [dto.carrier, dto.trackingNumber].filter(Boolean).join(' ') || null;
      await this.event(tx, id, OrderEventType.SHIPPED, userId, note);
      if (pickup)
        await this.event(
          tx,
          id,
          OrderEventType.DELIVERED,
          userId,
          'Preuzeto u prodavnici',
        );
    }, LONG_TX);
    return this.orders.findForStaff(id);
  }

  async deliver(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.transition(
        tx,
        id,
        OrderStatus.SHIPPED,
        { status: OrderStatus.DELIVERED, deliveredAt: new Date() },
        'delivered',
      );
      await this.event(tx, id, OrderEventType.DELIVERED, userId);
    });
    return this.orders.findForStaff(id);
  }

  async complete(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.get(tx, id);
      if (
        order.status === OrderStatus.DELIVERED &&
        order.paymentStatus === PaymentStatus.UNPAID
      ) {
        throw conflict('ORDER_NOT_PAID', 'The order is not paid yet');
      }
      const { count } = await tx.order.updateMany({
        where: {
          id,
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
        },
        data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
      });
      if (!count) throw wrongState(await this.get(tx, id), 'completed');
      await this.event(tx, id, OrderEventType.COMPLETED, userId);
    });
    return this.orders.findForStaff(id);
  }

  /** What to pick, where, and what is already in the basket (mobile picking screen). */
  async pickSheet(id: string, warehouseId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        customerName: true,
        deliveryMethod: true,
        comment: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const [reservations, units] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where: { orderItem: { orderId: id }, releasedAt: null, warehouseId },
        select: {
          quantity: true,
          pickedQuantity: true,
          orderItemId: true,
          warehouse: { select: { id: true, name: true } },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              trackSerial: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.serialUnit.findMany({
        where: {
          orderItem: { orderId: id },
          status: SerialUnitStatus.IN_STOCK,
        },
        select: { serialNumber: true, orderItemId: true, warehouseId: true },
      }),
    ]);

    const lines = reservations.map((r) => ({
      product: r.product,
      warehouse: r.warehouse,
      quantity: r.quantity,
      picked: r.pickedQuantity,
      remaining: r.quantity - r.pickedQuantity,
      ...(r.product.trackSerial && {
        serialNumbers: units
          .filter(
            (u) =>
              u.orderItemId === r.orderItemId &&
              u.warehouseId === r.warehouse.id,
          )
          .map((u) => u.serialNumber),
      }),
    }));
    return { order, complete: lines.every((l) => l.remaining === 0), lines };
  }

  /** Orders waiting to be picked, optionally only those with goods in one warehouse. */
  async pickingTasks(warehouseId?: string) {
    const active = { releasedAt: null, ...(warehouseId && { warehouseId }) };
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PICKING,
        items: { some: { reservations: { some: active } } },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        deliveryMethod: true,
        createdAt: true,
        items: {
          select: {
            reservations: {
              where: active,
              select: { quantity: true, pickedQuantity: true },
            },
          },
        },
      },
      orderBy: { number: 'asc' },
    });
    return orders.map(({ items, ...o }) => {
      const res = items.flatMap((i) => i.reservations);
      return {
        ...o,
        units: res.reduce((s, r) => s + r.quantity, 0),
        picked: res.reduce((s, r) => s + r.pickedQuantity, 0),
      };
    });
  }

  private async get(tx: Tx, id: string) {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        deliveryMethod: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async transition(
    tx: Tx,
    id: string,
    from: OrderStatus,
    data: Parameters<Tx['order']['updateMany']>[0]['data'],
    action: string,
  ) {
    const { count } = await tx.order.updateMany({
      where: { id, status: from },
      data,
    });
    if (!count) throw wrongState(await this.get(tx, id), action);
  }

  private event(
    tx: Tx,
    orderId: string,
    type: OrderEventType,
    userId: string,
    note: string | null = null,
  ) {
    return tx.orderEvent.create({ data: { orderId, type, userId, note } });
  }
}
