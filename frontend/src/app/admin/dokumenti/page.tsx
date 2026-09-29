import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DocumentList, SupplierList, WarehouseList } from "@/lib/backend-types";
import { count, dateTime, money } from "@/lib/format";
import { DOCUMENT_STATUS, DOCUMENT_TYPE } from "@/lib/labels";
import { apiServer } from "@/lib/session";

export const metadata: Metadata = { title: "Dokumenti" };

const LIMIT = 25;
const SORTS = ["issuedAt", "number", "type", "warehouse", "partner", "total"] as const;
type Sort = (typeof SORTS)[number];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** "Poništi filtere" keeps only the chosen order. */
const NO_FILTERS = {
  search: undefined,
  partner: undefined,
  type: undefined,
  status: undefined,
  warehouseId: undefined,
  supplierId: undefined,
  from: undefined,
  to: undefined,
};

type Doc = DocumentList["items"][number];

/** The business record a document was issued for, as a link to its screen. */
function source(d: Doc) {
  const link = (href: string, text: string) => (
    <Link href={href} className="underline-offset-4 hover:underline">
      {text}
    </Link>
  );
  if (d.returnId) return link(`/admin/povracaji/${d.returnId}`, "Povraćaj");
  if (d.orderId) return link(`/admin/narudzbe/${d.orderId}`, "Narudžba");
  if (d.receivingId) return link(`/admin/prijem/${d.receivingId}`, "Prijem");
  if (d.transferId) return link(`/admin/prenos/${d.transferId}`, "Prenos");
  if (d.inventoryCountId) return link(`/admin/popis/${d.inventoryCountId}`, "Popis");
  return "—";
}

export default async function DocumentsPage({ searchParams }: PageProps<"/admin/dokumenti">) {
  const sp = await searchParams;
  const [warehouses, suppliers] = await Promise.all([
    apiServer<WarehouseList>("/warehouses"),
    apiServer<SupplierList>("/suppliers"),
  ]);
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || undefined : undefined);
  const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : undefined);

  const filters = {
    search: text(sp.search, 100),
    partner: text(sp.partner, 200),
    type: pickParam(sp.type, DOCUMENT_TYPE),
    status: pickParam(sp.status, DOCUMENT_STATUS),
    warehouseId: pickParam(sp.warehouseId, (warehouses.data ?? []).map((w) => w.id)),
    supplierId: pickParam(sp.supplierId, (suppliers.data ?? []).map((s) => s.id)),
    from: day(sp.from),
    to: day(sp.to),
    sort: pickParam(sp.sort, [...SORTS]) as Sort | undefined,
    dir: pickParam(sp.dir, ["asc", "desc"]) as "asc" | "desc" | undefined,
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const { status, data } = await apiServer<DocumentList>(`/admin/documents?${query}`);
  if (!data) throw new Error(`Documents failed with status ${status}`);

  const sort = filters.sort ?? "issuedAt";
  const dir = filters.dir ?? "desc";
  /** Same filters, other values (page resets to 1). */
  const href = (change: Partial<Record<keyof typeof filters, string | undefined>>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...change })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/admin/dokumenti?${s}` : "/admin/dokumenti";
  };

  /** A column title that sorts by it; a second click turns the direction around. */
  const sortable = (key: Sort, label: string, firstDir: "asc" | "desc" = "asc") => {
    const active = sort === key;
    const next = active ? (dir === "asc" ? "desc" : "asc") : firstDir;
    const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <Link
        href={href({ sort: key === "issuedAt" && next === "desc" ? undefined : key, dir: next })}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        aria-label={`${label}: sortiraj ${next === "asc" ? "rastuće" : "opadajuće"}`}
      >
        {label}
        <Icon className="size-3" aria-hidden />
      </Link>
    );
  };

  const filtered = Object.entries(filters).some(([k, v]) => v && k !== "sort" && k !== "dir");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dokumenti</h1>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="search"
          defaultValue={filters.search}
          placeholder="Broj dokumenta ili partner"
          aria-label="Pretraga"
          className="w-full sm:w-64"
        />
        <FilterSelect name="type" label="Vrsta" value={filters.type} options={DOCUMENT_TYPE} all="Sve vrste" />
        <FilterSelect
          name="warehouseId"
          label="Skladište"
          value={filters.warehouseId}
          options={(warehouses.data ?? []).map((w): [string, string] => [w.id, w.name])}
          all="Sva skladišta"
        />
        <FilterSelect
          name="supplierId"
          label="Dobavljač"
          value={filters.supplierId}
          options={(suppliers.data ?? []).map((s): [string, string] => [s.id, s.name])}
          all="Svi dobavljači"
        />
        <FilterSelect name="status" label="Status" value={filters.status} options={DOCUMENT_STATUS} all="Važeći i stornirani" />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Od
          <Input type="date" name="from" defaultValue={filters.from} max={filters.to} aria-label="Od datuma" className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Do
          <Input type="date" name="to" defaultValue={filters.to} min={filters.from} aria-label="Do datuma" className="w-40" />
        </label>
        {/* Keep the chosen order and partner when the other filters change. */}
        {filters.partner && <input type="hidden" name="partner" value={filters.partner} />}
        {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
        {filters.dir && <input type="hidden" name="dir" value={filters.dir} />}
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {filtered && (
          <Link href={href({ ...NO_FILTERS })} className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      {filters.partner && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Partner:</span>
          <Badge variant="secondary" className="gap-1">
            {filters.partner}
            <Link href={href({ partner: undefined })} aria-label="Ukloni filter partnera" className="hover:text-foreground">
              <X className="size-3" />
            </Link>
          </Badge>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Pronađeno dokumenata: {count(data.total)}</p>
          <DataTable
            head={[
              sortable("issuedAt", "Datum", "desc"),
              sortable("type", "Vrsta"),
              sortable("number", "Broj"),
              sortable("partner", "Partner"),
              sortable("warehouse", "Skladište"),
              sortable("total", "Iznos", "desc"),
              "Veza",
              "Izdao",
            ]}
            align={[5]}
            minWidth="68rem"
            empty="Nema dokumenata koji odgovaraju filterima."
            rows={data.items.map((d) => [
              <span key="d" className="whitespace-nowrap">{dateTime(d.issuedAt)}</span>,
              DOCUMENT_TYPE[d.type],
              <div key="n" className="flex flex-col items-start gap-1">
                <a
                  href={`/api/backend/admin/documents/${d.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="font-mono text-xs whitespace-nowrap underline-offset-4 hover:underline"
                >
                  {d.number}
                </a>
                {d.status === "CANCELLED" && <Badge variant="destructive">STORNIRANO</Badge>}
              </div>,
              d.counterpartyName ? (
                <Link
                  key="p"
                  href={href({ partner: d.counterpartyName })}
                  className="underline-offset-4 hover:underline"
                  title="Svi dokumenti ovog partnera"
                >
                  {d.counterpartyName}
                </Link>
              ) : (
                "—"
              ),
              d.warehouse
                ? d.transfer?.toWarehouse
                  ? `${d.warehouse.name} → ${d.transfer.toWarehouse.name}`
                  : d.warehouse.name
                : "—",
              <span key="t" className="whitespace-nowrap">{d.total != null ? money(d.total) : "—"}</span>,
              source(d),
              d.createdBy?.name ?? "—",
            ])}
          />
          <Pager path="/admin/dokumenti" params={{ ...filters }} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
