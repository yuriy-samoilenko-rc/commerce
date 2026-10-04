import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService, changedKeys } from '../audit/audit.service';
import { formatReceivingNumber } from '../common/document-numbers';
import { conflict } from '../common/errors';
import { Prisma, ReceivingStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

/** Purchases from one supplier: confirmed receivings only (drafts are not bought yet). */
export interface SupplierStats {
  receivings: number;
  units: number;
  amount: Prisma.Decimal;
  lastReceivedAt: Date | null;
}

const RECENT_RECEIVINGS = 20;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** All suppliers with their purchase totals; the receiving form filters active ones. */
  async findAll() {
    const [suppliers, stats] = await Promise.all([
      this.prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      this.stats(),
    ]);
    return suppliers.map((s) => ({
      ...s,
      stats: stats.get(s.id) ?? emptyStats(),
    }));
  }

  /** The supplier card: contacts, totals, distinct products and the latest receivings. */
  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const confirmed = { supplierId: id, status: ReceivingStatus.CONFIRMED };
    const [stats, products, receivings] = await Promise.all([
      this.stats(id),
      this.prisma.receivingItem.findMany({
        where: { receiving: confirmed },
        distinct: ['productId'],
        select: { productId: true },
      }),
      this.prisma.receiving.findMany({
        where: { supplierId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_RECEIVINGS,
        select: {
          id: true,
          number: true,
          status: true,
          supplierDocNumber: true,
          createdAt: true,
          confirmedAt: true,
          warehouse: { select: { id: true, name: true } },
          items: { select: { quantity: true, purchasePrice: true } },
        },
      }),
    ]);
    return {
      ...supplier,
      stats: { ...(stats.get(id) ?? emptyStats()), products: products.length },
      receivings: receivings.map(({ items, ...r }) => ({
        ...r,
        number: formatReceivingNumber(r.number),
        units: items.reduce((n, i) => n + i.quantity, 0),
        amount: items.reduce(
          (sum, i) => sum.add(i.purchasePrice.mul(i.quantity)),
          new Prisma.Decimal(0),
        ),
      })),
    };
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: toData(dto) });
  }

  update(id: string, dto: UpdateSupplierDto) {
    return this.audit.trackUpdate(
      () => this.prisma.supplier.findUnique({ where: { id } }),
      () => this.prisma.supplier.update({ where: { id }, data: toData(dto) }),
      changedKeys(dto),
    );
  }

  /** Only a supplier nobody has used yet; one with history is deactivated instead. */
  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      select: { _count: { select: { receivings: true, documents: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier._count.receivings || supplier._count.documents) {
      throw conflict(
        'SUPPLIER_IN_USE',
        'Supplier has receivings or documents; deactivate it instead',
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
  }

  private async stats(supplierId?: string) {
    const rows = await this.prisma.$queryRaw<
      {
        supplierId: string;
        receivings: number;
        units: number;
        amount: Prisma.Decimal;
        lastReceivedAt: Date | null;
      }[]
    >`
      SELECT r."supplierId",
             COUNT(DISTINCT r."id")::int AS receivings,
             COALESCE(SUM(ri."quantity"), 0)::int AS units,
             COALESCE(ROUND(SUM(ri."quantity" * ri."purchasePrice"), 2), 0) AS amount,
             MAX(r."confirmedAt") AS "lastReceivedAt"
      FROM "receivings" r
      LEFT JOIN "receiving_items" ri ON ri."receivingId" = r."id"
      WHERE r."status" = 'CONFIRMED'
        ${supplierId ? Prisma.sql`AND r."supplierId" = ${supplierId}` : Prisma.empty}
      GROUP BY r."supplierId"`;
    return new Map<string, SupplierStats>(
      rows.map(({ supplierId: id, ...s }) => [id, s]),
    );
  }
}

const emptyStats = (): SupplierStats => ({
  receivings: 0,
  units: 0,
  amount: new Prisma.Decimal(0),
  lastReceivedAt: null,
});

// contractUntil: undefined = leave unchanged, null = clear
function toData<T extends { contractUntil?: string | null }>({
  contractUntil,
  ...rest
}: T) {
  return {
    ...rest,
    ...(contractUntil !== undefined && {
      contractUntil: contractUntil === null ? null : new Date(contractUntil),
    }),
  };
}
