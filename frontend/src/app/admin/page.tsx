import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/admin/data-table";
import { OrderBadges } from "@/components/admin/order-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/backend-types";
import { count, date, dateTime, money } from "@/lib/format";
import { MOVEMENT_TYPE, STOCK_ALERT } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { SalesChart } from "./sales-chart";

export const metadata: Metadata = { title: "Kontrolna tabla" };

export default async function DashboardPage() {
  const { status, data } = await apiServer<Dashboard>("/admin/dashboard");
  if (status === 403) {
    return (
      <p className="text-muted-foreground">
        Kontrolna tabla sa finansijskim podacima dostupna je administratoru, menadžeru i računovođi.
      </p>
    );
  }
  if (!data) throw new Error(`Dashboard failed with status ${status}`);
  const c = data.cards;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Kontrolna tabla</h1>
        <p className="text-sm text-muted-foreground">Stanje na dan {date(`${data.date}T12:00:00Z`)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Prodaja danas" value={money(c.salesToday)} hint={`${count(c.salesTodayOrders)} otpremljenih narudžbi`} />
        <Stat title="Narudžbe danas" value={count(c.ordersToday)} hint={`u vrijednosti ${money(c.ordersTodayValue)}`} />
        <Stat title="Nove narudžbe" value={count(c.newOrders)} hint="čekaju potvrdu" />
        <Stat title="Spremne za slanje" value={count(c.readyToShip)} hint={`${count(c.picking)} u pripremi`} />
        <Stat title="Roba na stanju" value={`${count(c.unitsInStock)} kom.`} hint={`${count(c.productsInStock)} proizvoda`} />
        <Stat title="Malo robe" value={count(c.lowStock)} hint="proizvoda ispod praga" warn={c.lowStock > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prodaja u posljednjih 30 dana</CardTitle>
          <CardDescription>Promet sa PDV-om po danu otpreme</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesChart data={data.salesByDay.map((d) => ({ day: d.period, revenue: Number(d.revenue), orders: d.orders }))} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Posljednje narudžbe</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              head={["Br.", "Kupac", "Iznos", "Status", "Datum"]}
              empty="Još nema narudžbi."
              rows={data.latestOrders.map((o) => [
                <Link key="n" href={`/admin/narudzbe/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                  {o.number}
                </Link>,
                o.customerName,
                <span key="t" className="tabular-nums">{money(o.total)}</span>,
                <OrderBadges key="s" status={o.status} paymentStatus={o.paymentStatus} />,
                dateTime(o.createdAt),
              ])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Malo robe</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              head={["Proizvod", "Šifra", "Dostupno", "Status"]}
              empty="Sve je na stanju."
              rows={data.lowStockProducts.map((p) => [
                p.name,
                p.sku,
                <span key="a" className="tabular-nums">{count(p.available)}</span>,
                <Badge key="s" variant={p.stockAlert === "OUT" ? "destructive" : "secondary"}>{STOCK_ALERT[p.stockAlert]}</Badge>,
              ])}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Posljednja kretanja robe</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            head={["Vrijeme", "Proizvod", "Vrsta", "Količina", "Skladište", "Zaposleni"]}
            empty="Još nema kretanja robe."
            rows={data.latestMovements.map((m) => [
              dateTime(m.createdAt),
              m.product.name,
              MOVEMENT_TYPE[m.type],
              <span key="q" className={m.quantity < 0 ? "text-destructive tabular-nums" : "tabular-nums"}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </span>,
              m.warehouse.name,
              m.user.name,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, hint, warn }: { title: string; value: string; hint: string; warn?: boolean }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={warn ? "text-2xl text-destructive tabular-nums" : "text-2xl tabular-nums"}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}
