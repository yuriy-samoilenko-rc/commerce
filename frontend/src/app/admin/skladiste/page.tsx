import { PackagePlus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StockList, WarehouseList } from "@/lib/backend-types";
import { count, dateTime } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { AdjustButton } from "./adjust-dialog";

export const metadata: Metadata = { title: "Skladište" };

const LIMIT = 30;

export default async function WarehousePage({ searchParams }: PageProps<"/admin/skladiste">) {
  const sp = await searchParams;
  const [user, warehouses] = await Promise.all([requireUser("/admin/skladiste"), apiServer<WarehouseList>("/warehouses")]);
  const all = warehouses.data ?? [];
  if (!all.length) return <p className="text-muted-foreground">Još nema nijednog skladišta.</p>;

  // The chosen warehouse, or the active one holding the most goods (usually the main one).
  const busiest = all.filter((w) => w.isActive).sort((a, b) => b.totals.quantity - a.totals.quantity)[0];
  const warehouse = all.find((w) => w.id === sp.w) ?? busiest ?? all[0];
  const search = typeof sp.search === "string" ? sp.search.trim().slice(0, 100) || undefined : undefined;
  const onlyAvailable = sp.dostupno === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const query = new URLSearchParams({ warehouseId: warehouse.id, page: String(page), limit: String(LIMIT) });
  if (search) query.set("search", search);
  if (onlyAvailable) query.set("onlyAvailable", "true");
  const { status, data } = await apiServer<StockList>(`/stock?${query}`);
  if (!data) throw new Error(`Stock failed with status ${status}`);

  const t = warehouse.totals;
  const params = { w: warehouse.id, search, dostupno: onlyAvailable ? "1" : undefined };
  const canReceive = user.role !== "ACCOUNTANT";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Skladište</h1>
        <div className="flex flex-wrap gap-2">
          {user.role === "ADMIN" && warehouse.isActive && (
            <AdjustButton warehouseId={warehouse.id} label="Korekcija zalihe" variant="outline" />
          )}
          {canReceive && (
            <Link href={`/admin/prenos/novi?w=${warehouse.id}`} className={buttonVariants({ variant: "outline" })}>
              <Truck /> Prenos
            </Link>
          )}
          {canReceive && warehouse.isActive && (
            <Link href={`/admin/prijem/novi?w=${warehouse.id}`} className={buttonVariants()}>
              <PackagePlus /> Novi prijem
            </Link>
          )}
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect
          name="w"
          label="Skladište"
          value={warehouse.id}
          options={all.map((w): [string, string] => [w.id, w.isActive ? w.name : `${w.name} (neaktivno)`])}
        />
        <Input name="search" defaultValue={search} placeholder="Proizvod, šifra ili bar-kod" aria-label="Pretraga" className="w-full sm:w-64" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="dostupno" value="1" defaultChecked={onlyAvailable} className="size-4 accent-primary" />
          Samo dostupno
        </label>
        <button type="submit" className={buttonVariants()}>
          Prikaži
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Proizvoda" value={count(data.total)} hint={search || onlyAvailable ? "po filteru" : undefined} />
        <Stat label="Komada" value={count(t.quantity)} />
        <Stat label="Rezervisano" value={count(t.reserved)} />
        <Stat label="Dostupno" value={count(t.available)} />
        <Stat label="Stiže (u prenosu)" value={count(t.incoming)} />
        <Stat label="Odlazi (u prenosu)" value={count(t.outgoing)} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Proizvod", "Na stanju", "Rezervisano", "Dostupno", "Posljednja promjena", ""]}
            align={[1, 2, 3]}
            minWidth="40rem"
            empty={search || onlyAvailable ? "Nema proizvoda koji odgovaraju filteru." : "Skladište je prazno."}
            rows={data.items.map((s) => [
              <div key="p" className="flex flex-col">
                <Link href={`/admin/proizvodi/${s.product.id}`} className="font-medium underline-offset-4 hover:underline">
                  {s.product.name}
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {s.product.sku}
                  {s.product.trackSerial && <Badge variant="outline">serijski br.</Badge>}
                </span>
              </div>,
              count(s.quantity),
              count(s.reserved),
              <span key="a" className={s.available <= 0 ? "text-destructive" : undefined}>
                {count(s.available)}
              </span>,
              <span key="u" className="whitespace-nowrap text-muted-foreground">{dateTime(s.updatedAt)}</span>,
              user.role === "ADMIN" && warehouse.isActive ? (
                <AdjustButton
                  key="k"
                  warehouseId={warehouse.id}
                  product={{ id: s.product.id, name: s.product.name, trackSerial: s.product.trackSerial, quantity: s.quantity }}
                />
              ) : null,
            ])}
          />
          <Pager path="/admin/skladiste" params={params} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}
