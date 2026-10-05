import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CustomerList } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { CustomerDialog } from "./customer-dialog";

export const metadata: Metadata = { title: "Kupci" };

const SORT = {
  name: "Po imenu",
  spent: "Najviše potrošili",
  orders: "Najviše narudžbi",
  lastOrder: "Posljednja narudžba",
};
const LIMIT = 25;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/kupci">) {
  const user = await requireUser("/admin/kupci");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const sort = pickParam(sp.sort, SORT) ?? "name";
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ sort, page: String(page), limit: String(LIMIT) });
  if (search) query.set("search", search);
  const { status, data } = await apiServer<CustomerList>(`/admin/customers?${query}`);
  if (!data) throw new Error(`Customers failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Kupci</h1>
        <CustomerDialog />
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <Input name="q" defaultValue={search} placeholder="Ime, email ili telefon…" aria-label="Pretraga kupaca" className="w-64" />
        <FilterSelect name="sort" label="Redoslijed" value={sort} options={SORT} />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {search && (
          <Link href="/admin/kupci" className={buttonVariants({ variant: "ghost" })}>
            Poništi pretragu
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Kupac", "Telefon", "Narudžbi", "Potrošeno", "Povraćaji", "Posljednja narudžba", ""]}
            align={[2, 3, 4]}
            minWidth="56rem"
            empty={search ? "Nema kupaca koji odgovaraju pretrazi." : "Još nema kupaca."}
            rows={data.items.map((c) => [
              <div key="n" className="flex flex-col">
                <Link href={`/admin/kupci/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground">{c.email}</span>
              </div>,
              c.phone ?? "—",
              count(c.orders),
              money(c.spent),
              c.returns ? count(c.returns) : "—",
              date(c.lastOrderAt),
              c.isActive ? "" : <Badge key="s" variant="outline">Deaktiviran</Badge>,
            ])}
          />
          <Pager path="/admin/kupci" params={{ q: search || undefined, sort }} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
