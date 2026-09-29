import type { Metadata } from "next";
import Link from "next/link";
import { OrderTracker, StatusPill } from "@/components/shop/order-bits";
import type { CustomerOrderList, WishlistIds } from "@/lib/backend-types";
import { date, money } from "@/lib/format";
import { currentCustomer } from "@/lib/shop-api";
import { apiServer } from "@/lib/session";
import { OrderList, pieces, productPhotos } from "./order-list";

export const metadata: Metadata = { title: "Moj nalog" };

const OPEN = ["NEW", "CONFIRMED", "PICKING", "READY_TO_SHIP", "SHIPPED"];

export default async function AccountOverview() {
  const [customer, orders, wish] = await Promise.all([
    currentCustomer(),
    apiServer<CustomerOrderList>("/orders?limit=5"),
    apiServer<WishlistIds>("/wishlist/ids"),
  ]);
  const list = orders.data?.items ?? [];
  const current = list.find((o) => OPEN.includes(o.status));
  const photos = await productPhotos(list);
  const documents = list.reduce((s, o) => s + o.documents.filter((d) => d.status === "ISSUED").length, 0);
  const stats = [
    { label: "Narudžbe", value: orders.data?.total ?? 0, href: "/nalog/narudzbe" },
    { label: "Na listi želja", value: wish.data?.productIds.length ?? 0, href: "/nalog/lista-zelja" },
    { label: "Dokumenti za preuzimanje", value: documents, href: "/nalog/narudzbe" },
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Zdravo, {customer?.name.split(" ")[0]}</h1>
      {current && (
        <section aria-label="Narudžba u toku" className="flex flex-col gap-6 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-bold tracking-wider text-shop-muted">NARUDŽBA U TOKU</span>
              <strong className="font-display text-[22px]">Narudžba br. {current.number}</strong>
              <span className="text-sm text-shop-muted">
                {date(current.createdAt)} · {pieces(current)} · {money(current.total)} ·{" "}
                {current.deliveryMethod === "PICKUP" ? "Lično preuzimanje" : "Kurirska dostava"}
              </span>
            </div>
            <StatusPill order={current} />
          </div>
          <OrderTracker order={current} />
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/nalog/narudzbe/${current.id}`}
              className="flex h-11 items-center rounded-xl border-[1.5px] border-shop-field px-4 font-bold text-shop-ink hover:border-shop-blue"
            >
              Detalji narudžbe
            </Link>
            {current.trackingNumber && (
              <span className="flex h-11 items-center text-sm text-shop-muted">
                Broj pošiljke: <strong className="ml-1 text-shop-ink">{current.trackingNumber}</strong>
                {current.carrier && ` (${current.carrier})`}
              </span>
            )}
          </div>
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="flex flex-col gap-1.5 rounded-[20px] border border-shop-line bg-white p-5 hover:border-shop-blue">
            <span className="text-sm text-shop-muted">{s.label}</span>
            <strong className="font-display text-[28px]">{s.value}</strong>
          </Link>
        ))}
      </div>
      <section aria-label="Posljednje narudžbe" className="overflow-hidden rounded-3xl border border-shop-line bg-white">
        <div className="flex items-center justify-between px-5 pt-6 pb-2 md:px-7">
          <h2 className="font-display text-xl font-bold">Posljednje narudžbe</h2>
          {list.length > 0 && (
            <Link href="/nalog/narudzbe" className="text-sm font-semibold text-shop-blue">
              Sve narudžbe →
            </Link>
          )}
        </div>
        {list.length ? (
          <OrderList orders={list.slice(0, 3)} photos={photos} />
        ) : (
          <p className="px-5 pb-6 text-shop-muted md:px-7">
            Još nemate narudžbi. <Link href="/katalog">Pogledajte ponudu</Link>
          </p>
        )}
      </section>
    </>
  );
}
