import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TransferList, WarehouseList } from "@/lib/backend-types";
import { count, date } from "@/lib/format";
import { TRANSFER_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canTransfer } from "./data";
import { TransferBadge } from "./transfer-badge";

export const metadata: Metadata = { title: "Prenos robe" };

const LIMIT = 20;

export default async function TransfersPage({ searchParams }: PageProps<"/admin/prenos">) {
  const sp = await searchParams;
  const [user, warehouses] = await Promise.all([requireUser("/admin/prenos"), apiServer<WarehouseList>("/warehouses")]);
  const ids = (warehouses.data ?? []).map((w) => w.id);
  const filters = {
    status: pickParam(sp.status, TRANSFER_STATUS),
    fromWarehouseId: pickParam(sp.fromWarehouseId, ids),
    toWarehouseId: pickParam(sp.toWarehouseId, ids),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const { status, data } = await apiServer<TransferList>(`/transfers?${query}`);
  if (!data) throw new Error(`Transfers failed with status ${status}`);
  const options = (warehouses.data ?? []).map((w): [string, string] => [w.id, w.name]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Prenos robe</h1>
        {canTransfer(user.role) && (
          <Link href="/admin/prenos/novi" className={buttonVariants()}>
            <Plus /> Novi prenos
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="status" label="Status" value={filters.status} options={TRANSFER_STATUS} all="Svi statusi" />
        <FilterSelect name="fromWarehouseId" label="Iz skladišta" value={filters.fromWarehouseId} options={options} all="Iz svih skladišta" />
        <FilterSelect name="toWarehouseId" label="U skladište" value={filters.toWarehouseId} options={options} all="U sva skladišta" />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/prenos" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Broj", "Datum", "Iz skladišta", "U skladište", "Stavki", "Komada", "Status"]}
            align={[4, 5]}
            minWidth="46rem"
            empty="Nema prenosa koji odgovaraju filterima."
            rows={data.items.map((t) => [
              <Link key="n" href={`/admin/prenos/${t.id}`} className="font-medium underline-offset-4 hover:underline">
                {t.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{date(t.receivedAt ?? t.sentAt ?? t.createdAt)}</span>,
              t.fromWarehouse.name,
              t.toWarehouse.name,
              count(t.itemCount),
              count(t.totalQuantity),
              <TransferBadge key="b" status={t.status} />,
            ])}
          />
          <Pager path="/admin/prenos" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
