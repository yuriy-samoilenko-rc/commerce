import { Check } from "lucide-react";
import type { CustomerOrder } from "@/lib/backend-types";
import { dateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Order = Pick<CustomerOrder, "status" | "deliveryMethod" | "events">;

/** The customer's words for a status: a pickup order is "ready" and "collected", not shipped. */
export function customerStatus(o: Pick<Order, "status" | "deliveryMethod">) {
  const pickup = o.deliveryMethod === "PICKUP";
  if (pickup && o.status === "READY_TO_SHIP") return "Spremna za preuzimanje";
  if (pickup && o.status === "DELIVERED") return "Preuzeta";
  return ORDER_STATUS[o.status] ?? o.status;
}

const DONE = ["DELIVERED", "COMPLETED", "PARTIALLY_RETURNED", "RETURNED"];

export function StatusPill({ order }: { order: Pick<Order, "status" | "deliveryMethod"> }) {
  const tone =
    order.status === "CANCELLED"
      ? "bg-shop-sale-tint text-shop-sale-ink"
      : DONE.includes(order.status)
        ? "bg-shop-ok-tint text-shop-ok"
        : "bg-shop-tint text-shop-navy";
  return <span className={cn("rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap", tone)}>{customerStatus(order)}</span>;
}

/** Nova → Potvrđena → U pripremi → Poslata/Spremna → Isporučena/Preuzeta, with the times. */
export function OrderTracker({ order }: { order: Order }) {
  const pickup = order.deliveryMethod === "PICKUP";
  const at = (type: string) => order.events.find((e) => e.type === type)?.createdAt;
  const steps = [
    { label: "Nova", at: at("CREATED"), reached: true },
    { label: "Potvrđena", at: at("CONFIRMED"), statuses: ["CONFIRMED"] },
    { label: "U pripremi", at: at("PICKING_STARTED"), statuses: ["PICKING"] },
    pickup
      ? { label: "Spremna za preuzimanje", at: at("PICKING_COMPLETED"), statuses: ["READY_TO_SHIP"] }
      : { label: "Poslata", at: at("SHIPPED"), statuses: ["SHIPPED"] },
    { label: pickup ? "Preuzeta" : "Isporučena", at: at("DELIVERED"), statuses: DONE },
  ];
  const order_ = ["NEW", "CONFIRMED", "PICKING", pickup ? "READY_TO_SHIP" : "SHIPPED", "DELIVERED"];
  const rank = (s: string) => (DONE.includes(s) ? 4 : s === "READY_TO_SHIP" && !pickup ? 2 : order_.indexOf(s));
  const current = rank(order.status);

  if (order.status === "CANCELLED")
    return <p className="rounded-2xl bg-shop-sale-tint p-4 text-[15px] font-semibold text-shop-sale-ink">Narudžba je otkazana.</p>;

  return (
    <ol aria-label="Status narudžbe" className="grid gap-4 sm:grid-cols-5 sm:gap-0">
      {steps.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s.label} className="flex items-start gap-3 sm:flex-col sm:gap-2.5">
            <div className="flex items-center sm:w-full">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white",
                  i <= current ? "bg-shop-blue" : "bg-shop-field",
                  now && "ring-[5px] ring-[#d6e2ff]",
                )}
                aria-current={now ? "step" : undefined}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={cn("mx-2 hidden h-[3px] grow rounded-full sm:block", i < current ? "bg-shop-blue" : "bg-[#e6ecf5]")} />
              )}
            </div>
            <span className="flex flex-col gap-0.5">
              <strong className={cn("text-sm", i <= current ? "text-shop-ink" : "text-shop-muted")}>{s.label}</strong>
              {s.at && <span className="text-[13px] text-shop-muted">{dateTime(s.at)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
