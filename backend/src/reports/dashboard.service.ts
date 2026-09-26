import { Injectable } from '@nestjs/common';
import { addDays, appTimezone, localIsoDate } from '../common/timezone';
import {
  OrderStatus,
  Prisma,
  StockAlertLevel,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { ReportsService, SalesRow } from './reports.service';

const zero = new Prisma.Decimal(0);

/** Admin home screen (ТЗ п.19, UI п.2). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly stock: StockService,
  ) {}

  async overview() {
    const today = localIsoDate();
    const tz = appTimezone();
    const monthStart = firstOfMonthMonthsAgo(today, 11);

    const [todayTotal] = await this.reports.salesRows('total', {
      from: today,
      to: today,
    });
    const [ordersToday] = await this.prisma.$queryRaw<
      { count: number; value: Prisma.Decimal | null }[]
    >`
      SELECT COUNT(*)::int AS count, SUM("total") AS value FROM "orders"
      WHERE "status" <> 'CANCELLED'
        AND (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date = ${today}::date`;
    const byStatus = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        status: {
          in: [OrderStatus.NEW, OrderStatus.PICKING, OrderStatus.READY_TO_SHIP],
        },
      },
      _count: { _all: true },
    });
    const statusCount = (s: OrderStatus) =>
      byStatus.find((b) => b.status === s)?._count._all ?? 0;
    const [stockTotals] = await this.prisma.$queryRaw<
      { units: number; products: number }[]
    >`
      SELECT COALESCE(SUM(s."quantity"), 0)::int AS units,
             COUNT(DISTINCT s."productId") FILTER (WHERE s."quantity" > 0)::int AS products
      FROM "stock" s JOIN "warehouses" w ON w."id" = s."warehouseId" WHERE w."isActive"`;
    const lowStockCount = await this.prisma.product.count({
      where: {
        isArchived: false,
        stockAlert: { in: [StockAlertLevel.LOW, StockAlertLevel.OUT] },
      },
    });

    const daily = await this.reports.salesRows('day', {
      from: addDays(today, -29),
      to: today,
    });
    const monthly = await this.reports.salesRows('month', {
      from: monthStart,
      to: today,
    });
    const top = await this.reports.salesRows('product', {
      from: addDays(today, -29),
      to: today,
    });

    const lowStockProducts = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        sku: string;
        stockAlert: string;
        available: number;
      }[]
    >`
      SELECT p."id", p."name", p."sku", p."stockAlert"::text AS "stockAlert",
             COALESCE(SUM(s."quantity" - s."reserved") FILTER (WHERE w."isActive"), 0)::int AS available
      FROM "products" p
      LEFT JOIN "stock" s ON s."productId" = p."id"
      LEFT JOIN "warehouses" w ON w."id" = s."warehouseId"
      WHERE NOT p."isArchived" AND p."stockAlert" <> 'OK'
      GROUP BY p."id"
      ORDER BY available, p."name"
      LIMIT 10`;
    const latestOrders = await this.prisma.order.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        customerName: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const latestMovements = (
      await this.stock.listMovements({ page: 1, limit: 10 })
    ).items;

    return {
      date: today,
      cards: {
        salesToday: todayTotal?.revenue ?? zero,
        salesTodayOrders: todayTotal?.orders ?? 0,
        ordersToday: ordersToday.count,
        ordersTodayValue: ordersToday.value ?? zero,
        newOrders: statusCount(OrderStatus.NEW),
        picking: statusCount(OrderStatus.PICKING),
        readyToShip: statusCount(OrderStatus.READY_TO_SHIP),
        unitsInStock: stockTotals.units,
        productsInStock: stockTotals.products,
        lowStock: lowStockCount,
      },
      // Every day/month is present, with zeros, so charts have no gaps.
      salesByDay: fill(daily, dates(addDays(today, -29), today)),
      salesByMonth: fill(monthly, months(monthStart, today)),
      topProducts: [...top]
        .sort((a, b) => b.units - a.units)
        .slice(0, 5)
        .map((r) => ({
          productId: r.key,
          name: r.label,
          sku: r.extra,
          units: r.units,
          revenue: r.revenue,
        })),
      lowStockProducts,
      latestOrders,
      latestMovements,
    };
  }
}

function fill(rows: SalesRow[], keys: string[]) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return keys.map((key) => {
    const r = byKey.get(key);
    return {
      period: key,
      orders: r?.orders ?? 0,
      units: r?.units ?? 0,
      revenue: r?.revenue ?? zero,
    };
  });
}

function dates(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function firstOfMonthMonthsAgo(today: string, back: number) {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 10);
}

function months(from: string, to: string) {
  const out: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; ; i++) {
    const key = new Date(Date.UTC(fy, fm - 1 + i, 1)).toISOString().slice(0, 7);
    if (key > end) break;
    out.push(key);
  }
  return out;
}
