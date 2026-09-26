import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { addDays, appTimezone, localIsoDate } from '../common/timezone';
import { Prisma, StockMovementType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MovementsReportQueryDto,
  PeriodQueryDto,
  SalesGroup,
  SalesQueryDto,
  StockReportQueryDto,
} from './dto/report-query.dto';
import { Cell, Report, ReportColumn } from './report';

export interface Period {
  from: string;
  to: string;
}

/** One aggregated group of sale lines. Money values are Decimals, counts are ints. */
export interface SalesRow {
  key: string;
  label: string;
  extra: string | null;
  orders: number;
  units: number;
  revenue: Prisma.Decimal;
  revenueNet: Prisma.Decimal;
  cost: Prisma.Decimal;
  returnsAmount: Prisma.Decimal | null;
  returns: number;
}

type GroupKey = SalesGroup | 'customer' | 'total';

// Only these fixed fragments ever reach SQL as raw text; user input goes in as parameters.
const GROUPS: Record<
  GroupKey,
  { key: string; label: string; extra?: string; join?: string; order: string }
> = {
  day: {
    key: `to_char(l.at, 'YYYY-MM-DD')`,
    label: `to_char(l.at, 'YYYY-MM-DD')`,
    order: 'key',
  },
  week: {
    key: `to_char(date_trunc('week', l.at), 'YYYY-MM-DD')`,
    label: `to_char(date_trunc('week', l.at), 'YYYY-MM-DD')`,
    order: 'key',
  },
  month: {
    key: `to_char(l.at, 'YYYY-MM')`,
    label: `to_char(l.at, 'YYYY-MM')`,
    order: 'key',
  },
  year: {
    key: `to_char(l.at, 'YYYY')`,
    label: `to_char(l.at, 'YYYY')`,
    order: 'key',
  },
  product: {
    key: `p2."id"`,
    label: `p2."name"`,
    extra: `p2."sku"`,
    join: `JOIN "products" p2 ON p2."id" = l."productId"`,
    order: 'revenue DESC NULLS LAST',
  },
  category: {
    key: `c."id"`,
    label: `c."name"`,
    join: `JOIN "products" p2 ON p2."id" = l."productId" JOIN "categories" c ON c."id" = p2."categoryId"`,
    order: 'revenue DESC NULLS LAST',
  },
  employee: {
    key: `COALESCE(u."id", '-')`,
    label: `COALESCE(u."name", 'Bez zaposlenog')`,
    join: `LEFT JOIN "users" u ON u."id" = l."employeeId"`,
    order: 'revenue DESC NULLS LAST',
  },
  customer: {
    key: `COALESCE(l."userId", l."customerPhone")`,
    label: `l."customerName"`,
    extra: `l."customerPhone"`,
    order: 'revenue DESC NULLS LAST',
  },
  total: { key: `'total'`, label: `'Ukupno'`, order: 'key' },
};

const SALES_TITLES: Record<SalesGroup, [string, string]> = {
  day: ['Izvještaj o prodaji po danima', 'Dan'],
  week: ['Izvještaj o prodaji po sedmicama', 'Sedmica'],
  month: ['Izvještaj o prodaji po mjesecima', 'Mjesec'],
  year: ['Izvještaj o prodaji po godinama', 'Godina'],
  product: ['Izvještaj o prodaji po proizvodima', 'Proizvod'],
  category: ['Izvještaj o prodaji po kategorijama', 'Kategorija'],
  employee: ['Izvještaj o prodaji po zaposlenima', 'Zaposleni'],
};

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  RECEIPT: 'Prijem od dobavljača',
  SALE: 'Prodaja',
  RETURN: 'Povraćaj od kupca',
  TRANSFER_OUT: 'Prenos (izlaz)',
  TRANSFER_IN: 'Prenos (ulaz)',
  ADJUSTMENT: 'Korekcija',
  INVENTORY: 'Popis',
  WARRANTY_REPLACEMENT: 'Zamjena po garanciji',
};

const STOCK_STATUS = {
  OK: 'U redu',
  LOW: 'Malo robe',
  OUT: 'Nema na stanju',
} as const;

const dmy = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return d ? `${d}.${m}.${y}.` : m ? `${m}.${y}.` : `${y}.`;
};

const profitOf = (r: Pick<SalesRow, 'revenueNet' | 'cost'>) => {
  const net = new Prisma.Decimal(r.revenueNet ?? 0);
  const profit = net.sub(r.cost ?? 0);
  return {
    profit,
    margin: net.isZero() ? null : profit.div(net).mul(100).toDecimalPlaces(1),
  };
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  period(q: PeriodQueryDto, defaultDays = 30): Period {
    const to = q.to ?? localIsoDate();
    const from = q.from ?? addDays(to, -(defaultDays - 1));
    if (from > to) throw new BadRequestException('from must not be after to');
    if (addDays(from, 3660) < to)
      throw new BadRequestException('Period is limited to 10 years');
    return { from, to };
  }

  subtitle({ from, to }: Period) {
    return from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`;
  }

  /**
   * Sales are counted when goods leave (shipment); an approved return counts negative on
   * the day it was decided. Cost is the unit cost frozen at shipment (or, for orders
   * shipped before that existed, today's purchase price).
   */
  async salesRows(group: GroupKey, { from, to }: Period): Promise<SalesRow[]> {
    const tz = appTimezone();
    const g = GROUPS[group];
    const confirmer = Prisma.sql`(SELECT e."userId" FROM "order_events" e
      WHERE e."orderId" = o."id" AND e."type" = 'CONFIRMED' ORDER BY e."createdAt" LIMIT 1)`;
    return this.prisma.$queryRaw<SalesRow[]>`
      WITH lines AS (
        SELECT ((o."shippedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS at,
               oi."productId", o."id" AS "orderId", NULL::text AS "returnId",
               o."userId", o."customerName", o."customerPhone",
               COALESCE(${confirmer}, o."createdById") AS "employeeId",
               oi."quantity" AS units, oi."lineTotal" AS gross, oi."vatPercent" AS vat,
               oi."quantity" * COALESCE(oi."unitCost", p."purchasePrice") AS cost
        FROM "order_items" oi
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "products" p ON p."id" = oi."productId"
        WHERE o."shippedAt" IS NOT NULL
        UNION ALL
        SELECT ((r."decidedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}),
               ri."productId", o."id", r."id",
               o."userId", o."customerName", o."customerPhone",
               COALESCE(${confirmer}, o."createdById"),
               -ri."quantity", -(ri."quantity" * oi."unitPrice"), oi."vatPercent",
               -- restocked goods give their cost back; scrapped ones stay a loss
               CASE WHEN ri."decision" = 'RESTOCK'
                    THEN -(ri."quantity" * COALESCE(oi."unitCost", p."purchasePrice")) ELSE 0 END
        FROM "return_items" ri
        JOIN "returns" r ON r."id" = ri."returnId"
        JOIN "order_items" oi ON oi."id" = ri."orderItemId"
        JOIN "orders" o ON o."id" = oi."orderId"
        JOIN "products" p ON p."id" = ri."productId"
        WHERE r."status" IN ('APPROVED', 'REFUNDED') AND ri."decision" <> 'REJECT'
      )
      SELECT ${Prisma.raw(g.key)} AS key,
             MAX(${Prisma.raw(g.label)}) AS label,
             MAX(${Prisma.raw(g.extra ?? 'NULL::text')}) AS extra,
             (COUNT(DISTINCT l."orderId") FILTER (WHERE l.units > 0))::int AS orders,
             SUM(l.units)::int AS units,
             ROUND(SUM(l.gross), 2) AS revenue,
             ROUND(SUM(l.gross / (1 + l.vat / 100)), 2) AS "revenueNet",
             ROUND(SUM(l.cost), 2) AS cost,
             ROUND(SUM(-l.gross) FILTER (WHERE l.units < 0), 2) AS "returnsAmount",
             (COUNT(DISTINCT l."returnId"))::int AS returns
      FROM lines l ${Prisma.raw(g.join ?? '')}
      WHERE l.at::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
      ORDER BY ${Prisma.raw(g.order)}`;
  }

  async sales(q: SalesQueryDto): Promise<Report> {
    const period = this.period(q);
    const [rows, [total]] = [
      await this.salesRows(q.groupBy, period),
      await this.salesRows('total', period),
    ];
    const [title, first] = SALES_TITLES[q.groupBy];
    const isTime = ['day', 'week', 'month', 'year'].includes(q.groupBy);
    const columns: ReportColumn[] = [
      { key: 'label', label: first, type: 'text' },
      ...(q.groupBy === 'product'
        ? [{ key: 'extra', label: 'Šifra', type: 'text' as const }]
        : []),
      { key: 'orders', label: 'Narudžbe', type: 'int' },
      { key: 'units', label: 'Komada', type: 'int' },
      { key: 'revenue', label: 'Promet sa PDV', type: 'money' },
      { key: 'revenueNet', label: 'Promet bez PDV', type: 'money' },
      { key: 'cost', label: 'Nabavna vrijednost', type: 'money' },
      { key: 'profit', label: 'Bruto dobit', type: 'money' },
      { key: 'margin', label: 'Marža', type: 'percent' },
    ];
    const shape = (r: SalesRow, label: string): Record<string, Cell> => ({
      key: r.key,
      label,
      extra: r.extra,
      orders: r.orders,
      units: r.units,
      revenue: r.revenue,
      revenueNet: r.revenueNet,
      cost: r.cost,
      ...profitOf(r),
    });
    const periodLabel = (key: string) =>
      q.groupBy === 'week' ? `od ${dmy(key)}` : dmy(key);
    return {
      title,
      subtitle: this.subtitle(period),
      columns,
      rows: rows.map((r) => shape(r, isTime ? periodLabel(r.key) : r.label)),
      totals: total ? shape(total, 'Ukupno') : undefined,
    };
  }

  async customers(q: PeriodQueryDto): Promise<Report> {
    const period = this.period(q);
    const [rows, [total]] = [
      await this.salesRows('customer', period),
      await this.salesRows('total', period),
    ];
    const shape = (r: SalesRow, label: string): Record<string, Cell> => ({
      label,
      extra: r.extra,
      orders: r.orders,
      revenue: r.revenue,
      returns: r.returns,
      returnsAmount: r.returnsAmount ?? 0,
    });
    return {
      title: 'Izvještaj o kupcima',
      subtitle: this.subtitle(period),
      columns: [
        { key: 'label', label: 'Kupac', type: 'text' },
        { key: 'extra', label: 'Telefon', type: 'text' },
        { key: 'orders', label: 'Narudžbe', type: 'int' },
        { key: 'revenue', label: 'Promet sa PDV', type: 'money' },
        { key: 'returns', label: 'Povraćaji', type: 'int' },
        { key: 'returnsAmount', label: 'Iznos povraćaja', type: 'money' },
      ],
      rows: rows.map((r) => shape(r, r.label)),
      totals: total ? { ...shape(total, 'Ukupno'), extra: null } : undefined,
    };
  }

  async suppliers(q: PeriodQueryDto): Promise<Report> {
    const period = this.period(q);
    const tz = appTimezone();
    const rows = await this.prisma.$queryRaw<
      {
        label: string;
        receivings: number;
        units: number;
        amount: Prisma.Decimal;
      }[]
    >`
      SELECT s."name" AS label,
             COUNT(DISTINCT r."id")::int AS receivings,
             SUM(ri."quantity")::int AS units,
             ROUND(SUM(ri."quantity" * ri."purchasePrice"), 2) AS amount
      FROM "receivings" r
      JOIN "suppliers" s ON s."id" = r."supplierId"
      JOIN "receiving_items" ri ON ri."receivingId" = r."id"
      WHERE r."status" = 'CONFIRMED'
        AND ((r."confirmedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date BETWEEN ${period.from}::date AND ${period.to}::date
      GROUP BY s."id", s."name"
      ORDER BY amount DESC`;
    const sum = (k: 'receivings' | 'units') =>
      rows.reduce((s, r) => s + r[k], 0);
    return {
      title: 'Izvještaj o dobavljačima',
      subtitle: this.subtitle(period),
      columns: [
        { key: 'label', label: 'Dobavljač', type: 'text' },
        { key: 'receivings', label: 'Prijemi', type: 'int' },
        { key: 'units', label: 'Komada', type: 'int' },
        { key: 'amount', label: 'Nabavna vrijednost', type: 'money' },
      ],
      rows,
      totals: {
        label: 'Ukupno',
        receivings: sum('receivings'),
        units: sum('units'),
        amount: rows.reduce((s, r) => s.add(r.amount), new Prisma.Decimal(0)),
      },
    };
  }

  /** Current stock with its value at cost and at retail price (snapshot, no period). */
  async stock(q: StockReportQueryDto): Promise<Report> {
    const categoryIds = q.categoryId
      ? await this.categories.withDescendantIds(q.categoryId)
      : null;
    const rows = await this.prisma.$queryRaw<
      {
        label: string;
        extra: string;
        category: string;
        quantity: number;
        reserved: number;
        costValue: Prisma.Decimal;
        retailValue: Prisma.Decimal;
        stockAlert: keyof typeof STOCK_STATUS;
      }[]
    >`
      SELECT p."name" AS label, p."sku" AS extra, c."name" AS category,
             COALESCE(SUM(st."quantity"), 0)::int AS quantity,
             COALESCE(SUM(st."reserved"), 0)::int AS reserved,
             ROUND(COALESCE(SUM(st."quantity"), 0) * p."purchasePrice", 2) AS "costValue",
             ROUND(COALESCE(SUM(st."quantity"), 0) * COALESCE(p."discountPrice", p."sellingPrice"), 2) AS "retailValue",
             p."stockAlert"::text AS "stockAlert"
      FROM "products" p
      JOIN "categories" c ON c."id" = p."categoryId"
      LEFT JOIN "stock" st ON st."productId" = p."id"
        ${q.warehouseId ? Prisma.sql`AND st."warehouseId" = ${q.warehouseId}` : Prisma.empty}
      WHERE NOT p."isArchived"
        ${categoryIds ? Prisma.sql`AND c."id" = ANY(${categoryIds})` : Prisma.empty}
      GROUP BY p."id", c."name"
      HAVING ${
        q.onlyLow
          ? Prisma.sql`p."stockAlert" <> 'OK'`
          : Prisma.sql`COALESCE(SUM(st."quantity"), 0) > 0 OR p."stockAlert" <> 'OK'`
      }
      ORDER BY p."name"`;

    const shaped = rows.map((r) => ({
      ...r,
      available: r.quantity - r.reserved,
      status: STOCK_STATUS[r.stockAlert],
    }));
    const sumInt = (k: 'quantity' | 'reserved' | 'available') =>
      shaped.reduce((s, r) => s + r[k], 0);
    const sumMoney = (k: 'costValue' | 'retailValue') =>
      shaped.reduce((s, r) => s.add(r[k]), new Prisma.Decimal(0));
    return {
      title: 'Izvještaj o stanju zaliha',
      subtitle: `Stanje na dan ${dmy(localIsoDate())}`,
      columns: [
        { key: 'label', label: 'Proizvod', type: 'text' },
        { key: 'extra', label: 'Šifra', type: 'text' },
        { key: 'category', label: 'Kategorija', type: 'text' },
        { key: 'quantity', label: 'Količina', type: 'int' },
        { key: 'reserved', label: 'Rezervisano', type: 'int' },
        { key: 'available', label: 'Dostupno', type: 'int' },
        { key: 'costValue', label: 'Nabavna vrijednost', type: 'money' },
        { key: 'retailValue', label: 'Prodajna vrijednost', type: 'money' },
        { key: 'status', label: 'Status', type: 'text' },
      ],
      rows: shaped.map(({ stockAlert: _s, ...r }) => r),
      totals: {
        label: 'Ukupno',
        quantity: sumInt('quantity'),
        reserved: sumInt('reserved'),
        available: sumInt('available'),
        costValue: sumMoney('costValue'),
        retailValue: sumMoney('retailValue'),
      },
    };
  }

  /** Units in and out by kind of movement over a period (ТЗ п.24: prijem, izdavanje, prenosi, popis). */
  async movements(q: MovementsReportQueryDto): Promise<Report> {
    const period = this.period(q);
    const tz = appTimezone();
    const rows = await this.prisma.$queryRaw<
      {
        type: StockMovementType;
        inUnits: number | null;
        outUnits: number | null;
        entries: number;
      }[]
    >`
      SELECT m."type"::text AS type,
             (SUM(m."quantity") FILTER (WHERE m."quantity" > 0))::int AS "inUnits",
             (-SUM(m."quantity") FILTER (WHERE m."quantity" < 0))::int AS "outUnits",
             COUNT(*)::int AS entries
      FROM "stock_movements" m
      WHERE ((m."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date BETWEEN ${period.from}::date AND ${period.to}::date
        ${q.warehouseId ? Prisma.sql`AND m."warehouseId" = ${q.warehouseId}` : Prisma.empty}
      GROUP BY m."type"
      ORDER BY m."type"`;
    const shaped = rows.map((r) => ({
      label: MOVEMENT_LABELS[r.type],
      inUnits: r.inUnits ?? 0,
      outUnits: r.outUnits ?? 0,
      entries: r.entries,
    }));
    const sum = (k: 'inUnits' | 'outUnits' | 'entries') =>
      shaped.reduce((s, r) => s + r[k], 0);
    return {
      title: 'Izvještaj o kretanju robe',
      subtitle: this.subtitle(period),
      columns: [
        { key: 'label', label: 'Vrsta', type: 'text' },
        { key: 'inUnits', label: 'Ulaz (kom.)', type: 'int' },
        { key: 'outUnits', label: 'Izlaz (kom.)', type: 'int' },
        { key: 'entries', label: 'Broj knjiženja', type: 'int' },
      ],
      rows: shaped,
      totals: {
        label: 'Ukupno',
        inUnits: sum('inUnits'),
        outUnits: sum('outUnits'),
        entries: sum('entries'),
      },
    };
  }
}
