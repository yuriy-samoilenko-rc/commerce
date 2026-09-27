import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ReturnList } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { RETURN_STATUS } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { ReturnBadge } from "./return-badge";

export const metadata: Metadata = { title: "Povraćaji" };

const LIMIT = 20;

export default async function ReturnsPage({ searchParams }: PageProps<"/admin/povracaji">) {
  const sp = await searchParams;
  const filters = { status: pickParam(sp.status, RETURN_STATUS) };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (filters.status) query.set("status", filters.status);
  const { status, data } = await apiServer<ReturnList>(`/admin/returns?${query}`);
  if (!data) throw new Error(`Returns failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Povraćaji</h1>
        <p className="text-sm text-muted-foreground">Novi povraćaj se otvara iz isporučene narudžbe.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="status" label="Status" value={filters.status} options={RETURN_STATUS} all="Svi statusi" />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {filters.status && (
          <Link href="/admin/povracaji" className={buttonVariants({ variant: "ghost" })}>
            Poništi filter
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Broj", "Datum", "Narudžba", "Kupac", "Komada", "Za povraćaj", "Status"]}
            align={[4, 5]}
            minWidth="46rem"
            empty="Nema povraćaja."
            rows={data.items.map((r) => [
              <Link key="n" href={`/admin/povracaji/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                {r.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{date(r.createdAt)}</span>,
              <Link key="o" href={`/admin/narudzbe/${r.order.id}`} className="underline-offset-4 hover:underline">
                {r.order.number}
              </Link>,
              r.order.customerName,
              count(r.items.reduce((s, i) => s + i.quantity, 0)),
              r.refundAmount ? money(r.refundAmount) : "—",
              <ReturnBadge key="b" status={r.status} />,
            ])}
          />
          <Pager path="/admin/povracaji" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
