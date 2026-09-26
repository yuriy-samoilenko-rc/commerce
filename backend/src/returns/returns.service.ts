import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatReturnNumber } from '../common/document-numbers';
import {
  pageArgs,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { LONG_TX } from '../common/transactions';
import {
  DocumentType,
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReturnDecision,
  ReturnReason,
  ReturnStatus,
  SerialUnitStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanSerials } from '../stock/document-items';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import {
  CreateReturnDto,
  DecideReturnDto,
  RefundDto,
  ReturnLineDto,
  ReturnQueryDto,
} from './dto/return.dto';

const RETURNABLE_ORDER: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.PARTIALLY_RETURNED,
];
/** Returns that still claim their units (not cancelled, not rejected as a whole). */
const ACTIVE_RETURN: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.RECEIVED,
  ReturnStatus.APPROVED,
  ReturnStatus.REFUNDED,
];
const NOT_REJECTED: Prisma.ReturnItemWhereInput = {
  OR: [{ decision: null }, { decision: { not: ReturnDecision.REJECT } }],
};

const returnWindowDays = () => {
  const days = Number(process.env.RETURN_WINDOW_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 14;
};

const itemSelect = {
  id: true,
  quantity: true,
  serialNumbers: true,
  reason: true,
  reasonNote: true,
  decision: true,
  inspectionNote: true,
  orderItem: {
    select: { id: true, productName: true, sku: true, unitPrice: true },
  },
} satisfies Prisma.ReturnItemSelect;

const baseSelect = {
  id: true,
  number: true,
  status: true,
  note: true,
  refundAmount: true,
  createdAt: true,
  receivedAt: true,
  decidedAt: true,
  refundedAt: true,
  order: { select: { id: true, number: true } },
  items: { select: itemSelect, orderBy: { id: 'asc' } },
} satisfies Prisma.ReturnSelect;

const person = { select: { id: true, name: true } };
const staffSelect = {
  ...baseSelect,
  refundReference: true,
  warehouse: { select: { id: true, name: true } },
  createdBy: person,
  receivedBy: person,
  decidedBy: person,
  refundedBy: person,
  order: {
    select: {
      id: true,
      number: true,
      customerName: true,
      customerPhone: true,
      paymentStatus: true,
    },
  },
} satisfies Prisma.ReturnSelect;

type Actor = { id: string; customer: boolean };

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
  ) {}

  async create(orderId: string, dto: CreateReturnDto, actor: Actor) {
    const id = await this.prisma.$transaction(async (tx) => {
      // Locking the order serializes two return requests for the same goods.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, ...(actor.customer && { userId: actor.id }) },
        data: { updatedAt: new Date() },
      });
      if (!count) throw new NotFoundException('Order not found');
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { status: true, deliveredAt: true },
      });
      if (!RETURNABLE_ORDER.includes(order.status)) {
        throw new ConflictException(
          `Order is ${order.status}; only delivered orders can be returned`,
        );
      }
      const productOf = await this.validateLines(
        tx,
        orderId,
        order.deliveredAt,
        dto.items,
      );

      const created = await tx.return.create({
        data: {
          orderId,
          note: dto.note ?? null,
          createdById: actor.id,
          items: {
            create: dto.items.map((l) => ({
              orderItemId: l.orderItemId,
              productId: productOf.get(l.orderItemId)!,
              quantity: l.quantity,
              serialNumbers: cleanSerials(l.serialNumbers),
              reason: l.reason,
              reasonNote: l.reasonNote ?? null,
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });
    return actor.customer
      ? this.findForCustomer(id, actor.id)
      : this.findForStaff(id);
  }

  /** Goods physically arrived. Serial units wait for inspection; nothing is on sale yet. */
  async receive(id: string, warehouseId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { isActive: true },
      });
      if (!warehouse?.isActive)
        throw new BadRequestException('Warehouse not found or inactive');
      await this.transition(
        tx,
        id,
        [ReturnStatus.REQUESTED],
        {
          status: ReturnStatus.RECEIVED,
          warehouseId,
          receivedById: userId,
          receivedAt: new Date(),
        },
        'received',
      );

      for (const item of await this.lines(tx, id)) {
        if (!item.serialNumbers.length) continue;
        const { count } = await tx.serialUnit.updateMany({
          where: {
            serialNumber: { in: item.serialNumbers },
            orderItemId: item.orderItemId,
            status: SerialUnitStatus.SOLD,
          },
          data: { status: SerialUnitStatus.RETURNED, warehouseId },
        });
        if (count !== item.serialNumbers.length) {
          throw new ConflictException(
            'Some returned units are no longer in the SOLD state, check the serial numbers',
          );
        }
      }
    });
    return this.findForStaff(id);
  }

  /** Inspection results; can be revised until the return is approved. */
  async decide(id: string, dto: DecideReturnDto) {
    await this.prisma.$transaction(async (tx) => {
      await this.transition(
        tx,
        id,
        [ReturnStatus.RECEIVED],
        { updatedAt: new Date() },
        'inspected',
      );
      for (const d of dto.items) {
        const { count } = await tx.returnItem.updateMany({
          where: { id: d.itemId, returnId: id },
          data: { decision: d.decision, inspectionNote: d.note ?? null },
        });
        if (!count)
          throw new BadRequestException(
            `Line ${d.itemId} is not part of this return`,
          );
      }
    });
    return this.findForStaff(id);
  }

  /** Applies every decision: restock through the ledger, scrap, or hand back. */
  async approve(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({
        where: { id },
        select: {
          status: true,
          number: true,
          orderId: true,
          warehouseId: true,
        },
      });
      if (!ret) throw new NotFoundException('Return not found');
      const lines = await this.lines(tx, id);
      if (
        ret.status === ReturnStatus.RECEIVED &&
        lines.some((l) => !l.decision)
      ) {
        throw new ConflictException('Decide every line before approving');
      }
      const accepted = lines.filter(
        (l) => l.decision !== ReturnDecision.REJECT,
      );
      const refundAmount = accepted.reduce(
        (sum, l) => sum.add(l.orderItem.unitPrice.mul(l.quantity)),
        new Prisma.Decimal(0),
      );
      await this.transition(
        tx,
        id,
        [ReturnStatus.RECEIVED],
        {
          status: accepted.length
            ? ReturnStatus.APPROVED
            : ReturnStatus.REJECTED,
          refundAmount: accepted.length ? refundAmount : null,
          decidedById: userId,
          decidedAt: new Date(),
        },
        'approved',
      );

      for (const line of lines) {
        const units = {
          serialNumber: { in: line.serialNumbers },
          orderItemId: line.orderItemId,
          status: SerialUnitStatus.RETURNED,
        };
        if (line.decision === ReturnDecision.RESTOCK) {
          await this.ledger.move(tx, {
            type: StockMovementType.RETURN,
            productId: line.productId,
            warehouseId: ret.warehouseId!,
            quantity: line.quantity,
            serialNumbers: line.serialNumbers,
            reason:
              line.inspectionNote ?? `Return ${formatReturnNumber(ret.number)}`,
            userId,
            returnId: id,
          });
        } else if (line.serialNumbers.length) {
          // Scrapped units never re-enter stock; rejected ones go back to the customer.
          await tx.serialUnit.updateMany({
            where: units,
            data:
              line.decision === ReturnDecision.SCRAP
                ? { status: SerialUnitStatus.WRITTEN_OFF, warehouseId: null }
                : { status: SerialUnitStatus.SOLD, warehouseId: null },
          });
        }
      }

      if (accepted.length) {
        await this.updateOrderStatus(
          tx,
          ret.orderId,
          formatReturnNumber(ret.number),
          userId,
        );
        await this.documents.issue(tx, DocumentType.RETURN_NOTE, id, userId);
      }
    }, LONG_TX);
    return this.findForStaff(id);
  }

  async refund(id: string, dto: RefundDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const ret = await tx.return.findUnique({
        where: { id },
        select: { order: { select: { paymentStatus: true } } },
      });
      if (!ret) throw new NotFoundException('Return not found');
      if (ret.order.paymentStatus !== PaymentStatus.PAID) {
        throw new ConflictException(
          'The order was never paid, there is nothing to refund',
        );
      }
      await this.transition(
        tx,
        id,
        [ReturnStatus.APPROVED],
        {
          status: ReturnStatus.REFUNDED,
          refundReference: dto.reference ?? null,
          refundedById: userId,
          refundedAt: new Date(),
        },
        'refunded',
      );
    });
    return this.findForStaff(id);
  }

  /** Only while the goods have not arrived yet. */
  async cancel(id: string, actor: Actor) {
    await this.prisma.$transaction(async (tx) => {
      if (actor.customer) {
        const own = await tx.return.findFirst({
          where: { id, order: { userId: actor.id } },
          select: { id: true },
        });
        if (!own) throw new NotFoundException('Return not found');
      }
      await this.transition(
        tx,
        id,
        [ReturnStatus.REQUESTED],
        { status: ReturnStatus.CANCELLED },
        'cancelled',
      );
    });
    return actor.customer
      ? this.findForCustomer(id, actor.id)
      : this.findForStaff(id);
  }

  // ---------- reading ----------

  async findForStaff(id: string) {
    const r = await this.prisma.return.findUnique({
      where: { id },
      select: staffSelect,
    });
    if (!r) throw new NotFoundException('Return not found');
    return { ...r, number: formatReturnNumber(r.number) };
  }

  async findForCustomer(id: string, userId: string) {
    const r = await this.prisma.return.findFirst({
      where: { id, order: { userId } },
      select: baseSelect,
    });
    if (!r) throw new NotFoundException('Return not found');
    return { ...r, number: formatReturnNumber(r.number) };
  }

  async listForStaff(q: ReturnQueryDto) {
    return this.list({ status: q.status, orderId: q.orderId }, q, staffSelect);
  }

  async listForCustomer(userId: string, q: PaginationQueryDto) {
    return this.list({ order: { userId } }, q, baseSelect);
  }

  private async list(
    where: Prisma.ReturnWhereInput,
    q: PaginationQueryDto,
    select: typeof baseSelect,
  ) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        select,
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.return.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ ...r, number: formatReturnNumber(r.number) })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  // ---------- helpers ----------

  /** Checks what may still be returned; returns orderItemId → productId. */
  private async validateLines(
    tx: Tx,
    orderId: string,
    deliveredAt: Date | null,
    lines: ReturnLineDto[],
  ) {
    const ids = lines.map((l) => l.orderItemId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Each order line may appear only once');

    const orderItems = await tx.orderItem.findMany({
      where: { id: { in: ids }, orderId },
      select: {
        id: true,
        productId: true,
        quantity: true,
        productName: true,
        product: { select: { trackSerial: true } },
      },
    });
    const claimed = await tx.returnItem.findMany({
      where: {
        orderItemId: { in: ids },
        return: { status: { in: ACTIVE_RETURN } },
        ...NOT_REJECTED,
      },
      select: { orderItemId: true, quantity: true, serialNumbers: true },
    });

    for (const line of lines) {
      const oi = orderItems.find((i) => i.id === line.orderItemId);
      if (!oi)
        throw new BadRequestException(
          `Line ${line.orderItemId} is not part of this order`,
        );

      const already = claimed.filter((c) => c.orderItemId === oi.id);
      const left = oi.quantity - already.reduce((s, c) => s + c.quantity, 0);
      if (line.quantity > left) {
        throw new ConflictException(
          `Only ${left} of "${oi.productName}" can still be returned`,
        );
      }

      if (line.reason === ReturnReason.CHANGED_MIND) {
        const days = returnWindowDays();
        if (
          !deliveredAt ||
          Date.now() - deliveredAt.getTime() > days * 86_400_000
        ) {
          throw new ConflictException(
            `The ${days}-day return period for "${oi.productName}" has passed; defects are handled under warranty`,
          );
        }
      }

      const serials = cleanSerials(line.serialNumbers);
      if (!oi.product.trackSerial) {
        if (serials.length)
          throw new BadRequestException(
            `"${oi.productName}" is not tracked by serial number`,
          );
        continue;
      }
      if (
        serials.length !== line.quantity ||
        new Set(serials).size !== serials.length
      ) {
        throw new BadRequestException(
          `"${oi.productName}": list exactly ${line.quantity} distinct serial numbers`,
        );
      }
      const inReturn = new Set(already.flatMap((c) => c.serialNumbers));
      const sold = await tx.serialUnit.findMany({
        where: {
          serialNumber: { in: serials },
          orderItemId: oi.id,
          status: SerialUnitStatus.SOLD,
        },
        select: { serialNumber: true },
      });
      const bad = serials.filter(
        (sn) => inReturn.has(sn) || !sold.some((u) => u.serialNumber === sn),
      );
      if (bad.length) {
        throw new BadRequestException(
          `Not sold in this order line or already being returned: ${bad.join(', ')}`,
        );
      }
    }
    return new Map(orderItems.map((i) => [i.id, i.productId]));
  }

  private async updateOrderStatus(
    tx: Tx,
    orderId: string,
    returnNumber: string,
    userId: string,
  ) {
    const [ordered, returned] = await Promise.all([
      tx.orderItem.aggregate({ where: { orderId }, _sum: { quantity: true } }),
      tx.returnItem.aggregate({
        where: {
          return: {
            orderId,
            status: { in: [ReturnStatus.APPROVED, ReturnStatus.REFUNDED] },
          },
          decision: { not: ReturnDecision.REJECT },
        },
        _sum: { quantity: true },
      }),
    ]);
    const all = (returned._sum.quantity ?? 0) >= (ordered._sum.quantity ?? 0);
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: all ? OrderStatus.RETURNED : OrderStatus.PARTIALLY_RETURNED,
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        type: OrderEventType.RETURN_APPROVED,
        note: returnNumber,
        userId,
      },
    });
  }

  private lines(tx: Tx, returnId: string) {
    return tx.returnItem.findMany({
      where: { returnId },
      select: {
        id: true,
        orderItemId: true,
        productId: true,
        quantity: true,
        serialNumbers: true,
        decision: true,
        inspectionNote: true,
        orderItem: { select: { unitPrice: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  private async transition(
    tx: Tx,
    id: string,
    from: ReturnStatus[],
    data: Prisma.ReturnUncheckedUpdateManyInput,
    action: string,
  ) {
    const { count } = await tx.return.updateMany({
      where: { id, status: { in: from } },
      data,
    });
    if (count) return;
    const r = await tx.return.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!r) throw new NotFoundException('Return not found');
    throw new ConflictException(
      `Return is ${r.status} and cannot be ${action}`,
    );
  }
}
