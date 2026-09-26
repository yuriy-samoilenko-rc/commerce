import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { formatCountNumber } from '../common/document-numbers';
import { pageArgs } from '../common/dto/pagination-query.dto';
import { LONG_TX } from '../common/transactions';
import {
  DocumentType,
  InventoryStatus,
  Prisma,
  SerialUnitStatus,
  StockMovementType,
} from '../generated/prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanSerials } from '../stock/document-items';
import { StockLedgerService, Tx } from '../stock/stock-ledger.service';
import {
  CountQueryDto,
  CreateCountDto,
  ScanDto,
  SetLineDto,
} from './dto/inventory.dto';

const OPEN = [InventoryStatus.IN_PROGRESS, InventoryStatus.COUNTED];
const person = { select: { id: true, name: true } };

const headerSelect = {
  id: true,
  number: true,
  status: true,
  notes: true,
  categoryId: true,
  scopeCategoryIds: true,
  createdAt: true,
  finishedAt: true,
  approvedAt: true,
  warehouse: { select: { id: true, name: true } },
  createdBy: person,
  finishedBy: person,
  approvedBy: person,
} satisfies Prisma.InventoryCountSelect;

type CountScope = {
  id: string;
  warehouseId: string;
  scopeCategoryIds: string[];
};

export interface DiffRow {
  product: { id: string; name: string; sku: string; trackSerial: boolean };
  expected: number;
  counted: number;
  difference: number;
  missingSerials?: string[];
  extraSerials?: string[];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly documents: DocumentsService,
    private readonly categories: CategoriesService,
  ) {}

  async create(dto: CreateCountDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) throw new BadRequestException('Warehouse not found');
    let scopeCategoryIds: string[] = [];
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new BadRequestException('Category not found');
      scopeCategoryIds = await this.categories.withDescendantIds(
        dto.categoryId,
      );
    }

    const open = await this.prisma.inventoryCount.findFirst({
      where: { warehouseId: dto.warehouseId, status: { in: OPEN } },
      select: { number: true },
    });
    if (open) {
      throw new ConflictException(
        `Warehouse already has an open count ${formatCountNumber(open.number)}`,
      );
    }
    // The partial unique index still guards the race between this check and the insert.
    const created = await this.prisma.inventoryCount.create({
      data: { ...dto, scopeCategoryIds, createdById: userId },
      select: { id: true },
    });
    return this.findOne(created.id);
  }

  async list(q: CountQueryDto) {
    const where: Prisma.InventoryCountWhereInput = {
      status: q.status,
      warehouseId: q.warehouseId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryCount.findMany({
        where,
        select: { ...headerSelect, _count: { select: { lines: true } } },
        orderBy: { number: 'desc' },
        ...pageArgs(q),
      }),
      this.prisma.inventoryCount.count({ where }),
    ]);
    const items = rows.map(({ _count, ...c }) => ({
      ...c,
      number: formatCountNumber(c.number),
      countedProducts: _count.lines,
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  /**
   * While the count is open, differences are computed live against the (frozen) stock.
   * After approval they come from the lines, which then hold the book value at approval time.
   */
  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      select: { ...headerSelect, warehouseId: true },
    });
    if (!count) throw new NotFoundException('Inventory count not found');

    const rows =
      count.status === InventoryStatus.APPROVED
        ? await this.approvedRows(id)
        : await this.computeDiff(this.prisma, count);

    const { warehouseId: _w, ...header } = count;
    return {
      ...header,
      number: formatCountNumber(count.number),
      summary: summarize(rows),
      lines: rows,
    };
  }

  async scan(id: string, dto: ScanDto) {
    const code = dto.code.trim();
    const productId = await this.prisma.$transaction(async (tx) => {
      const count = await this.lockCount(
        tx,
        id,
        InventoryStatus.IN_PROGRESS,
        'scanned',
      );

      const unit = await tx.serialUnit.findUnique({
        where: { serialNumber: code },
        select: {
          status: true,
          warehouseId: true,
          product: { select: { id: true, name: true, categoryId: true } },
        },
      });
      if (unit) {
        if (dto.quantity && dto.quantity !== 1) {
          throw new BadRequestException(
            'A serial number is always exactly one unit',
          );
        }
        this.assertInScope(count, unit.product);
        this.assertUnitHere(count, code, unit);
        await this.addSerial(tx, id, unit.product.id, code);
        return unit.product.id;
      }

      const product = await tx.product.findFirst({
        where: { OR: [{ barcode: code }, { sku: code }] },
        select: { id: true, name: true, trackSerial: true, categoryId: true },
      });
      if (!product) {
        throw new NotFoundException(
          `Unknown code "${code}". For a unit whose serial number is not in the system, enter it manually on the product line`,
        );
      }
      if (product.trackSerial) {
        throw new BadRequestException(
          `"${product.name}" is counted by serial number: scan the serial, not the barcode`,
        );
      }
      this.assertInScope(count, product);
      await tx.inventoryLine.upsert({
        where: { countId_productId: { countId: id, productId: product.id } },
        create: {
          countId: id,
          productId: product.id,
          countedQuantity: dto.quantity ?? 1,
        },
        update: { countedQuantity: { increment: dto.quantity ?? 1 } },
      });
      return product.id;
    });
    return this.lineView(id, productId);
  }

  async setLine(id: string, productId: string, dto: SetLineDto) {
    await this.prisma.$transaction(async (tx) => {
      const count = await this.lockCount(
        tx,
        id,
        InventoryStatus.IN_PROGRESS,
        'edited',
      );
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, trackSerial: true, categoryId: true },
      });
      if (!product) throw new NotFoundException('Product not found');
      this.assertInScope(count, product);

      if (!product.trackSerial) {
        if (dto.serialNumbers || dto.countedQuantity === undefined) {
          throw new BadRequestException(
            `"${product.name}" is counted by quantity: send countedQuantity`,
          );
        }
        await tx.inventoryLine.upsert({
          where: { countId_productId: { countId: id, productId } },
          create: {
            countId: id,
            productId,
            countedQuantity: dto.countedQuantity,
          },
          update: { countedQuantity: dto.countedQuantity },
        });
        return;
      }

      if (!dto.serialNumbers || dto.countedQuantity !== undefined) {
        throw new BadRequestException(
          `"${product.name}" is counted by serial number: send serialNumbers`,
        );
      }
      const serials = cleanSerials(dto.serialNumbers);
      const duplicates = serials.filter((s, i) => serials.indexOf(s) !== i);
      if (duplicates.length) {
        throw new BadRequestException(
          `Duplicate serial numbers: ${[...new Set(duplicates)].join(', ')}`,
        );
      }
      // Known serials must belong to this product and sit on this warehouse's shelf;
      // unknown ones are allowed and will be registered as surplus on approval.
      const known = await tx.serialUnit.findMany({
        where: { serialNumber: { in: serials } },
        select: {
          serialNumber: true,
          status: true,
          warehouseId: true,
          productId: true,
        },
      });
      for (const unit of known) {
        if (unit.productId !== productId) {
          throw new ConflictException(
            `Serial ${unit.serialNumber} belongs to another product`,
          );
        }
        this.assertUnitHere(count, unit.serialNumber, unit);
      }

      await tx.inventorySerial.deleteMany({
        where: { countId: id, productId },
      });
      await tx.inventorySerial.createMany({
        data: serials.map((serialNumber) => ({
          countId: id,
          productId,
          serialNumber,
        })),
      });
      await tx.inventoryLine.upsert({
        where: { countId_productId: { countId: id, productId } },
        create: { countId: id, productId, countedQuantity: serials.length },
        update: { countedQuantity: serials.length },
      });
    });
    return this.lineView(id, productId);
  }

  async finish(id: string, userId: string) {
    await this.transition(
      id,
      InventoryStatus.IN_PROGRESS,
      InventoryStatus.COUNTED,
      'finished',
      {
        finishedById: userId,
        finishedAt: new Date(),
      },
    );
    return this.findOne(id);
  }

  async reopen(id: string) {
    await this.transition(
      id,
      InventoryStatus.COUNTED,
      InventoryStatus.IN_PROGRESS,
      'reopened',
      {
        finishedById: null,
        finishedAt: null,
      },
    );
    return this.findOne(id);
  }

  async cancel(id: string) {
    const { count } = await this.prisma.inventoryCount.updateMany({
      where: { id, status: { in: OPEN } },
      data: { status: InventoryStatus.CANCELLED },
    });
    if (!count) await this.throwWrongStatus(this.prisma, id, 'cancelled');
    return this.findOne(id);
  }

  /** Books every difference as an INVENTORY movement and unfreezes the stock. */
  async approve(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count: updated } = await tx.inventoryCount.updateMany({
        where: { id, status: InventoryStatus.COUNTED },
        data: {
          status: InventoryStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
      if (!updated) await this.throwWrongStatus(tx, id, 'approved');

      const count = await tx.inventoryCount.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          number: true,
          warehouseId: true,
          scopeCategoryIds: true,
        },
      });
      const base = {
        type: StockMovementType.INVENTORY,
        warehouseId: count.warehouseId,
        userId,
        inventoryCountId: id,
        reason: `Inventory ${formatCountNumber(count.number)}`,
      };

      for (const row of await this.computeDiff(tx, count)) {
        const productId = row.product.id;
        if (row.product.trackSerial) {
          const missing = row.missingSerials ?? [];
          const extra = row.extraSerials ?? [];
          if (missing.length) {
            await this.ledger.move(tx, {
              ...base,
              productId,
              quantity: -missing.length,
              serialNumbers: missing,
            });
          }
          if (extra.length) {
            await this.ledger.move(tx, {
              ...base,
              productId,
              quantity: extra.length,
              serialNumbers: extra,
            });
          }
        } else if (row.difference) {
          await this.ledger.move(tx, {
            ...base,
            productId,
            quantity: row.difference,
          });
        }
        // Keep the book value the difference was measured against.
        await tx.inventoryLine.upsert({
          where: { countId_productId: { countId: id, productId } },
          create: {
            countId: id,
            productId,
            countedQuantity: row.counted,
            expectedQuantity: row.expected,
          },
          update: { expectedQuantity: row.expected },
        });
      }
      await this.documents.issue(tx, DocumentType.INVENTORY_ACT, id, userId);
    }, LONG_TX);
    return this.findOne(id);
  }

  private async computeDiff(
    db: Tx | PrismaService,
    count: CountScope,
  ): Promise<DiffRow[]> {
    const inScope: Prisma.ProductWhereInput = count.scopeCategoryIds.length
      ? { categoryId: { in: count.scopeCategoryIds } }
      : {};
    const [stock, lines, scanned] = await Promise.all([
      db.stock.findMany({
        where: {
          warehouseId: count.warehouseId,
          quantity: { gt: 0 },
          product: inScope,
        },
        select: { productId: true, quantity: true },
      }),
      db.inventoryLine.findMany({
        where: { countId: count.id },
        select: { productId: true, countedQuantity: true },
      }),
      db.inventorySerial.findMany({
        where: { countId: count.id },
        select: { productId: true, serialNumber: true },
      }),
    ]);

    const expectedQty = new Map(stock.map((s) => [s.productId, s.quantity]));
    const countedQty = new Map(
      lines.map((l) => [l.productId, l.countedQuantity]),
    );
    const ids = [...new Set([...expectedQty.keys(), ...countedQty.keys()])];
    const products = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, sku: true, trackSerial: true },
      orderBy: { name: 'asc' },
    });

    const serialIds = products.filter((p) => p.trackSerial).map((p) => p.id);
    const onShelf = serialIds.length
      ? await db.serialUnit.findMany({
          where: {
            warehouseId: count.warehouseId,
            status: SerialUnitStatus.IN_STOCK,
            productId: { in: serialIds },
          },
          select: { productId: true, serialNumber: true },
        })
      : [];
    const byProduct = (
      rows: { productId: string; serialNumber: string }[],
      productId: string,
    ) =>
      new Set(
        rows
          .filter((r) => r.productId === productId)
          .map((r) => r.serialNumber),
      );

    return products.map((product) => {
      const expected = expectedQty.get(product.id) ?? 0;
      const counted = countedQty.get(product.id) ?? 0;
      const row: DiffRow = {
        product,
        expected,
        counted,
        difference: counted - expected,
      };
      if (product.trackSerial) {
        const book = byProduct(onShelf, product.id);
        const found = byProduct(scanned, product.id);
        row.missingSerials = [...book].filter((s) => !found.has(s)).sort();
        row.extraSerials = [...found].filter((s) => !book.has(s)).sort();
      }
      return row;
    });
  }

  private async approvedRows(id: string): Promise<DiffRow[]> {
    const lines = await this.prisma.inventoryLine.findMany({
      where: { countId: id },
      select: {
        countedQuantity: true,
        expectedQuantity: true,
        product: {
          select: { id: true, name: true, sku: true, trackSerial: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });
    return lines.map((l) => {
      const expected = l.expectedQuantity ?? 0;
      return {
        product: l.product,
        expected,
        counted: l.countedQuantity,
        difference: l.countedQuantity - expected,
      };
    });
  }

  private async lineView(id: string, productId: string) {
    const count = await this.prisma.inventoryCount.findUniqueOrThrow({
      where: { id },
      select: { warehouseId: true },
    });
    const [product, line, stock, serials] = await Promise.all([
      this.prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: { id: true, name: true, sku: true, trackSerial: true },
      }),
      this.prisma.inventoryLine.findUnique({
        where: { countId_productId: { countId: id, productId } },
      }),
      this.prisma.stock.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId: count.warehouseId },
        },
        select: { quantity: true },
      }),
      this.prisma.inventorySerial.findMany({
        where: { countId: id, productId },
        select: { serialNumber: true },
        orderBy: { scannedAt: 'asc' },
      }),
    ]);
    const expected = stock?.quantity ?? 0;
    const counted = line?.countedQuantity ?? 0;
    return {
      product,
      expected,
      counted,
      difference: counted - expected,
      ...(product.trackSerial && {
        serialNumbers: serials.map((s) => s.serialNumber),
      }),
    };
  }

  private async addSerial(
    tx: Tx,
    countId: string,
    productId: string,
    serialNumber: string,
  ) {
    const already = await tx.inventorySerial.findUnique({
      where: { countId_serialNumber: { countId, serialNumber } },
    });
    if (already)
      throw new ConflictException(`Serial ${serialNumber} is already counted`);
    await tx.inventorySerial.create({
      data: { countId, productId, serialNumber },
    });
    await tx.inventoryLine.upsert({
      where: { countId_productId: { countId, productId } },
      create: { countId, productId, countedQuantity: 1 },
      update: { countedQuantity: { increment: 1 } },
    });
  }

  /**
   * Touches the count row, which locks it until commit: scans are serialized with each
   * other and with finish, so nothing can be added after the count was closed.
   */
  private async lockCount(
    tx: Tx,
    id: string,
    status: InventoryStatus,
    action: string,
  ) {
    const { count } = await tx.inventoryCount.updateMany({
      where: { id, status },
      data: { updatedAt: new Date() },
    });
    if (!count) await this.throwWrongStatus(tx, id, action);
    return tx.inventoryCount.findUniqueOrThrow({
      where: { id },
      select: { id: true, warehouseId: true, scopeCategoryIds: true },
    });
  }

  private async transition(
    id: string,
    from: InventoryStatus,
    to: InventoryStatus,
    action: string,
    data: Prisma.InventoryCountUncheckedUpdateManyInput,
  ) {
    const { count } = await this.prisma.inventoryCount.updateMany({
      where: { id, status: from },
      data: { ...data, status: to },
    });
    if (!count) await this.throwWrongStatus(this.prisma, id, action);
  }

  private async throwWrongStatus(
    db: Tx | PrismaService,
    id: string,
    action: string,
  ): Promise<never> {
    const c = await db.inventoryCount.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!c) throw new NotFoundException('Inventory count not found');
    throw new ConflictException(
      `Inventory count is ${c.status} and cannot be ${action}`,
    );
  }

  private assertInScope(
    count: CountScope,
    product: { name: string; categoryId: string },
  ) {
    if (
      count.scopeCategoryIds.length &&
      !count.scopeCategoryIds.includes(product.categoryId)
    ) {
      throw new BadRequestException(
        `"${product.name}" is outside the category being counted`,
      );
    }
  }

  private assertUnitHere(
    count: CountScope,
    serialNumber: string,
    unit: { status: SerialUnitStatus; warehouseId: string | null },
  ) {
    if (
      unit.status !== SerialUnitStatus.IN_STOCK ||
      unit.warehouseId !== count.warehouseId
    ) {
      const where =
        unit.status === SerialUnitStatus.IN_STOCK
          ? 'in stock at another warehouse'
          : unit.status;
      throw new ConflictException(
        `Serial ${serialNumber} is ${where}; resolve it (e.g. with a transfer) before counting it here`,
      );
    }
  }
}

function summarize(rows: DiffRow[]) {
  return {
    products: rows.length,
    withDifference: rows.filter(
      (r) =>
        r.difference !== 0 ||
        r.missingSerials?.length ||
        r.extraSerials?.length,
    ).length,
    shortageUnits: rows.reduce(
      (s, r) => s + (r.missingSerials?.length ?? Math.max(0, -r.difference)),
      0,
    ),
    surplusUnits: rows.reduce(
      (s, r) => s + (r.extraSerials?.length ?? Math.max(0, r.difference)),
      0,
    ),
  };
}
