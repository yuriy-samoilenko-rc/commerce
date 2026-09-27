import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { badRequest, conflict } from '../common/errors';
import { LONG_TX, inSequence } from '../common/transactions';
import {
  DocumentType,
  Prisma,
  ReceivingStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanSerials, validateDocumentItems } from '../stock/document-items';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import {
  CreateReceivingDto,
  ReceivingItemDto,
} from './dto/create-receiving.dto';
import { ReceivingQueryDto } from './dto/receiving-query.dto';
import { UpdateReceivingDto } from './dto/update-receiving.dto';
import { formatReceivingNumber } from '../common/document-numbers';

const detailSelect = {
  id: true,
  number: true,
  status: true,
  supplierDocNumber: true,
  supplierDocDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  supplier: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      purchasePrice: true,
      serialNumbers: true,
      product: {
        select: { id: true, name: true, sku: true, trackSerial: true },
      },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ReceivingSelect;

type ReceivingRow = Prisma.ReceivingGetPayload<{ select: typeof detailSelect }>;

function present(r: ReceivingRow) {
  const totalAmount = r.items.reduce(
    (sum, i) => sum.add(i.purchasePrice.mul(i.quantity)),
    new Prisma.Decimal(0),
  );
  return {
    ...r,
    number: formatReceivingNumber(r.number),
    totalQuantity: r.items.reduce((sum, i) => sum + i.quantity, 0),
    totalAmount: totalAmount.toFixed(2),
  };
}

@Injectable()
export class ReceivingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: ReceivingQueryDto) {
    const where: Prisma.ReceivingWhereInput = {
      status: q.status,
      warehouseId: q.warehouseId,
      supplierId: q.supplierId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.receiving.findMany({
        where,
        select: detailSelect,
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.receiving.count({ where }),
    ]);
    const items = rows.map((r) => {
      const { items: lines, ...rest } = present(r);
      return { ...rest, itemCount: lines.length };
    });
    return { items, total, page: q.page, limit: q.limit };
  }

  async findOne(id: string) {
    const r = await this.prisma.receiving.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!r) throw new NotFoundException('Receiving not found');
    return present(r);
  }

  async create(dto: CreateReceivingDto, userId: string) {
    const { items, ...header } = dto;
    const created = await this.prisma.$transaction(async (tx) => {
      await this.validateHeader(tx, header.supplierId, header.warehouseId);
      await validateDocumentItems(tx, items, { allowArchived: false });
      return tx.receiving.create({
        data: {
          ...header,
          supplierDocDate: toDate(header.supplierDocDate),
          createdById: userId,
          items: { create: items.map(toItemData) },
        },
        select: { id: true },
      });
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateReceivingDto) {
    const { items, ...header } = dto;
    await this.prisma.$transaction(async (tx) => {
      // Updating the row first locks it until commit, so a concurrent confirm waits
      // for us and then sees the final item list (or we see its CONFIRMED status).
      const { count } = await tx.receiving.updateMany({
        where: { id, status: ReceivingStatus.DRAFT },
        data: {
          ...header,
          supplierDocDate: toDate(header.supplierDocDate),
          updatedAt: new Date(),
        },
      });
      if (!count) await this.throwNotDraft(tx, id);

      if (header.supplierId || header.warehouseId) {
        const current = await tx.receiving.findUniqueOrThrow({
          where: { id },
          select: { supplierId: true, warehouseId: true },
        });
        await this.validateHeader(tx, current.supplierId, current.warehouseId);
      }
      if (items) {
        await validateDocumentItems(tx, items, { allowArchived: false });
        await tx.receivingItem.deleteMany({ where: { receivingId: id } });
        await tx.receivingItem.createMany({
          data: items.map((i) => ({ ...toItemData(i), receivingId: id })),
        });
      }
    }, LONG_TX);
    return this.findOne(id);
  }

  async confirm(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Flip the status first: only one of two simultaneous confirms can match DRAFT,
      // so stock is never posted twice. Any error below rolls the status back too.
      const { count } = await tx.receiving.updateMany({
        where: { id, status: ReceivingStatus.DRAFT },
        data: {
          status: ReceivingStatus.CONFIRMED,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
      });
      if (!count) await this.throwNotDraft(tx, id);

      const receiving = await tx.receiving.findUniqueOrThrow({
        where: { id },
        select: { warehouseId: true, items: { orderBy: { id: 'asc' } } },
      });
      if (!receiving.items.length)
        throw badRequest('DOCUMENT_EMPTY', 'Receiving has no items');

      for (const item of receiving.items) {
        await this.ledger.move(tx, {
          type: StockMovementType.RECEIPT,
          productId: item.productId,
          warehouseId: receiving.warehouseId,
          quantity: item.quantity,
          serialNumbers: item.serialNumbers,
          userId,
          receivingId: id,
        });
      }
      await this.documents.issue(tx, DocumentType.RECEIVING_NOTE, id, userId);
      await this.notifications.receivingConfirmed(tx, id);
    }, LONG_TX);
    return this.findOne(id);
  }

  async cancel(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.receiving.updateMany({
        where: { id, status: ReceivingStatus.DRAFT },
        data: { status: ReceivingStatus.CANCELLED },
      });
      if (!count) await this.throwNotDraft(tx, id);
    });
    return this.findOne(id);
  }

  private async throwNotDraft(tx: Tx, id: string): Promise<never> {
    const r = await tx.receiving.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!r) throw new NotFoundException('Receiving not found');
    throw conflict(
      'NOT_DRAFT',
      `Receiving is ${r.status}; only drafts can be changed`,
      { status: r.status },
    );
  }

  private async validateHeader(
    tx: Tx,
    supplierId: string,
    warehouseId: string,
  ) {
    const [supplier, warehouse] = await inSequence(
      () =>
        tx.supplier.findUnique({
          where: { id: supplierId },
          select: { isActive: true },
        }),
      () =>
        tx.warehouse.findUnique({
          where: { id: warehouseId },
          select: { isActive: true },
        }),
    );
    if (!supplier) throw new BadRequestException('Supplier not found');
    if (!supplier.isActive)
      throw new BadRequestException('Supplier is inactive');
    if (!warehouse) throw new BadRequestException('Warehouse not found');
    if (!warehouse.isActive)
      throw badRequest('WAREHOUSE_INACTIVE', 'Warehouse is inactive');
  }
}

// undefined = leave unchanged, null = clear
function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

function toItemData(i: ReceivingItemDto) {
  return {
    productId: i.productId,
    quantity: i.quantity,
    purchasePrice: i.purchasePrice,
    serialNumbers: cleanSerials(i.serialNumbers),
  };
}
