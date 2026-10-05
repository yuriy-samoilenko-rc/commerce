import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DataTable } from "@/components/admin/data-table";
import { Facts } from "@/components/admin/facts";
import { OrderBadges } from "@/components/admin/order-badges";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Order } from "@/lib/backend-types";
import { dateTime, money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { DELIVERY_METHOD, DOCUMENT_TYPE, ORDER_CHANNEL, ORDER_EVENT, PAYMENT_METHOD } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canHandleReturns, RETURNABLE_ORDER } from "../../povracaji/data";
import { OrderActions } from "./order-actions";

// Shared by generateMetadata and the page: one API call per request.
const load = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<Order>(`/admin/orders/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Order failed with status ${status}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<"/admin/narudzbe/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Narudžba br. ${(await load(id)).number}` };
}

export default async function OrderPage({ params }: PageProps<"/admin/narudzbe/[id]">) {
  const { id } = await params;
  const [order, user] = await Promise.all([load(id), requireUser(`/admin/narudzbe/${id}`)]);
  const picking = order.status === "PICKING" || order.status === "READY_TO_SHIP";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Link href="/admin/narudzbe" className="text-sm text-muted-foreground hover:text-foreground">
          ← Sve narudžbe
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Narudžba br. {order.number}</h1>
          <OrderBadges status={order.status} paymentStatus={order.paymentStatus} />
        </div>
        <p className="text-sm text-muted-foreground">
          {dateTime(order.createdAt)} · {ORDER_CHANNEL[order.channel]}
          {order.createdBy && ` · unos: ${order.createdBy.name}`}
        </p>
        <OrderActions order={order} role={user.role} />
        {RETURNABLE_ORDER.includes(order.status) && canHandleReturns(user.role) && (
          <Link
            href={`/admin/povracaji/novi?narudzba=${order.id}`}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            Povraćaj robe
          </Link>
        )}
        {order.status === "PICKING" && (
          <p className="text-sm text-muted-foreground">Roba se priprema u skladištu skeniranjem (mobilno skladište).</p>
        )}
      </div>

      {order.cancelReason && (
        <Card size="sm" className="border-destructive/30">
          <CardContent className="text-sm">
            <span className="font-medium">Razlog otkazivanja:</span> {order.cancelReason}
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Stavke</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTable
              head={["Proizvod", "Šifra", "Kol.", "Cijena", "PDV", "Iznos"]}
              align={[2, 3, 4, 5]}
              minWidth="36rem"
              empty="Narudžba nema stavki."
              rows={order.items.map((item) => {
                const active = item.reservations.filter((r) => !r.releasedAt);
                return [
                  <div key="p" className="flex flex-col gap-1">
                    <span>{item.productName}</span>
                    {active.map((r) => (
                      <span key={r.warehouse.id} className="text-xs text-muted-foreground">
                        {r.warehouse.name}: rezervisano {r.quantity}
                        {picking && `, spakovano ${r.pickedQuantity}`}
                      </span>
                    ))}
                    {item.serialUnits.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Serijski br.: {item.serialUnits.map((s) => s.serialNumber).join(", ")}
                      </span>
                    )}
                  </div>,
                  <span key="s" className="whitespace-nowrap">{item.sku}</span>,
                  item.quantity,
                  money(item.unitPrice),
                  `${Number(item.vatPercent)}%`,
                  money(item.lineTotal),
                ];
              })}
            />
            <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Međuzbir</dt>
              <dd className="text-right tabular-nums">{money(order.subtotal)}</dd>
              {Number(order.discountTotal) > 0 && (
                <>
                  <dt className="text-muted-foreground">od toga promo {order.promoCode?.code}</dt>
                  <dd className="text-right tabular-nums">−{money(order.discountTotal)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Dostava</dt>
              <dd className="text-right tabular-nums">{money(order.deliveryFee)}</dd>
              <dt className="font-medium">Ukupno sa PDV-om</dt>
              <dd className="text-right font-medium tabular-nums">{money(order.total)}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Kupac</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Ime", order.customerName],
                  ["Telefon", <a key="t" href={`tel:${order.customerPhone}`} className="hover:underline">{order.customerPhone}</a>],
                  ["Email", order.customerEmail ?? "—"],
                  [
                    "Nalog",
                    order.user ? (
                      user.role === "ADMIN" || user.role === "MANAGER" ? (
                        <Link key="k" href={`/admin/kupci/${order.user.id}`} className="underline-offset-4 hover:underline">
                          {order.user.name} ({order.user.email})
                        </Link>
                      ) : (
                        `${order.user.name} (${order.user.email})`
                      )
                    ) : (
                      "Bez naloga"
                    ),
                  ],
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dostava i plaćanje</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Dostava", DELIVERY_METHOD[order.deliveryMethod]],
                  order.deliveryAddress && ["Adresa", order.deliveryAddress],
                  order.pickupWarehouse && ["Preuzima u", order.pickupWarehouse.name],
                  ["Plaćanje", PAYMENT_METHOD[order.paymentMethod]],
                  order.paidAt && ["Plaćeno", dateTime(order.paidAt)],
                  order.reservationExpiresAt && ["Rezervacija do", dateTime(order.reservationExpiresAt)],
                  order.carrier && ["Kurir", order.carrier],
                  order.trackingNumber && ["Broj pošiljke", order.trackingNumber],
                  order.comment && ["Napomena kupca", order.comment],
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dokumenti</CardTitle>
            </CardHeader>
            <CardContent>
              {order.documents.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {order.documents.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={`/api/backend/admin/documents/${d.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="underline-offset-4 hover:underline"
                      >
                        {DOCUMENT_TYPE[d.type]} {d.number}
                      </a>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {d.status === "CANCELLED" && <Badge variant="destructive">STORNIRANO</Badge>}
                        {dateTime(d.issuedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Dokumenti se izdaju pri potvrdi i otpremi.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Istorija</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 border-l pl-4 text-sm">
                {order.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                    <div className="font-medium">{ORDER_EVENT[e.type]}</div>
                    <div className="text-xs text-muted-foreground">
                      {dateTime(e.createdAt)}
                      {e.user && ` · ${e.user.name}`}
                    </div>
                    {e.note && <div className="text-xs">{e.note}</div>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
