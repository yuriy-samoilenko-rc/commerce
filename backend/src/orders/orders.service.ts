import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { LONG_TX } from '../common/transactions';
import {
  DeliveryMethod,
  DocumentType,
  OrderChannel,
  OrderEventType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
  SerialUnitStatus,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import {
  CheckoutDto,
  ManualOrderDto,
  OrderItemDto,
  OrderQueryDto,
} from './dto/order.dto';
import { DELIVERY_FEES, reservationTtlMs } from './order-settings';

/** Not yet being picked: the customer may still cancel, and the reservation may expire. */
export const EARLY = [OrderStatus.NEW, OrderStatus.CONFIRMED];
/** Goods have not left the warehouse yet. */
export const CANCELLABLE = [
  ...EARLY,
  OrderStatus.PICKING,
  OrderStatus.READY_TO_SHIP,
];
/** Payment can arrive at any point until the order is closed (e.g. cash to the courier). */
const PAYABLE = [...CANCELLABLE, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

const orderFields = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  channel: true,
  paymentMethod: true,
  deliveryMethod: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  deliveryAddress: true,
  comment: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  reservationExpiresAt: true,
  cancelReason: true,
  paidAt: true,
  carrier: true,
  trackingNumber: true,
  shippedAt: true,
  deliveredAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const itemFields = {
  id: true,
  productId: true,
  productName: true,
  sku: true,
  quantity: true,
  unitPrice: true,
  vatPercent: true,
  lineTotal: true,
} satisfies Prisma.OrderItemSelect;

// What the buyer sees: no warehouses, no staff names.
const customerSelect = {
  ...orderFields,
  items: {
    select: {
      ...itemFields,
      serialUnits: {
        where: { status: SerialUnitStatus.SOLD },
        select: { serialNumber: true },
      },
    },
    orderBy: { productName: 'asc' },
  },
  events: {
    select: { type: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
  documents: {
    select: {
      id: true,
      type: true,
      number: true,
      status: true,
      issuedAt: true,
    },
    orderBy: { issuedAt: 'asc' },
  },
} satisfies Prisma.OrderSelect;

const staffSelect = {
  ...orderFields,
  user: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    select: {
      ...itemFields,
      serialUnits: { select: { serialNumber: true, status: true } },
      reservations: {
        select: {
          quantity: true,
          pickedQuantity: true,
          createdAt: true,
          releasedAt: true,
          releaseReason: true,
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { productName: 'asc' },
  },
  events: {
    select: {
      type: true,
      note: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  documents: {
    select: {
      id: true,
      type: true,
      number: true,
      status: true,
      issuedAt: true,
    },
    orderBy: { issuedAt: 'asc' },
  },
} satisfies Prisma.OrderSelect;

interface PlaceOptions {
  channel: OrderChannel;
  userId: string | null;
  createdById: string | null;
  actorId: string;
  expires: boolean;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // ---------- placing ----------

  async placeOnline(dto: CheckoutDto, user: { id: string; email: string }) {
    const id = await this.place(
      { ...dto, customerEmail: dto.customerEmail ?? user.email },
      {
        channel: OrderChannel.ONLINE,
        userId: user.id,
        createdById: null,
        actorId: user.id,
        expires: true,
      },
    );
    return this.findForCustomer(id, user.id);
  }

  async placeManual(dto: ManualOrderDto, staffId: string) {
    const { userId, ...rest } = dto;
    if (userId) {
      const customer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (customer?.role !== Role.CUSTOMER)
        throw new BadRequestException('userId must be a customer account');
    }
    const id = await this.place(rest, {
      channel: OrderChannel.MANUAL,
      userId: userId ?? null,
      createdById: staffId,
      actorId: staffId,
      expires: false,
    });
    return this.findForStaff(id);
  }

  private async place(dto: CheckoutDto, opts: PlaceOptions) {
    const items = mergeItems(dto.items);
    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
          discountPrice: true,
          vatPercent: true,
          isArchived: true,
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const lines = items.map((item) => {
        const p = byId.get(item.productId);
        if (!p || p.isArchived)
          throw new BadRequestException(
            `Product ${item.productId} is not available`,
          );
        const unitPrice = p.discountPrice ?? p.sellingPrice;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          quantity: item.quantity,
          unitPrice,
          vatPercent: p.vatPercent,
          lineTotal: unitPrice.mul(item.quantity),
        };
      });
      const subtotal = lines.reduce(
        (sum, l) => sum.add(l.lineTotal),
        new Prisma.Decimal(0),
      );
      const deliveryFee = new Prisma.Decimal(DELIVERY_FEES[dto.deliveryMethod]);

      const order = await tx.order.create({
        data: {
          channel: opts.channel,
          userId: opts.userId,
          createdById: opts.createdById,
          paymentMethod: dto.paymentMethod,
          deliveryMethod: dto.deliveryMethod,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          customerEmail: dto.customerEmail ?? null,
          deliveryAddress:
            dto.deliveryMethod === DeliveryMethod.COURIER
              ? dto.deliveryAddress
              : null,
          comment: dto.comment ?? null,
          subtotal,
          deliveryFee,
          total: subtotal.add(deliveryFee),
          reservationExpiresAt: opts.expires
            ? new Date(Date.now() + reservationTtlMs(dto.paymentMethod))
            : null,
          items: { create: lines },
          events: {
            create: { type: OrderEventType.CREATED, userId: opts.actorId },
          },
        },
        select: {
          id: true,
          items: { select: { id: true, productId: true, quantity: true } },
        },
      });

      // Any line that cannot be covered aborts the whole order: no half-reserved orders.
      for (const item of order.items) {
        await this.ledger.reserve(tx, {
          orderItemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
        });
      }
      await this.notifications.orderEvent(tx, 'ORDER_NEW', order.id);
      await this.mail.orderEmail(tx, 'RECEIVED', order.id);
      return order.id;
    }, LONG_TX);
  }

  // ---------- lifecycle ----------

  async confirm(id: string, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.getOrThrow(tx, id);
      const { count } = await tx.order.updateMany({
        where: { id, status: OrderStatus.NEW },
        data: {
          status: OrderStatus.CONFIRMED,
          // A confirmed order waits for cash/transfer indefinitely; an online card order
          // still has to be paid before its timer runs out.
          ...(order.paymentMethod !== PaymentMethod.CARD_ONLINE && {
            reservationExpiresAt: null,
          }),
        },
      });
      if (!count) throw wrongState(order, 'confirmed');
      await tx.orderEvent.create({
        data: { orderId: id, type: OrderEventType.CONFIRMED, userId: staffId },
      });
      const invoiceId = await this.documents.issue(
        tx,
        DocumentType.INVOICE,
        id,
        staffId,
      );
      await this.mail.orderEmail(tx, 'CONFIRMED', id, [invoiceId]);
    });
    return this.findForStaff(id);
  }

  async markPaid(id: string, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: {
          id,
          status: { in: PAYABLE },
          paymentStatus: PaymentStatus.UNPAID,
        },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          reservationExpiresAt: null,
        },
      });
      if (!count)
        throw wrongState(await this.getOrThrow(tx, id), 'marked as paid');
      await tx.orderEvent.create({
        data: { orderId: id, type: OrderEventType.PAID, userId: staffId },
      });
      await this.notifications.orderEvent(tx, 'ORDER_PAID', id);
    });
    return this.findForStaff(id);
  }

  async cancelByStaff(id: string, staffId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.getOrThrow(tx, id);
      const note =
        order.paymentStatus === PaymentStatus.PAID
          ? `${reason} (plaćeno: potreban povraćaj novca)`
          : reason;
      await this.cancelIn(
        tx,
        id,
        { status: { in: CANCELLABLE } },
        note,
        OrderEventType.CANCELLED,
        staffId,
      );
    });
    return this.findForStaff(id);
  }

  async cancelByCustomer(id: string, userId: string, reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, userId },
        select: { status: true, paymentStatus: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException(
          'A paid order can only be cancelled by the store, which will issue a refund',
        );
      }
      if (
        order.status !== OrderStatus.NEW &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new ConflictException(
          'The order is already being prepared; please contact the store',
        );
      }
      await this.cancelIn(
        tx,
        id,
        { status: { in: EARLY }, userId, paymentStatus: PaymentStatus.UNPAID },
        reason?.trim() || 'Otkazao kupac',
        OrderEventType.CANCELLED,
        userId,
      );
    });
    return this.findForCustomer(id, userId);
  }

  /** Cancels unpaid/unconfirmed orders whose reservation timer ran out. Returns how many. */
  async expireDue(now = new Date()) {
    const due: Prisma.OrderWhereInput = {
      status: { in: EARLY },
      paymentStatus: PaymentStatus.UNPAID,
      reservationExpiresAt: { lte: now },
    };
    const orders = await this.prisma.order.findMany({
      where: due,
      select: { id: true },
      take: 100,
    });
    let expired = 0;
    for (const { id } of orders) {
      // Re-checked inside the transaction: the order may have been paid a moment ago.
      const done = await this.prisma.$transaction((tx) =>
        this.cancelIn(
          tx,
          id,
          due,
          'Rezervacija je istekla: narudžba nije plaćena ili potvrđena na vrijeme',
          OrderEventType.EXPIRED,
          null,
          false,
        ),
      );
      if (done) expired++;
    }
    return expired;
  }

  private async cancelIn(
    tx: Tx,
    id: string,
    condition: Prisma.OrderWhereInput,
    reason: string,
    event: OrderEventType,
    userId: string | null,
    throwIfNotMatched = true,
  ) {
    const { count } = await tx.order.updateMany({
      where: { ...condition, id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason,
        reservationExpiresAt: null,
      },
    });
    if (!count) {
      if (!throwIfNotMatched) return false;
      throw wrongState(await this.getOrThrow(tx, id), 'cancelled');
    }
    await this.ledger.releaseReservations(tx, id, reason);
    await this.documents.cancelOrderInvoices(tx, id, reason);
    await this.mail.orderEmail(tx, 'CANCELLED', id);
    await tx.orderEvent.create({
      data: { orderId: id, type: event, note: reason, userId },
    });
    return true;
  }

  // ---------- reading ----------

  async findForCustomer(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      select: customerSelect,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listForCustomer(userId: string, q: PaginationQueryDto) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: customerSelect,
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }

  async findForStaff(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: staffSelect,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listForStaff(q: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      status: q.status,
      paymentStatus: q.paymentStatus,
      channel: q.channel,
    };
    const search = q.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.OR = [
        { customerName: contains },
        { customerPhone: contains },
        { customerEmail: contains },
      ];
      if (/^\d{1,9}$/.test(search)) where.OR.push({ number: Number(search) });
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: { ...orderFields, _count: { select: { items: true } } },
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.order.count({ where }),
    ]);
    const items = rows.map(({ _count, ...o }) => ({
      ...o,
      itemCount: _count.items,
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  private async getOrThrow(tx: Tx, id: string) {
    const order = await tx.order.findUnique({
      where: { id },
      select: { status: true, paymentStatus: true, paymentMethod: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}

export function wrongState(
  order: { status: OrderStatus; paymentStatus: PaymentStatus },
  action: string,
) {
  return new ConflictException(
    `Order is ${order.status} / ${order.paymentStatus} and cannot be ${action}`,
  );
}

/** The same product twice in the cart becomes one line. */
function mergeItems(items: OrderItemDto[]) {
  const merged = new Map<string, number>();
  for (const i of items)
    merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}
