import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, SerialUnitStatus, StockMovementType } from '../generated/prisma/client';

export type Tx = Prisma.TransactionClient;

export interface MoveInput {
  type: StockMovementType;
  productId: string;
  warehouseId: string;
  /** Signed: positive brings goods in, negative takes them out. */
  quantity: number;
  userId: string;
  reason?: string | null;
  receivingId?: string;
  transferId?: string;
  /** Required for serial-tracked products, one per unit moved. */
  serialNumbers?: string[];
}

// Which direction each movement type may go, and what happens to serial-tracked units.
const RULES: Record<
  StockMovementType,
  { in?: 'register' | 'arrive'; out?: SerialUnitStatus; newGoods: boolean }
> = {
  RECEIPT: { in: 'register', newGoods: true },
  ADJUSTMENT: { in: 'register', out: SerialUnitStatus.WRITTEN_OFF, newGoods: true },
  TRANSFER_OUT: { out: SerialUnitStatus.IN_TRANSIT, newGoods: false },
  TRANSFER_IN: { in: 'arrive', newGoods: false },
};

/**
 * The only code allowed to change stock balances. Every change updates the
 * cached balance in `stock` and appends to `stock_movements` inside the caller's
 * transaction, so the two can never drift apart.
 */
@Injectable()
export class StockLedgerService {
  async move(tx: Tx, input: MoveInput): Promise<void> {
    if (!Number.isInteger(input.quantity) || input.quantity === 0) {
      throw new BadRequestException('Quantity must be a non-zero integer');
    }
    const incoming = input.quantity > 0;
    const rule = RULES[input.type];
    if (incoming ? !rule.in : !rule.out) {
      throw new Error(`${input.type} cannot move stock ${incoming ? 'in' : 'out'}`);
    }

    const [product, warehouse] = await Promise.all([
      tx.product.findUnique({
        where: { id: input.productId },
        select: { name: true, trackSerial: true, isArchived: true },
      }),
      tx.warehouse.findUnique({ where: { id: input.warehouseId }, select: { isActive: true } }),
    ]);
    if (!product) throw new BadRequestException('Product not found');
    if (!warehouse) throw new BadRequestException('Warehouse not found');

    // Only brand-new goods are blocked; stock already on the way must be able to arrive.
    if (incoming && rule.newGoods && product.isArchived) {
      throw new BadRequestException(`Product "${product.name}" is archived`);
    }
    if (incoming && rule.newGoods && !warehouse.isActive) {
      throw new BadRequestException('Warehouse is inactive');
    }

    const serials = input.serialNumbers ?? [];
    if (!product.trackSerial) {
      if (serials.length) {
        throw new BadRequestException(`Product "${product.name}" is not tracked by serial number`);
      }
      await this.post(tx, input);
      return;
    }

    if (serials.length !== Math.abs(input.quantity)) {
      throw new BadRequestException(
        `Product "${product.name}" needs exactly ${Math.abs(input.quantity)} serial numbers, got ${serials.length}`,
      );
    }
    const duplicates = serials.filter((s, i) => serials.indexOf(s) !== i);
    if (duplicates.length) {
      throw new BadRequestException(`Duplicate serial numbers: ${[...new Set(duplicates)].join(', ')}`);
    }

    const { productId, warehouseId } = input;
    let unitIds: string[];
    if (!incoming) unitIds = await this.takeUnits(tx, productId, warehouseId, serials, rule.out!);
    else if (rule.in === 'arrive') unitIds = await this.arriveUnits(tx, productId, warehouseId, serials);
    else unitIds = await this.registerUnits(tx, productId, warehouseId, serials);
    await this.post(tx, input, unitIds);
  }

  private async registerUnits(tx: Tx, productId: string, warehouseId: string, serials: string[]) {
    const taken = await tx.serialUnit.findMany({
      where: { serialNumber: { in: serials } },
      select: { serialNumber: true },
    });
    if (taken.length) {
      throw new ConflictException(
        `Serial numbers already registered: ${taken.map((t) => t.serialNumber).join(', ')}`,
      );
    }
    const units = await tx.serialUnit.createManyAndReturn({
      data: serials.map((serialNumber) => ({ serialNumber, productId, warehouseId })),
      select: { id: true },
    });
    return units.map((u) => u.id);
  }

  /** Units leave the warehouse: written off, or on their way to another warehouse. */
  private takeUnits(
    tx: Tx,
    productId: string,
    warehouseId: string,
    serials: string[],
    newStatus: SerialUnitStatus,
  ) {
    return this.changeUnits(
      tx,
      serials,
      { productId, warehouseId, status: SerialUnitStatus.IN_STOCK },
      { status: newStatus, warehouseId: null },
      'Not in stock at this warehouse',
    );
  }

  /** In-transit units arrive at the destination warehouse. */
  private arriveUnits(tx: Tx, productId: string, warehouseId: string, serials: string[]) {
    return this.changeUnits(
      tx,
      serials,
      { productId, status: SerialUnitStatus.IN_TRANSIT },
      { status: SerialUnitStatus.IN_STOCK, warehouseId },
      'Not in transit',
    );
  }

  private async changeUnits(
    tx: Tx,
    serials: string[],
    expected: Prisma.SerialUnitWhereInput,
    data: Prisma.SerialUnitUncheckedUpdateManyInput,
    missingMessage: string,
  ) {
    const units = await tx.serialUnit.findMany({
      where: { ...expected, serialNumber: { in: serials } },
      select: { id: true, serialNumber: true },
    });
    const found = new Set(units.map((u) => u.serialNumber));
    const missing = serials.filter((s) => !found.has(s));
    if (missing.length) throw new BadRequestException(`${missingMessage}: ${missing.join(', ')}`);

    const ids = units.map((u) => u.id);
    // Repeating the expected state in WHERE makes this safe against a concurrent
    // operation that moved the same units in between.
    const { count } = await tx.serialUnit.updateMany({ where: { ...expected, id: { in: ids } }, data });
    if (count !== ids.length) {
      throw new ConflictException('Serial units were changed by another operation, retry');
    }
    return ids;
  }

  private async post(tx: Tx, input: MoveInput, serialUnitIds?: string[]) {
    const balance = await this.applyDelta(tx, input.productId, input.warehouseId, input.quantity);
    const base = {
      type: input.type,
      productId: input.productId,
      warehouseId: input.warehouseId,
      userId: input.userId,
      reason: input.reason ?? null,
      receivingId: input.receivingId,
      transferId: input.transferId,
    };

    if (!serialUnitIds?.length) {
      await tx.stockMovement.create({
        data: { ...base, quantity: input.quantity, balanceAfter: balance },
      });
      return;
    }

    // One ledger row per unit so each serial number has its own history.
    const step = Math.sign(input.quantity);
    const start = balance - input.quantity;
    await tx.stockMovement.createMany({
      data: serialUnitIds.map((serialUnitId, i) => ({
        ...base,
        quantity: step,
        balanceAfter: start + step * (i + 1),
        serialUnitId,
      })),
    });
  }

  // Single-statement updates: the database applies them atomically and holds a row
  // lock until commit, so concurrent requests cannot oversell or lose an update.
  private async applyDelta(tx: Tx, productId: string, warehouseId: string, delta: number) {
    if (delta > 0) {
      const rows = await tx.$queryRaw<{ quantity: number }[]>`
        INSERT INTO "stock" ("id", "productId", "warehouseId", "quantity", "reserved", "updatedAt")
        VALUES (gen_random_uuid()::text, ${productId}, ${warehouseId}, ${delta}, 0, now())
        ON CONFLICT ("productId", "warehouseId")
        DO UPDATE SET "quantity" = "stock"."quantity" + EXCLUDED."quantity", "updatedAt" = now()
        RETURNING "quantity"`;
      return rows[0].quantity;
    }

    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "stock"
      SET "quantity" = "quantity" + ${delta}, "updatedAt" = now()
      WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        AND "quantity" - "reserved" >= ${-delta}
      RETURNING "quantity"`;
    if (!rows.length) {
      const current = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId, warehouseId } },
        select: { quantity: true, reserved: true },
      });
      const available = current ? current.quantity - current.reserved : 0;
      throw new BadRequestException(
        `Not enough available stock: requested ${-delta}, available ${available}`,
      );
    }
    return rows[0].quantity;
  }
}
