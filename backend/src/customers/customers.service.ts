import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { randomBytes } from 'node:crypto';
import { AuditService, changedKeys } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { formatReturnNumber } from '../common/document-numbers';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/users.service';

export const CUSTOMER_SORTS = ['name', 'spent', 'orders', 'lastOrder'] as const;

export class CustomerQueryDto extends PaginationQueryDto {
  /** Name, email or phone. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(CUSTOMER_SORTS)
  sort?: (typeof CUSTOMER_SORTS)[number];
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateCustomerDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^(\+?[0-9 ()-]{6,20})?$/)
  phone?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) deliveryAddress?:
    string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) staffNote?:
    string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateCustomerDto extends UpdateCustomerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  declare name: string;
  @Transform(trim) @IsEmail() email: string;
}

/** Orders that reached the customer: what they really bought. */
const BOUGHT = Prisma.sql`('DELIVERED', 'COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED')`;

type StatsRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  orders: number;
  spent: Prisma.Decimal;
  lastOrderAt: Date | null;
  returns: number;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Customer accounts with what they bought. `spent` is the value of delivered
   * orders minus refunds; phone and address fall back to the latest order's.
   */
  async list(q: CustomerQueryDto) {
    const search = q.search?.trim();
    const like = search
      ? `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      : null;
    const where = like
      ? Prisma.sql`AND (u."name" ILIKE ${like} OR u."email" ILIKE ${like} OR u."phone" ILIKE ${like} OR lo."customerPhone" ILIKE ${like})`
      : Prisma.empty;
    const order = {
      name: Prisma.sql`u."name" ASC`,
      spent: Prisma.sql`spent DESC, u."name" ASC`,
      orders: Prisma.sql`orders DESC, u."name" ASC`,
      lastOrder: Prisma.sql`"lastOrderAt" DESC NULLS LAST, u."name" ASC`,
    }[q.sort ?? 'name'];
    const from = Prisma.sql`
      FROM "users" u
      LEFT JOIN LATERAL (
        SELECT o."customerPhone", o."deliveryAddress" FROM "orders" o
        WHERE o."userId" = u."id" ORDER BY o."createdAt" DESC LIMIT 1
      ) lo ON true`;
    const filter = Prisma.sql`WHERE u."role" = 'CUSTOMER' ${where}`;
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<StatsRow[]>`
        SELECT u."id", u."name", u."email", u."isActive", u."createdAt",
               COALESCE(u."phone", lo."customerPhone") AS phone,
               COALESCE(u."deliveryAddress", lo."deliveryAddress") AS address,
               COALESCE(s.orders, 0)::int AS orders,
               COALESCE(s.bought, 0) - COALESCE(r.refunded, 0) AS spent,
               s."lastOrderAt",
               COALESCE(r.returns, 0)::int AS returns
        ${from}
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE o."status" <> 'CANCELLED') AS orders,
                 SUM(o."total") FILTER (WHERE o."status" IN ${BOUGHT}) AS bought,
                 MAX(o."createdAt") AS "lastOrderAt"
          FROM "orders" o WHERE o."userId" = u."id"
        ) s ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE rt."status" <> 'CANCELLED') AS returns,
                 SUM(rt."refundAmount") FILTER (WHERE rt."status" = 'REFUNDED') AS refunded
          FROM "returns" rt JOIN "orders" o ON o."id" = rt."orderId" WHERE o."userId" = u."id"
        ) r ON true
        ${filter}
        ORDER BY ${order}
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      this.prisma.$queryRaw<
        { total: number }[]
      >`SELECT COUNT(*)::int AS total ${from} ${filter}`,
    ]);
    return { items: rows, total, page: q.page, limit: q.limit };
  }

  /** The customer card: contacts, the staff note, totals, orders, products bought and returns. */
  async card(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { ...publicUserSelect, staffNote: true },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const [orders, products, returns] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          deliveryMethod: true,
          total: true,
          createdAt: true,
          customerPhone: true,
          deliveryAddress: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.$queryRaw<
        {
          productId: string;
          name: string;
          sku: string;
          quantity: number;
          amount: Prisma.Decimal;
          lastAt: Date;
        }[]
      >`
        SELECT oi."productId", MAX(oi."productName") AS name, MAX(oi."sku") AS sku,
               SUM(oi."quantity")::int AS quantity, SUM(oi."lineTotal") AS amount,
               MAX(o."createdAt") AS "lastAt"
        FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
        WHERE o."userId" = ${id} AND o."status" IN ${BOUGHT}
        GROUP BY oi."productId"
        ORDER BY amount DESC
        LIMIT 50`,
      this.prisma.return.findMany({
        where: { order: { userId: id } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          refundAmount: true,
          createdAt: true,
          order: { select: { id: true, number: true } },
        },
      }),
    ]);

    const bought = orders.filter((o) =>
      ['DELIVERED', 'COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED'].includes(
        o.status,
      ),
    );
    const refunded = returns
      .filter((r) => r.status === 'REFUNDED')
      .reduce((s, r) => s.add(r.refundAmount ?? 0), new Prisma.Decimal(0));
    const spent = bought
      .reduce((s, o) => s.add(o.total), new Prisma.Decimal(0))
      .sub(refunded);
    const latest = orders[0];

    return {
      ...user,
      // Contacts the account lacks come from the latest order, as the order form does.
      phone: user.phone ?? latest?.customerPhone ?? null,
      deliveryAddress: user.deliveryAddress ?? latest?.deliveryAddress ?? null,
      stats: {
        orders: orders.filter((o) => o.status !== 'CANCELLED').length,
        delivered: bought.length,
        spent,
        average: bought.length
          ? spent.div(bought.length).toDecimalPlaces(2)
          : new Prisma.Decimal(0),
        returns: returns.filter((r) => r.status !== 'CANCELLED').length,
        lastOrderAt: latest?.createdAt ?? null,
      },
      orders: orders.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        deliveryMethod: o.deliveryMethod,
        total: o.total,
        createdAt: o.createdAt,
        items: o._count.items,
      })),
      products,
      returns: returns.map((r) => ({
        ...r,
        number: formatReturnNumber(r.number),
      })),
    };
  }

  /**
   * An account for someone who orders by phone or in the shop. It gets an unusable
   * random password (the customer sets one from the emailed link) and their earlier
   * orders under the same email, so the history starts complete.
   */
  async create(dto: CreateCustomerDto) {
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString('base64url'),
      12,
    );
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: dto.name,
          role: Role.CUSTOMER,
          passwordHash,
          phone: dto.phone || null,
          deliveryAddress: dto.deliveryAddress || null,
          staffNote: dto.staffNote || null,
          isActive: dto.isActive ?? true,
        },
        select: { id: true, email: true, name: true },
      });
      const linked = await tx.order.updateMany({
        where: {
          userId: null,
          customerEmail: { equals: email, mode: 'insensitive' },
        },
        data: { userId: user.id },
      });
      return { ...user, linkedOrders: linked.count };
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.assertCustomer(id);
    const data = {
      ...dto,
      ...(dto.phone !== undefined && { phone: dto.phone || null }),
      ...(dto.deliveryAddress !== undefined && {
        deliveryAddress: dto.deliveryAddress || null,
      }),
      ...(dto.staffNote !== undefined && { staffNote: dto.staffNote || null }),
    };
    await this.audit.trackUpdate(
      () =>
        this.prisma.user.findUnique({
          where: { id },
          select: { ...publicUserSelect, staffNote: true },
        }),
      () => this.prisma.user.update({ where: { id }, data }),
      changedKeys(dto),
    );
    return this.card(id);
  }

  private async assertCustomer(id: string) {
    const found = await this.prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Customer not found');
  }
}
