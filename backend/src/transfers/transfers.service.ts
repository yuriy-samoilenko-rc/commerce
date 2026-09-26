import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { formatTransferNumber } from '../common/document-numbers';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { LONG_TX } from '../common/transactions';
import {
  DocumentType,
  Prisma,
  StockMovementType,
  TransferStatus,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanSerials, validateDocumentItems } from '../stock/document-items';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import { CreateTransferDto, TransferItemDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';
import { UpdateTransferDto } from './dto/update-transfer.dto';

const person = { select: { id: true, name: true } };
const place = { select: { id: true, name: true } };

const detailSelect = {
  id: true,
  number: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  receivedAt: true,
  fromWarehouse: place,
  toWarehouse: place,
  createdBy: person,
  sentBy: person,
  receivedBy: person,
  items: {
    select: {
      id: true,
      quantity: true,
      serialNumbers: true,
      product: {
        select: { id: true, name: true, sku: true, trackSerial: true },
      },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.TransferSelect;

type TransferRow = Prisma.TransferGetPayload<{ select: typeof detailSelect }>;

const present = (t: TransferRow) => ({
  ...t,
  number: formatTransferNumber(t.number),
  totalQuantity: t.items.reduce((sum, i) => sum + i.quantity, 0),
});

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
  ) {}

  async list(q: TransferQueryDto) {
    const where: Prisma.TransferWhereInput = {
      status: q.status,
      fromWarehouseId: q.fromWarehouseId,
      toWarehouseId: q.toWarehouseId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        select: detailSelect,
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.transfer.count({ where }),
    ]);
    const items = rows.map((r) => {
      const { items: lines, ...rest } = present(r);
      return { ...rest, itemCount: lines.length };
    });
    return { items, total, page: q.page, limit: q.limit };
  }

  async findOne(id: string) {
    const t = await this.prisma.transfer.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!t) throw new NotFoundException('Transfer not found');
    return present(t);
  }

  async create(dto: CreateTransferDto, userId: string) {
    const { items, ...header } = dto;
    const created = await this.prisma.$transaction(async (tx) => {
      await this.validateRoute(
        tx,
        header.fromWarehouseId,
        header.toWarehouseId,
      );
      await validateDocumentItems(tx, items, { allowArchived: true });
      return tx.transfer.create({
        data: {
          ...header,
          createdById: userId,
          items: { create: items.map(toItemData) },
        },
        select: { id: true },
      });
    });
    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateTransferDto) {
    const { items, ...header } = dto;
    await this.prisma.$transaction(async (tx) => {
      // Locks the draft row; a concurrent send waits and then sees the final items.
      const { count } = await tx.transfer.updateMany({
        where: { id, status: TransferStatus.DRAFT },
        data: { ...header, updatedAt: new Date() },
      });
      if (!count) await this.throwWrongStatus(tx, id, 'edited');

      if (header.fromWarehouseId || header.toWarehouseId) {
        const t = await tx.transfer.findUniqueOrThrow({
          where: { id },
          select: { fromWarehouseId: true, toWarehouseId: true },
        });
        await this.validateRoute(tx, t.fromWarehouseId, t.toWarehouseId);
      }
      if (items) {
        await validateDocumentItems(tx, items, { allowArchived: true });
        await tx.transferItem.deleteMany({ where: { transferId: id } });
        await tx.transferItem.createMany({
          data: items.map((i) => ({ ...toItemData(i), transferId: id })),
        });
      }
    }, LONG_TX);
    return this.findOne(id);
  }

  /** Takes goods off the source warehouse; from now on they are "in transit". */
  async send(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transfer.updateMany({
        where: { id, status: TransferStatus.DRAFT },
        data: {
          status: TransferStatus.IN_TRANSIT,
          sentById: userId,
          sentAt: new Date(),
        },
      });
      if (!count) await this.throwWrongStatus(tx, id, 'sent');

      const t = await tx.transfer.findUniqueOrThrow({
        where: { id },
        select: {
          fromWarehouseId: true,
          toWarehouse: { select: { isActive: true } },
          items: { orderBy: { id: 'asc' } },
        },
      });
      if (!t.items.length)
        throw new BadRequestException('Transfer has no items');
      if (!t.toWarehouse.isActive)
        throw new BadRequestException('Destination warehouse is inactive');

      for (const item of t.items) {
        await this.ledger.move(tx, {
          type: StockMovementType.TRANSFER_OUT,
          productId: item.productId,
          warehouseId: t.fromWarehouseId,
          quantity: -item.quantity,
          serialNumbers: item.serialNumbers,
          userId,
          transferId: id,
        });
      }
      await this.documents.issue(tx, DocumentType.TRANSFER_NOTE, id, userId);
    }, LONG_TX);
    return this.findOne(id);
  }

  /** The destination warehouse confirms arrival; goods join its stock. */
  async receive(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transfer.updateMany({
        where: { id, status: TransferStatus.IN_TRANSIT },
        data: {
          status: TransferStatus.RECEIVED,
          receivedById: userId,
          receivedAt: new Date(),
        },
      });
      if (!count) await this.throwWrongStatus(tx, id, 'received');

      const t = await tx.transfer.findUniqueOrThrow({
        where: { id },
        select: { toWarehouseId: true, items: { orderBy: { id: 'asc' } } },
      });
      for (const item of t.items) {
        await this.ledger.move(tx, {
          type: StockMovementType.TRANSFER_IN,
          productId: item.productId,
          warehouseId: t.toWarehouseId,
          quantity: item.quantity,
          serialNumbers: item.serialNumbers,
          userId,
          transferId: id,
        });
      }
    }, LONG_TX);
    return this.findOne(id);
  }

  async cancel(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transfer.updateMany({
        where: { id, status: TransferStatus.DRAFT },
        data: { status: TransferStatus.CANCELLED },
      });
      if (!count) await this.throwWrongStatus(tx, id, 'cancelled');
    });
    return this.findOne(id);
  }

  private async throwWrongStatus(
    tx: Tx,
    id: string,
    action: string,
  ): Promise<never> {
    const t = await tx.transfer.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    throw new ConflictException(
      `Transfer is ${t.status} and cannot be ${action}`,
    );
  }

  private async validateRoute(tx: Tx, fromId: string, toId: string) {
    if (fromId === toId)
      throw new BadRequestException('Source and destination must differ');
    const warehouses = await tx.warehouse.findMany({
      where: { id: { in: [fromId, toId] } },
      select: { id: true, isActive: true },
    });
    const from = warehouses.find((w) => w.id === fromId);
    const to = warehouses.find((w) => w.id === toId);
    if (!from) throw new BadRequestException('Source warehouse not found');
    if (!to) throw new BadRequestException('Destination warehouse not found');
    if (!to.isActive)
      throw new BadRequestException('Destination warehouse is inactive');
  }
}

function toItemData(i: TransferItemDto) {
  return {
    productId: i.productId,
    quantity: i.quantity,
    serialNumbers: cleanSerials(i.serialNumbers),
  };
}
