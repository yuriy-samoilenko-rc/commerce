import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WarrantyList } from "@/lib/backend-types";
import { date } from "@/lib/format";
import { WARRANTY_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canHandleWarranty } from "./data";
import { WarrantyBadge } from "./warranty-badge";

export const metadata: Metadata = { title: "Garancija" };

const LIMIT = 20;

export default async function WarrantyPage({ searchParams }: PageProps<"/admin/garancija">) {
  const sp = await searchParams;
  const filters = { status: pickParam(sp.status, WARRANTY_STATUS) };
  const page = Math.max(1, Number(sp.page) || 1);
  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (filters.status) query.set("status", filters.status);
  const [user, { status, data }] = await Promise.all([
    requireUser("/admin/garancija"),
    apiServer<WarrantyList>(`/admin/warranty-cases?${query}`),
  ]);
  if (!data) throw new Error(`Warranty cases failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Garancija</h1>
        {canHandleWarranty(user.role) && (
          <Link href="/admin/garancija/novi" className={buttonVariants()}>
            <Plus /> Novi zahtjev
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <FilterSelect name="status" label="Status" value={filters.status} options={WARRANTY_STATUS} all="Svi statusi" />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {filters.status && (
          <Link href="/admin/garancija" className={buttonVariants({ variant: "ghost" })}>
            Poništi filter
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Broj", "Datum", "Uređaj", "Kupac", "Problem", "Status"]}
            minWidth="50rem"
            empty="Nema garantnih zahtjeva."
            rows={data.items.map((c) => [
              <Link key="n" href={`/admin/garancija/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                {c.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{date(c.createdAt)}</span>,
              <div key="u" className="flex flex-col">
                <span>{c.unit.product.name}</span>
                <span className="text-xs text-muted-foreground">{c.unit.serialNumber}</span>
              </div>,
              c.order ? c.order.customerName : "—",
              <span key="p" className="line-clamp-2">{c.problem}</span>,
              <WarrantyBadge key="b" status={c.status} />,
            ])}
          />
          <Pager path="/admin/garancija" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
