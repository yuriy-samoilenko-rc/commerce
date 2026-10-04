import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CategoryTree, Report, WarehouseList } from "@/lib/backend-types";
import { flattenCategories, indented } from "@/lib/categories";
import { apiServer, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ReportChart } from "./report-chart";
import { ReportTable } from "./report-table";

export const metadata: Metadata = { title: "Izvještaji" };

const FINANCE = ["ADMIN", "MANAGER", "ACCOUNTANT"];
const KINDS = {
  prodaja: { label: "Prodaja", path: "sales", finance: true, period: true },
  kupci: { label: "Kupci", path: "customers", finance: true, period: true },
  dobavljaci: { label: "Dobavljači", path: "suppliers", finance: true, period: true },
  zalihe: { label: "Zalihe", path: "stock", finance: false, period: false },
  kretanja: { label: "Kretanje robe", path: "movements", finance: false, period: true },
} as const;
type Kind = keyof typeof KINDS;

const GROUPS = {
  day: "Po danima",
  week: "Po sedmicama",
  month: "Po mjesecima",
  year: "Po godinama",
  product: "Po proizvodima",
  category: "Po kategorijama",
  employee: "Po zaposlenima",
};
const TIME_GROUPS = ["day", "week", "month", "year"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today in Montenegro, YYYY-MM-DD, and simple date arithmetic on such days. */
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Podgorica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shift = (day: string, days: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function presets() {
  const t = today();
  const [y, m] = t.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const monthStart = `${y}-${pad(m)}-01`;
  return [
    { label: "Danas", from: t, to: t },
    { label: "7 dana", from: shift(t, -6), to: t },
    { label: "30 dana", from: shift(t, -29), to: t },
    { label: "Ovaj mjesec", from: monthStart, to: t },
    { label: "Prošli mjesec", from: `${prevMonth}-01`, to: shift(monthStart, -1) },
    { label: "Ova godina", from: `${y}-01-01`, to: t },
  ];
}

/**
 * Chart points; by day, the days without sales are there too (as zero), so bars that
 * look neighbouring really are neighbouring days. Long ranges are better read by week.
 */
function chartPoints(report: Report, groupBy: string, from: string, to: string) {
  const points = report.rows.map((r) => ({
    key: String(r.key ?? ""),
    label: String(r.label),
    revenue: Number(r.revenue ?? 0),
    orders: Number(r.orders ?? 0),
  }));
  if (groupBy !== "day") return points;
  const byDay = new Map(points.map((p) => [p.key.slice(0, 10), p]));
  const days: typeof points = [];
  for (let d = from; d <= to && days.length < 370; d = shift(d, 1)) {
    days.push(byDay.get(d) ?? { key: d, label: `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.`, revenue: 0, orders: 0 });
  }
  return days;
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/izvjestaji">) {
  const user = await requireUser("/admin/izvjestaji");
  const sp = await searchParams;
  const finance = FINANCE.includes(user.role);
  const allowed = (Object.keys(KINDS) as Kind[]).filter((k) => finance || !KINDS[k].finance);
  const kind = (pickParam(sp.vrsta, allowed) as Kind | undefined) ?? allowed[0];
  const spec = KINDS[kind];

  const [warehouses, categories] = await Promise.all([
    apiServer<WarehouseList>("/warehouses"),
    apiServer<CategoryTree>("/categories"),
  ]);
  const flat = flattenCategories(categories.data ?? []);
  const t = today();
  const params = {
    from: typeof sp.from === "string" && DAY.test(sp.from) ? sp.from : shift(t, -29),
    to: typeof sp.to === "string" && DAY.test(sp.to) ? sp.to : t,
    groupBy: pickParam(sp.groupBy, GROUPS) ?? "day",
    warehouseId: pickParam(sp.warehouseId, (warehouses.data ?? []).map((w) => w.id)),
    categoryId: pickParam(sp.categoryId, flat.map((c) => c.id)),
    onlyLow: sp.onlyLow === "true" ? "true" : undefined,
  };

  const query = new URLSearchParams();
  if (spec.period) {
    query.set("from", params.from);
    query.set("to", params.to);
  }
  if (kind === "prodaja") query.set("groupBy", params.groupBy);
  if ((kind === "zalihe" || kind === "kretanja") && params.warehouseId) query.set("warehouseId", params.warehouseId);
  if (kind === "zalihe" && params.categoryId) query.set("categoryId", params.categoryId);
  if (kind === "zalihe" && params.onlyLow) query.set("onlyLow", "true");

  const { status, data: report } = await apiServer<Report>(`/admin/reports/${spec.path}?${query}`);
  if (!report) throw new Error(`Report failed with status ${status}`);
  const exportHref = (format: string) => `/api/backend/admin/reports/${spec.path}?${query}&format=${format}`;
  const pageHref = (change: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { vrsta: kind, from: params.from, to: params.to, groupBy: params.groupBy, ...change };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/izvjestaji?${q}`;
  };
  const chart = kind === "prodaja" && TIME_GROUPS.includes(params.groupBy) && report.rows.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Izvještaji</h1>

      <nav aria-label="Vrsta izvještaja" className="flex flex-wrap gap-1 border-b">
        {allowed.map((k) => (
          <Link
            key={k}
            href={pageHref({ vrsta: k })}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              k === kind ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {KINDS[k].label}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="vrsta" value={kind} />
        {spec.period && (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Od
              <Input type="date" name="from" defaultValue={params.from} max={params.to} className="w-40" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Do
              <Input type="date" name="to" defaultValue={params.to} min={params.from} className="w-40" />
            </label>
          </>
        )}
        {kind === "prodaja" && <FilterSelect name="groupBy" label="Grupisanje" value={params.groupBy} options={GROUPS} />}
        {(kind === "zalihe" || kind === "kretanja") && (
          <FilterSelect
            name="warehouseId"
            label="Skladište"
            value={params.warehouseId}
            options={(warehouses.data ?? []).map((w): [string, string] => [w.id, w.name])}
            all="Sva skladišta"
          />
        )}
        {kind === "zalihe" && (
          <>
            <FilterSelect
              name="categoryId"
              label="Kategorija"
              value={params.categoryId}
              options={flat.map((c): [string, string] => [c.id, indented(c)])}
              all="Sve kategorije"
            />
            <label className="flex h-9 items-center gap-2 text-sm">
              <input type="checkbox" name="onlyLow" value="true" defaultChecked={!!params.onlyLow} className="size-4" />
              Samo malo robe
            </label>
          </>
        )}
        <button type="submit" className={buttonVariants()}>
          Prikaži
        </button>
      </form>

      {spec.period && (
        <div className="flex flex-wrap gap-1.5" aria-label="Brzi izbor perioda">
          {presets().map((p) => (
            <Link
              key={p.label}
              href={pageHref({ from: p.from, to: p.to })}
              className={buttonVariants({ variant: p.from === params.from && p.to === params.to ? "secondary" : "ghost", size: "sm" })}
            >
              {p.label}
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{report.title}</CardTitle>
            <CardDescription>{report.subtitle}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["xlsx", "Excel"],
              ["csv", "CSV"],
              ["pdf", "PDF"],
            ].map(([format, label]) => (
              <a key={format} href={exportHref(format)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Download /> {label}
              </a>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {chart && <ReportChart data={chartPoints(report, params.groupBy, params.from, params.to)} />}
          <ReportTable report={report} />
        </CardContent>
      </Card>
    </div>
  );
}
