import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { FilterSelect, pickParam } from "@/components/admin/filter-select";
import { OrderBadges } from "@/components/admin/order-badges";
import { Pager } from "@/components/admin/pager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OrderList } from "@/lib/backend-types";
import { dateTime, money } from "@/lib/format";
import { DELIVERY_METHOD, ORDER_CHANNEL, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Narudžbe" };

const LIMIT = 20;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/narudzbe">) {
  const sp = await searchParams;
  const filters = {
    status: pickParam(sp.status, ORDER_STATUS),
    paymentStatus: pickParam(sp.paymentStatus, PAYMENT_STATUS),
    channel: pickParam(sp.channel, ORDER_CHANNEL),
    search: typeof sp.search === "string" ? sp.search.trim().slice(0, 100) || undefined : undefined,
  };
  const page = Math.max(1, Number(sp.page) || 1);

  const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  for (const [k, v] of Object.entries(filters)) if (v) query.set(k, v);
  const [{ status, data }, user] = await Promise.all([
    apiServer<OrderList>(`/admin/orders?${query}`),
    requireUser("/admin/narudzbe"),
  ]);
  if (!data) throw new Error(`Orders failed with status ${status}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Narudžbe</h1>
        {(user.role === "ADMIN" || user.role === "MANAGER") && (
          <Link href="/admin/narudzbe/nova" className={buttonVariants()}>
            <Plus /> Nova narudžba
          </Link>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="search"
          defaultValue={filters.search}
          placeholder="Broj, kupac, telefon ili email"
          aria-label="Pretraga"
          className="w-full sm:w-72"
        />
        <FilterSelect name="status" label="Status" value={filters.status} options={ORDER_STATUS} all="Svi statusi" />
        <FilterSelect name="paymentStatus" label="Plaćanje" value={filters.paymentStatus} options={PAYMENT_STATUS} all="Plaćeno i neplaćeno" />
        <FilterSelect name="channel" label="Kanal" value={filters.channel} options={ORDER_CHANNEL} all="Svi kanali" />
        <button type="submit" className={buttonVariants()}>
          Primijeni
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/narudzbe" className={buttonVariants({ variant: "ghost" })}>
            Poništi filtere
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            head={["Br.", "Datum", "Kupac", "Dostava", "Stavki", "Iznos", "Status"]}
            align={[4, 5]}
            minWidth="48rem"
            empty="Nema narudžbi koje odgovaraju filterima."
            rows={data.items.map((o) => [
              <Link key="n" href={`/admin/narudzbe/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                {o.number}
              </Link>,
              <span key="d" className="whitespace-nowrap">{dateTime(o.createdAt)}</span>,
              <div key="c">
                <div>{o.customerName}</div>
                <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
              </div>,
              DELIVERY_METHOD[o.deliveryMethod],
              o.itemCount,
              money(o.total),
              <OrderBadges key="s" status={o.status} paymentStatus={o.paymentStatus} />,
            ])}
          />
          <Pager path="/admin/narudzbe" params={filters} page={page} limit={LIMIT} total={data.total} />
        </CardContent>
      </Card>
    </div>
  );
}
