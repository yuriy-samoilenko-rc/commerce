import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BrandList, CategoryTree, StaffProductList } from "@/lib/backend-types";
import { flattenCategories, indented } from "@/lib/categories";
import { count, money } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Proizvodi" };

const LIMIT = 25;
const STATUS = { active: "U prodaji", archived: "Arhivirani", all: "Svi proizvodi" };
const SORT = { name: "Po nazivu", newest: "Najnoviji", price_asc: "Cijena rastuće", price_desc: "Cijena opadajuće" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/proizvodi">) {
  const sp = await searchParams;
  const [categories, brands, user] = await Promise.all([
    apiServer<CategoryTree>("/categories"),
    apiServer<BrandList>("/brands"),
    requireUser("/admin/proizvodi"),
  ]);
  const flat = flattenCategories(categories.data ?? []);

  const filters = {
    search: typeof sp.search === "string" ? sp.search.trim().slice(0, 100) || undefined : undefined,
    categoryId: pickParam(sp.categoryId, flat.map((c) => c.id)),
    brandId: pickParam(sp.brandId, (brands.data ?? []).map((b) => b.id)),
    status: pickParam(sp.status, STATUS),
    sort: pickParam(sp.sort, SORT),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort: filters.sort ?? "name" });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const { status, data } = await apiServer<StaffProductList>(`/admin/products?${query}`);
  if (!data) throw new Error(`Products failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Proizvodi</h1>
        {user.role === "ADMIN" && (
          <Link href="/admin/proizvodi/novi" className={buttonVariants()}>
            <Plus /> Novi proizvod
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="search"
          defaultValue={filters.search}
          placeholder="Naziv, šifra, model, bar-kod, brend"
          aria-label="Pretraga"
          className="w-full sm:w-72"
        />
        <FilterSelect
          name="categoryId"
          label="Kategorija"
          value={filters.categoryId}
          options={flat.map((c) => [c.id, indented(c)])}
          all="Sve kategorije"
        />
        <FilterSelect
          name="brandId"
          label="Brend"
          value={filters.brandId}
          options={(brands.data ?? []).map((b) => [b.id, b.name])}
          all="Svi brendovi"
        />
        <FilterSelect name="status" label="Status" value={filters.status ?? "active"} options={STATUS} />
        <FilterSelect name="sort" label="Redoslijed" value={filters.sort ?? "name"} options={SORT} />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/proizvodi" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Proizvod", "Kategorija", "Cijena", "Na stanju", "Rezervisano", "Dostupno", "Status"]}
            align={[2, 3, 4, 5]}
            minWidth="52rem"
            empty="Nema proizvoda koji odgovaraju filterima."
            rows={data.items.map((p) => [
              <div key="n" className="flex flex-col">
                <Link href={`/admin/proizvodi/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {p.sku}
                  {p.brand && ` · ${p.brand.name}`}
                </span>
              </div>,
              p.category.name,
              <div key="p" className="flex flex-col items-end">
                <span>{money(p.discountPrice ?? p.sellingPrice)}</span>
                {p.discountPrice && <span className="text-xs text-muted-foreground line-through">{money(p.sellingPrice)}</span>}
              </div>,
              count(p.stock.quantity),
              count(p.stock.reserved),
              count(p.stock.available),
              <StockBadge key="s" alert={p.stockAlert} archived={p.isArchived} />,
            ])}
          />
          <Pager path="/admin/proizvodi" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
