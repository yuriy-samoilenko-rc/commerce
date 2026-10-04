import type { Metadata } from "next";
import Link from "next/link";
import type { CustomerReturnList } from "@/lib/backend-types";
import { date, money } from "@/lib/format";
import { CUSTOMER_RETURN_REASON as CUSTOMER_REASON, RETURN_STATUS } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CancelReturn } from "./cancel-return";

export const metadata: Metadata = { title: "Povraćaji" };

const TONE: Record<string, string> = {
  REFUNDED: "bg-shop-ok-tint text-shop-ok",
  APPROVED: "bg-shop-ok-tint text-shop-ok",
  REJECTED: "bg-shop-sale-tint text-shop-sale-ink",
  CANCELLED: "bg-shop-ground text-shop-muted",
};

export default async function ReturnsPage() {
  const { data } = await apiServer<CustomerReturnList>("/returns?limit=50");
  const returns = data?.items ?? [];
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Povraćaji</h1>
      {returns.length === 0 ? (
        <p className="rounded-3xl border border-shop-line bg-white p-7 text-shop-muted">
          Nemate zahtjeva za povraćaj. Robu vraćate sa stranice preuzete narudžbe, dugmetom „Vrati proizvod“.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {returns.map((r) => (
            <article key={r.id} className="flex flex-col gap-3 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <strong className="font-display text-lg">Povraćaj {r.number}</strong>
                  <span className="text-sm text-shop-muted">
                    {date(r.createdAt)} ·{" "}
                    <Link href={`/nalog/narudzbe/${r.order.id}`}>narudžba br. {r.order.number}</Link>
                  </span>
                </div>
                <span className={cn("rounded-full px-3 py-1.5 text-sm font-bold", TONE[r.status] ?? "bg-shop-tint text-shop-navy")}>
                  {RETURN_STATUS[r.status]}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[15px]">
                {r.items.map((i) => (
                  <li key={i.id}>
                    {i.quantity} × {i.orderItem.productName}
                    <span className="text-shop-muted"> — {CUSTOMER_REASON[i.reason] ?? i.reason}</span>
                  </li>
                ))}
              </ul>
              {r.refundAmount && Number(r.refundAmount) > 0 && (
                <p className="text-[15px]">
                  Iznos za povraćaj: <strong>{money(r.refundAmount)}</strong>
                </p>
              )}
              {r.status === "REQUESTED" && <CancelReturn id={r.id} />}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
