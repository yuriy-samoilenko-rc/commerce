import { CheckCircle2, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPhoto } from "@/components/shop/bits";
import { OrderTracker, StatusPill } from "@/components/shop/order-bits";
import type { CustomerOrder } from "@/lib/backend-types";
import { dateTime, money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { productHref } from "@/lib/shop-links";
import { DOCUMENT_TYPE, PAYMENT_METHOD, PAYMENT_STATUS } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { productPhotos } from "../../order-list";
import { CancelOrder } from "./cancel-order";

export const metadata: Metadata = { title: "Narudžba" };

export default async function OrderPage({ params, searchParams }: PageProps<"/nalog/narudzbe/[id]">) {
  const { id } = await params;
  const { nova } = await searchParams;
  if (!isUuid(id)) notFound();
  const { data: order } = await apiServer<CustomerOrder>(`/orders/${id}`);
  if (!order) notFound();
  const photos = await productPhotos([order]);
  const cancellable = order.status === "NEW" || order.status === "CONFIRMED";
  const docs = order.documents.filter((d) => d.status === "ISSUED");

  return (
    <>
      <Link href="/nalog/narudzbe" className="text-sm text-shop-muted hover:text-shop-ink">
        ← Sve narudžbe
      </Link>
      {nova === "1" && (
        <div role="status" className="flex items-start gap-3.5 rounded-3xl bg-shop-ok-tint p-5 text-shop-ok">
          <CheckCircle2 className="size-7 shrink-0" />
          <div className="flex flex-col gap-1">
            <strong className="font-display text-xl">Hvala na narudžbi!</strong>
            <span className="text-[15px] text-shop-body">
              Potvrdu smo poslali na {order.customerEmail}. Javićemo vam se kada narudžba bude potvrđena.
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">Narudžba br. {order.number}</h1>
          <span className="text-sm text-shop-muted">Poručeno {dateTime(order.createdAt)}</span>
        </div>
        <StatusPill order={order} />
      </div>

      <section className="flex flex-col gap-5 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
        <OrderTracker order={order} />
        {order.trackingNumber && (
          <p className="text-sm text-shop-muted">
            Broj pošiljke: <strong className="text-shop-ink">{order.trackingNumber}</strong>
            {order.carrier && ` (${order.carrier})`}
          </p>
        )}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <section aria-label="Proizvodi" className="overflow-hidden rounded-3xl border border-shop-line bg-white xl:col-span-2">
          {order.items.map((i) => {
            const p = photos.get(i.productId);
            return (
              <div key={i.id} className="flex items-center gap-4 border-b border-[#e6ecf5] px-5 py-4 last:border-0 md:px-7">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-shop-ground">
                  {p && <ProductPhoto product={p} sizes="64px" alt="" />}
                </span>
                <div className="flex min-w-0 grow flex-col gap-0.5">
                  {p ? (
                    <Link href={productHref(p)} className="font-semibold text-shop-ink hover:text-shop-blue">
                      {i.productName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{i.productName}</span>
                  )}
                  <span className="text-sm text-shop-muted">
                    {i.quantity} × {money(i.unitPrice)}
                    {i.serialUnits.length > 0 && ` · S/N ${i.serialUnits.map((s) => s.serialNumber).join(", ")}`}
                  </span>
                </div>
                <span className="font-display text-lg font-bold">{money(i.lineTotal)}</span>
              </div>
            );
          })}
          <dl className="flex flex-col gap-2 bg-shop-ground px-5 py-5 text-[15px] md:px-7">
            <div className="flex justify-between">
              <dt className="text-shop-muted">Proizvodi</dt>
              <dd className="font-semibold">{money(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-shop-muted">Dostava</dt>
              <dd className="font-semibold">{Number(order.deliveryFee) ? money(order.deliveryFee) : "Besplatno"}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <dt className="font-bold">Ukupno</dt>
              <dd className="font-display text-2xl font-bold">{money(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-3xl border border-shop-line bg-white p-5 text-[15px] md:p-6">
            <h2 className="font-display text-lg font-bold">Preuzimanje i plaćanje</h2>
            {order.deliveryMethod === "PICKUP" ? (
              <p>
                Lično preuzimanje
                {order.pickupWarehouse && (
                  <>
                    : <strong>{order.pickupWarehouse.name}</strong>
                    {order.pickupWarehouse.address && <span className="block text-shop-muted">{order.pickupWarehouse.address}</span>}
                  </>
                )}
              </p>
            ) : (
              <p>
                Kurirska dostava
                <span className="block text-shop-muted">{order.deliveryAddress}</span>
              </p>
            )}
            <p>
              {PAYMENT_METHOD[order.paymentMethod]} · {PAYMENT_STATUS[order.paymentStatus]}
            </p>
            <p className="text-shop-muted">
              {order.customerName} · {order.customerPhone}
            </p>
          </section>
          <section className="flex flex-col gap-3 rounded-3xl border border-shop-line bg-white p-5 md:p-6">
            <h2 className="font-display text-lg font-bold">Dokumenti</h2>
            {docs.length ? (
              docs.map((d) => (
                <a
                  key={d.id}
                  href={`/api/backend/documents/${d.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-2.5 rounded-xl bg-shop-ground px-3.5 py-3 font-semibold text-shop-ink hover:bg-shop-tint"
                >
                  <FileText className="size-[18px] text-shop-blue" />
                  {DOCUMENT_TYPE[d.type]} {d.number}
                </a>
              ))
            ) : (
              <p className="text-sm text-shop-muted">Račun izdajemo kada potvrdimo narudžbu; otpremnicu i garantni list uz isporuku.</p>
            )}
          </section>
          {cancellable && <CancelOrder orderId={order.id} />}
        </div>
      </div>
    </>
  );
}
