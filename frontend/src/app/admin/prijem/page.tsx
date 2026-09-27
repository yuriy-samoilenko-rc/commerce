import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ReceivingList, SupplierList, WarehouseList } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { RECEIVING_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canReceive } from "./data";
import { ReceivingBadge } from "./receiving-badge";

export const metadata: Metadata = { title: "Prijem robe" };

const LIMIT = 20;

export default async function ReceivingsPage({ searchParams }: PageProps<"/admin/prijem">) {
  const sp = await searchParams;
  const [user, suppliers, warehouses] = await Promise.all([
    requireUser("/admin/prijem"),
    apiServer<SupplierList>("/suppliers"),
    apiServer<WarehouseList>("/warehouses"),
  ]);
  const filters = {
    status: pickParam(sp.status, RECEIVING_STATUS),
    warehouseId: pickParam(sp.warehouseId, (warehouses.data ?? []).map((w) => w.id)),
    supplierId: pickParam(sp.supplierId, (suppliers.data ?? []).map((s) => s.id)),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const { status, data } = await apiServer<ReceivingList>(`/receivings?${query}`);
  if (!data) throw new Error(`Receivings failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Prijem robe</h1>
        {canReceive(user.role) && (
          <Link href="/admin/prijem/novi" className={buttonVariants()}>
            <Plus /> Novi prijem
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="status" label="Status" value={filters.status} options={RECEIVING_STATUS} all="Svi statusi" />
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
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/prijem" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Broj", "Datum", "Dobavljač", "Skladište", "Stavki", "Komada", "Vrijednost", "Status"]}
            align={[4, 5, 6]}
            minWidth="52rem"
            empty="Nema prijema koji odgovaraju filterima."
            rows={data.items.map((r) => [
              <Link key="n" href={`/admin/prijem/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                {r.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{date(r.confirmedAt ?? r.createdAt)}</span>,
              <div key="s" className="flex flex-col">
                <span>{r.supplier.name}</span>
                {r.supplierDocNumber && <span className="text-xs text-muted-foreground">račun {r.supplierDocNumber}</span>}
              </div>,
              r.warehouse.name,
              count(r.itemCount),
              count(r.totalQuantity),
              money(r.totalAmount),
              <ReceivingBadge key="b" status={r.status} />,
            ])}
          />
          <Pager path="/admin/prijem" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
