import { Injectable, NotFoundException } from '@nestjs/common';
import { formatReceivingNumber, formatTransferNumber } from '../common/document-numbers';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { Prisma, StockMovementType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto, StockQueryDto } from './dto/stock-query.dto';
import { StockLedgerService } from './stock-ledger.service';

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  balanceAfter: true,
  reason: true,
  createdAt: true,
  product: { select: { id: true, name: true, sku: true } },
  warehouse: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  serialUnit: { select: { serialNumber: true } },
  receiving: { select: { id: true, number: true } },
  transfer: { select: { id: true, number: true } },
} satisfies Prisma.StockMovementSelect;

type MovementRow = Prisma.StockMovementGetPayload<{ select: typeof movementSelect }>;

function documentOf({ receiving, transfer }: MovementRow) {
  if (receiving) {
    return { type: 'RECEIVING', id: receiving.id, number: formatReceivingNumber(receiving.number) };
  }
  if (transfer) {
    return { type: 'TRANSFER', id: transfer.id, number: formatTransferNumber(transfer.number) };
  }
  return null;
}

function presentMovement(row: MovementRow) {
  const { serialUnit, receiving: _r, transfer: _t, ...m } = row;
  return { ...m, serialNumber: serialUnit?.serialNumber ?? null, document: documentOf(row) };
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
  ) {}

  async listStock(q: StockQueryDto) {
    const where: Prisma.StockWhereInput = {
      warehouseId: q.warehouseId,
      productId: q.productId,
      // rows that dropped to zero stay in the table; hide them from the stock list
      quantity: { gt: 0 },
    };
    const search = q.search?.trim();
    if (search) {
      const contains = { contains: search, mode: 'insensitive' as const };
      where.product = { OR: [{ name: contains }, { sku: contains }, { barcode: search }] };
    }
    if (q.onlyAvailable) {
      // compares two columns of the same row: quantity > reserved
      where.quantity = { gt: this.prisma.stock.fields.reserved };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stock.findMany({
        where,
        select: {
          quantity: true,
          reserved: true,
          updatedAt: true,
          product: { select: { id: true, name: true, sku: true, trackSerial: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ product: { name: 'asc' } }, { warehouse: { name: 'asc' } }],
        ...pageArgs(q),
      }),
      this.prisma.stock.count({ where }),
    ]);
    const items = rows.map((r) => ({ ...r, available: r.quantity - r.reserved }));
    return { items, total, page: q.page, limit: q.limit };
  }

  async listMovements(q: MovementQueryDto) {
    const where: Prisma.StockMovementWhereInput = {
      productId: q.productId,
      warehouseId: q.warehouseId,
      receivingId: q.receivingId,
      transferId: q.transferId,
      type: q.type,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        select: movementSelect,
        orderBy: [{ createdAt: 'desc' }, { balanceAfter: 'desc' }],
        ...pageArgs(q),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items: rows.map(presentMovement), total, page: q.page, limit: q.limit };
  }

  async adjust(dto: AdjustStockDto, userId: string) {
    await this.prisma.$transaction((tx) =>
      this.ledger.move(tx, { ...dto, type: StockMovementType.ADJUSTMENT, userId }),
    );
    return this.prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
      select: { productId: true, warehouseId: true, quantity: true, reserved: true },
    });
  }

  // Full life of one unit: where it came from and everything that happened to it (ТЗ п.12).
  async findSerial(serialNumber: string) {
    const unit = await this.prisma.serialUnit.findUnique({
      where: { serialNumber },
      select: {
        serialNumber: true,
        status: true,
        createdAt: true,
        product: { select: { id: true, name: true, sku: true, warrantyMonths: true } },
        warehouse: { select: { id: true, name: true } },
        movements: { select: movementSelect, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!unit) throw new NotFoundException('Serial number not found');
    const { movements, ...rest } = unit;
    return { ...rest, history: movements.map(presentMovement) };
  }
}
