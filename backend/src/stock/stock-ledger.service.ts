import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { formatCountNumber } from '../common/document-numbers';
import {
  InventoryStatus,
  Prisma,
  SerialUnitStatus,
  StockMovementType,
} from '../generated/prisma/client';

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
  inventoryCountId?: string;
  orderId?: string;
  returnId?: string;
  warrantyCaseId?: string;
  /** Required for serial-tracked products, one per unit moved. */
  serialNumbers?: string[];
}

// Which direction each movement type may go, and what happens to serial-tracked units.
const RULES: Record<
  StockMovementType,
  { in?: 'register' | 'arrive' | 'restock'; out?: SerialUnitStatus; newGoods: boolean }
> = {
  RECEIPT: { in: 'register', newGoods: true },
  ADJUSTMENT: { in: 'register', out: SerialUnitStatus.WRITTEN_OFF, newGoods: true },
  TRANSFER_OUT: { out: SerialUnitStatus.IN_TRANSIT, newGoods: false },
  TRANSFER_IN: { in: 'arrive', newGoods: false },
  // Found surplus is registered even if archived: it physically exists.
  INVENTORY: { in: 'register', out: SerialUnitStatus.WRITTEN_OFF, newGoods: false },
  // Sales only happen through shipOrder(), which also consumes the reservation.
  SALE: { newGoods: false },
  // An inspected customer return goes back on sale (its units already exist).
  RETURN: { in: 'restock', newGoods: false },
  // Only through replaceUnit(): a new unit goes to the customer instead of a faulty one.
  WARRANTY_REPLACEMENT: { newGoods: false },
};

const OPEN_COUNT = [InventoryStatus.IN_PROGRESS, InventoryStatus.COUNTED];

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
        select: { name: true, trackSerial: true, isArchived: true, categoryId: true },
      }),
      tx.warehouse.findUnique({ where: { id: input.warehouseId }, select: { isActive: true } }),
    ]);
    if (!product) throw new BadRequestException('Product not found');
    if (!warehouse) throw new BadRequestException('Warehouse not found');

    if (input.type !== StockMovementType.INVENTORY) {
      await this.assertNotBeingCounted(tx, input.warehouseId, product.categoryId, product.name);
    }

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
    else if (rule.in === 'restock') unitIds = await this.restockUnits(tx, productId, warehouseId, serials);
    else unitIds = await this.registerUnits(tx, productId, warehouseId, serials);
    await this.post(tx, input, unitIds);
  }

  /**
   * Reserves stock for an order line, preferring one active warehouse that can cover
   * the whole quantity, otherwise combining several. Physical stock is not moved.
   */
  async reserve(tx: Tx, input: { orderItemId: string; productId: string; quantity: number }) {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { name: true },
    });
    const rows = await tx.stock.findMany({
      where: {
        productId: input.productId,
        warehouse: { isActive: true },
        quantity: { gt: tx.stock.fields.reserved },
      },
      select: { warehouseId: true, quantity: true, reserved: true },
    });
    const free = (r: (typeof rows)[number]) => r.quantity - r.reserved;
    rows.sort((a, b) => {
      const aCovers = free(a) >= input.quantity;
      const bCovers = free(b) >= input.quantity;
      if (aCovers !== bCovers) return aCovers ? -1 : 1;
      return free(b) - free(a);
    });

    let need = input.quantity;
    for (const row of rows) {
      if (!need) break;
      const take = Math.min(need, free(row));
      // Same atomic pattern as write-offs: a concurrent order cannot take the same units.
      const updated = await tx.$queryRaw<unknown[]>`
        UPDATE "stock" SET "reserved" = "reserved" + ${take}, "updatedAt" = now()
        WHERE "productId" = ${input.productId} AND "warehouseId" = ${row.warehouseId}
          AND "quantity" - "reserved" >= ${take}
        RETURNING 1`;
      if (!updated.length) continue;
      await tx.stockReservation.create({
        data: {
          orderItemId: input.orderItemId,
          productId: input.productId,
          warehouseId: row.warehouseId,
          quantity: take,
        },
      });
      need -= take;
    }
    if (need) {
      throw new ConflictException(
        `Not enough stock for "${product.name}": requested ${input.quantity}, available ${input.quantity - need}`,
      );
    }
  }

  /** Releases every active reservation of an order and gives the units back to "available". */
  async releaseReservations(tx: Tx, orderId: string, reason: string) {
    const active = await tx.stockReservation.findMany({
      where: { orderItem: { orderId }, releasedAt: null },
      select: { id: true, productId: true, warehouseId: true, quantity: true },
    });
    // Units already picked for this order go back to the shelf, free for anyone.
    await tx.serialUnit.updateMany({
      where: { orderItem: { orderId }, status: SerialUnitStatus.IN_STOCK },
      data: { orderItemId: null },
    });
    if (!active.length) return;

    const { count } = await tx.stockReservation.updateMany({
      where: { id: { in: active.map((r) => r.id) }, releasedAt: null },
      data: { releasedAt: new Date(), releaseReason: reason },
    });
    if (count !== active.length) {
      throw new ConflictException('Reservations were changed by another operation, retry');
    }
    for (const r of active) {
      await tx.$executeRaw`
        UPDATE "stock" SET "reserved" = "reserved" - ${r.quantity}, "updatedAt" = now()
        WHERE "productId" = ${r.productId} AND "warehouseId" = ${r.warehouseId}`;
    }
  }

  /**
   * Picking a serial-tracked unit ties it to an order line. It stays IN_STOCK (it is
   * physically still here, so inventory sees it) but can no longer be moved or written off.
   */
  async linkUnit(
    tx: Tx,
    input: { serialNumber: string; productId: string; warehouseId: string; orderItemId: string },
  ) {
    const { serialNumber, productId, warehouseId, orderItemId } = input;
    const { count } = await tx.serialUnit.updateMany({
      where: { serialNumber, productId, warehouseId, status: SerialUnitStatus.IN_STOCK, orderItemId: null },
      data: { orderItemId },
    });
    if (count) return;

    const unit = await tx.serialUnit.findUnique({
      where: { serialNumber },
      select: { productId: true, warehouseId: true, status: true, orderItemId: true },
    });
    if (!unit) throw new BadRequestException(`Serial ${serialNumber} is not registered`);
    if (unit.productId !== productId) {
      throw new BadRequestException(`Serial ${serialNumber} belongs to another product`);
    }
    if (unit.orderItemId === orderItemId) {
      throw new ConflictException(`Serial ${serialNumber} is already picked for this order`);
    }
    if (unit.orderItemId && unit.status === SerialUnitStatus.IN_STOCK) {
      throw new ConflictException(`Serial ${serialNumber} is already picked for another order`);
    }
    throw new ConflictException(`Serial ${serialNumber} is not on the shelf of this warehouse (${unit.status})`);
  }

  async unlinkUnit(tx: Tx, serialNumber: string, orderItemId: string) {
    const { count } = await tx.serialUnit.updateMany({
      where: { serialNumber, orderItemId, status: SerialUnitStatus.IN_STOCK },
      data: { orderItemId: null },
    });
    if (!count) throw new BadRequestException(`Serial ${serialNumber} is not picked for this order`);
  }

  /**
   * Goods leave the company: every active reservation of the order becomes a SALE.
   * Quantity and reservation go down together, and picked units become SOLD.
   */
  async shipOrder(tx: Tx, orderId: string, userId: string, soldAt: Date) {
    const reservations = await tx.stockReservation.findMany({
      where: { orderItem: { orderId }, releasedAt: null },
      select: {
        id: true,
        productId: true,
        warehouseId: true,
        quantity: true,
        pickedQuantity: true,
        orderItemId: true,
        product: { select: { name: true, trackSerial: true, categoryId: true } },
      },
    });
    if (!reservations.length) throw new ConflictException('Order has no reserved stock to ship');

    for (const r of reservations) {
      const { name, trackSerial, categoryId } = r.product;
      if (r.pickedQuantity !== r.quantity) throw new ConflictException(`"${name}" is not fully picked`);
      await this.assertNotBeingCounted(tx, r.warehouseId, categoryId, name);

      let unitIds: string[] | undefined;
      if (trackSerial) {
        const units = await tx.serialUnit.findMany({
          where: { orderItemId: r.orderItemId, warehouseId: r.warehouseId, status: SerialUnitStatus.IN_STOCK },
          select: { id: true },
        });
        if (units.length !== r.quantity) {
          throw new ConflictException(`"${name}": ${units.length} of ${r.quantity} serial numbers picked`);
        }
        unitIds = units.map((u) => u.id);
        const { count } = await tx.serialUnit.updateMany({
          where: { id: { in: unitIds }, status: SerialUnitStatus.IN_STOCK, orderItemId: r.orderItemId },
          data: { status: SerialUnitStatus.SOLD, warehouseId: null, soldAt },
        });
        if (count !== unitIds.length) {
          throw new ConflictException('Serial units were changed by another operation, retry');
        }
      }

      await this.post(
        tx,
        { type: StockMovementType.SALE, productId: r.productId, warehouseId: r.warehouseId, quantity: -r.quantity, userId, orderId },
        unitIds,
        true,
      );
    }

    const { count } = await tx.stockReservation.updateMany({
      where: { id: { in: reservations.map((r) => r.id) }, releasedAt: null },
      data: { releasedAt: soldAt, releaseReason: 'Shipped' },
    });
    if (count !== reservations.length) {
      throw new ConflictException('Reservations were changed by another operation, retry');
    }
  }

  /**
   * Warranty replacement: a unit from stock goes to the customer, inheriting the sale
   * date (the warranty continues), and the faulty unit is written off.
   */
  async replaceUnit(
    tx: Tx,
    input: {
      faultyUnitId: string;
      serialNumber: string;
      warehouseId: string;
      userId: string;
      warrantyCaseId: string;
    },
  ) {
    const faulty = await tx.serialUnit.findUniqueOrThrow({
      where: { id: input.faultyUnitId },
      select: { productId: true, soldAt: true, orderItemId: true, product: { select: { name: true, categoryId: true } } },
    });
    await this.assertNotBeingCounted(tx, input.warehouseId, faulty.product.categoryId, faulty.product.name);

    const replacement = await tx.serialUnit.findFirst({
      where: {
        serialNumber: input.serialNumber,
        productId: faulty.productId,
        warehouseId: input.warehouseId,
        status: SerialUnitStatus.IN_STOCK,
        orderItemId: null,
      },
      select: { id: true },
    });
    if (!replacement) {
      throw new BadRequestException(
        `Serial ${input.serialNumber} is not a free unit of "${faulty.product.name}" on this warehouse's shelf`,
      );
    }

    const { count } = await tx.serialUnit.updateMany({
      where: { id: replacement.id, status: SerialUnitStatus.IN_STOCK, orderItemId: null },
      data: {
        status: SerialUnitStatus.SOLD,
        warehouseId: null,
        soldAt: faulty.soldAt,
        orderItemId: faulty.orderItemId,
      },
    });
    if (!count) throw new ConflictException('Serial units were changed by another operation, retry');

    await this.post(
      tx,
      {
        type: StockMovementType.WARRANTY_REPLACEMENT,
        productId: faulty.productId,
        warehouseId: input.warehouseId,
        quantity: -1,
        userId: input.userId,
        warrantyCaseId: input.warrantyCaseId,
      },
      [replacement.id],
    );
    await tx.serialUnit.update({
      where: { id: input.faultyUnitId },
      data: { status: SerialUnitStatus.WRITTEN_OFF, warehouseId: null },
    });
    return replacement.id;
  }

  private async assertNotBeingCounted(
    tx: Tx,
    warehouseId: string,
    categoryId: string,
    productName: string,
  ) {
    const count = await tx.inventoryCount.findFirst({
      where: {
        warehouseId,
        status: { in: OPEN_COUNT },
        OR: [{ scopeCategoryIds: { isEmpty: true } }, { scopeCategoryIds: { has: categoryId } }],
      },
      select: { number: true },
    });
    if (count) {
      throw new ConflictException(
        `"${productName}" is being counted in ${formatCountNumber(count.number)} at this warehouse; ` +
          'stock movements resume once the count is approved or cancelled',
      );
    }
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
      { productId, warehouseId, status: SerialUnitStatus.IN_STOCK, orderItemId: null },
      { status: newStatus, warehouseId: null },
      'Not in stock at this warehouse (or picked for an order)',
    );
  }

  /** Returned units that passed inspection become sellable again, free of the old order. */
  private restockUnits(tx: Tx, productId: string, warehouseId: string, serials: string[]) {
    return this.changeUnits(
      tx,
      serials,
      { productId, warehouseId, status: SerialUnitStatus.RETURNED },
      { status: SerialUnitStatus.IN_STOCK, orderItemId: null },
      'Not waiting for inspection at this warehouse',
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

  private async post(tx: Tx, input: MoveInput, serialUnitIds?: string[], fromReserved = false) {
    const balance = fromReserved
      ? await this.consumeReserved(tx, input.productId, input.warehouseId, -input.quantity)
      : await this.applyDelta(tx, input.productId, input.warehouseId, input.quantity);
    const base = {
      type: input.type,
      productId: input.productId,
      warehouseId: input.warehouseId,
      userId: input.userId,
      reason: input.reason ?? null,
      receivingId: input.receivingId,
      transferId: input.transferId,
      inventoryCountId: input.inventoryCountId,
      orderId: input.orderId,
      returnId: input.returnId,
      warrantyCaseId: input.warrantyCaseId,
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

  /** Shipping reserved goods: on-hand and reserved drop together in one statement. */
  private async consumeReserved(tx: Tx, productId: string, warehouseId: string, units: number) {
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "stock"
      SET "quantity" = "quantity" - ${units}, "reserved" = "reserved" - ${units}, "updatedAt" = now()
      WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        AND "reserved" >= ${units}
      RETURNING "quantity"`;
    if (!rows.length) throw new ConflictException('Reserved stock does not match the order, retry');
    return rows[0].quantity;
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
