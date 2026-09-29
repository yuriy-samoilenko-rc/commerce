import { FileText } from "lucide-react";
import Link from "next/link";
import { ProductPhoto } from "@/components/shop/bits";
import { StatusPill } from "@/components/shop/order-bits";
import type { CustomerOrderList, PublicProductList } from "@/lib/backend-types";
import { date, money } from "@/lib/format";
import { DOCUMENT_TYPE } from "@/lib/labels";
import { publicApi } from "@/lib/shop-api";

type Order = CustomerOrderList["items"][number];

/** Photos of the ordered products (products no longer sold simply have none). */
export async function productPhotos(orders: Order[]) {
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))].slice(0, 50);
  if (!ids.length) return new Map();
  const list = await publicApi<PublicProductList>(`/products?ids=${ids.join(",")}&limit=50`);
  return new Map((list?.items ?? []).map((p) => [p.id, p]));
}

export const pieces = (o: Order) => {
  const n = o.items.reduce((s, i) => s + i.quantity, 0);
  return n === 1 ? "1 proizvod" : `${n} proizvoda`;
};

export function OrderList({ orders, photos }: { orders: Order[]; photos: Map<string, PublicProductList["items"][number]> }) {
  return (
    <div className="flex flex-col">
      {orders.map((o) => (
        <article key={o.id} className="flex flex-col gap-3.5 border-t border-[#e6ecf5] px-5 py-5 first:border-0 md:px-7">
          <div className="flex flex-wrap items-center gap-4 md:flex-nowrap md:gap-5">
            <div className="flex">
              {o.items.slice(0, 3).map((i) => {
                const p = photos.get(i.productId);
                return (
                  <span key={i.id} className="relative -mr-2.5 size-14 overflow-hidden rounded-xl border-2 border-white bg-shop-ground">
                    {p && <ProductPhoto product={p} sizes="56px" alt="" />}
                  </span>
                );
              })}
            </div>
            <Link href={`/nalog/narudzbe/${o.id}`} className="flex min-w-0 grow flex-col gap-0.5 pl-3 text-shop-ink hover:text-shop-blue">
              <strong className="text-base">Narudžba br. {o.number}</strong>
              <span className="text-sm text-shop-muted">
                {date(o.createdAt)} · {pieces(o)} · {o.deliveryMethod === "PICKUP" ? (o.pickupWarehouse?.name ?? "Lično preuzimanje") : "Kurirska dostava"}
              </span>
            </Link>
            <span className="font-display text-lg font-bold">{money(o.total)}</span>
            <StatusPill order={o} />
          </div>
          {o.documents.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 md:pl-[118px]">
              <span className="text-sm text-shop-muted">Dokumenti:</span>
              {o.documents
                .filter((d) => d.status === "ISSUED")
                .map((d) => (
                  <a
                    key={d.id}
                    href={`/api/backend/documents/${d.id}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className="flex h-9 items-center gap-2 rounded-[10px] bg-shop-ground px-3 text-sm font-semibold text-shop-ink hover:bg-shop-tint"
                  >
                    <FileText className="size-4" /> {DOCUMENT_TYPE[d.type]} <span className="font-normal text-shop-muted">PDF</span>
                  </a>
                ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
