import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryTree, CountList, WarehouseList } from "@/lib/backend-types";
import { flattenCategories, indented } from "@/lib/categories";
import { count, date } from "@/lib/format";
import { COUNT_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { CountBadge } from "./count-badge";
import { canCount } from "./data";
import { NewCountDialog } from "./new-count-dialog";

export const metadata: Metadata = { title: "Popis" };

const LIMIT = 20;

export default async function CountsPage({ searchParams }: PageProps<"/admin/popis">) {
  const sp = await searchParams;
  const [user, warehouses, categories] = await Promise.all([
    requireUser("/admin/popis"),
    apiServer<WarehouseList>("/warehouses"),
    apiServer<CategoryTree>("/categories"),
  ]);
  const filters = {
    status: pickParam(sp.status, COUNT_STATUS),
    warehouseId: pickParam(sp.warehouseId, (warehouses.data ?? []).map((w) => w.id)),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const { status, data } = await apiServer<CountList>(`/inventory-counts?${query}`);
  if (!data) throw new Error(`Counts failed with status ${status}`);

  const flat = flattenCategories(categories.data ?? []);
  const categoryName = new Map(flat.map((c) => [c.id, c.path]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Popis</h1>
        {canCount(user.role) && (
          <NewCountDialog
            warehouses={(warehouses.data ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, name: w.name }))}
            categories={flat.map((c) => ({ id: c.id, name: indented(c) }))}
          />
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="status" label="Status" value={filters.status} options={COUNT_STATUS} all="Svi statusi" />
        <FilterSelect
          name="warehouseId"
          label="Skladište"
          value={filters.warehouseId}
          options={(warehouses.data ?? []).map((w): [string, string] => [w.id, w.name])}
          all="Sva skladišta"
        />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/popis" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Broj", "Početak", "Skladište", "Opseg", "Izbrojano proizvoda", "Status"]}
            align={[4]}
            minWidth="44rem"
            empty="Nema popisa koji odgovaraju filterima."
            rows={data.items.map((c) => [
              <Link key="n" href={`/admin/popis/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                {c.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{date(c.createdAt)}</span>,
              c.warehouse.name,
              c.categoryId ? (categoryName.get(c.categoryId) ?? "Kategorija") : "Cijelo skladište",
              count(c.countedProducts),
              <CountBadge key="b" status={c.status} />,
            ])}
          />
          <Pager path="/admin/popis" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
