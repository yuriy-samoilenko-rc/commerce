import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { DataTable } from "@/components/admin/data-table";
import { Facts } from "@/components/admin/facts";
import { OrderBadges } from "@/components/admin/order-badges";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerCard } from "@/lib/backend-types";
import { count, date, dateTime, money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { DELIVERY_METHOD } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { ReturnBadge } from "../../povracaji/return-badge";
import { CustomerDialog } from "../customer-dialog";

const loadCustomer = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<CustomerCard>(`/admin/customers/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Customer failed with status ${status}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<"/admin/kupci/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await loadCustomer(id)).name };
}

export default async function CustomerPage({ params }: PageProps<"/admin/kupci/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/admin/kupci/${id}`);
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/admin");
  const c = await loadCustomer(id);

  const tiles = [
    ["Ukupno potrošeno", money(c.stats.spent)],
    ["Narudžbi", count(c.stats.orders)],
    ["Prosječna kupovina", c.stats.delivered ? money(c.stats.average) : "—"],
    ["Povraćaja", count(c.stats.returns)],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/kupci" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kupci
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          {!c.isActive && <Badge variant="outline">Deaktiviran</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <CustomerDialog customer={c} />
          <Link href={`/admin/narudzbe/nova?kupac=${c.id}`} className={buttonVariants()}>
            <Plus /> Nova narudžba
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Podaci</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Email", <a key="e" href={`mailto:${c.email}`} className="break-all hover:underline">{c.email}</a>],
                  ["Telefon", c.phone ? <a key="t" href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:underline">{c.phone}</a> : "—"],
                  ["Adresa", c.deliveryAddress ?? "—"],
                  ["Kupac od", date(c.createdAt)],
                  ["Posljednja prijava", c.lastLoginAt ? dateTime(c.lastLoginAt) : "nikad"],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Napomena</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{c.staffNote ?? "Nema napomene."}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Narudžbe</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                head={["Broj", "Datum", "Isporuka", "Stavki", "Iznos", "Status"]}
                align={[3, 4]}
                minWidth="40rem"
                empty="Kupac još nema narudžbi."
                rows={c.orders.map((o) => [
                  <Link key="n" href={`/admin/narudzbe/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                    {o.number}
                  </Link>,
                  <span key="d" className="whitespace-nowrap">{date(o.createdAt)}</span>,
                  DELIVERY_METHOD[o.deliveryMethod],
                  count(o.items),
                  money(o.total),
                  <OrderBadges key="b" status={o.status} paymentStatus={o.paymentStatus} />,
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kupljeni proizvodi</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                head={["Proizvod", "Komada", "Iznos", "Posljednji put"]}
                align={[1, 2]}
                minWidth="34rem"
                empty="Još nijedna narudžba nije isporučena."
                rows={c.products.map((p) => [
                  <div key="p" className="flex flex-col">
                    <Link href={`/admin/proizvodi/${p.productId}`} className="underline-offset-4 hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{p.sku}</span>
                  </div>,
                  count(p.quantity),
                  money(p.amount),
                  date(p.lastAt),
                ])}
              />
            </CardContent>
          </Card>

          {c.returns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Povraćaji</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  head={["Broj", "Datum", "Narudžba", "Vraćeno", "Status"]}
                  align={[3]}
                  minWidth="34rem"
                  empty=""
                  rows={c.returns.map((r) => [
                    <Link key="n" href={`/admin/povracaji/${r.id}`} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                      {r.number}
                    </Link>,
                    date(r.createdAt),
                    <Link key="o" href={`/admin/narudzbe/${r.order.id}`} className="underline-offset-4 hover:underline">
                      {r.order.number}
                    </Link>,
                    r.refundAmount ? money(r.refundAmount) : "—",
                    <ReturnBadge key="b" status={r.status} />,
                  ])}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
