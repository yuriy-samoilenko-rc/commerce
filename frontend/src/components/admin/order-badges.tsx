import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/labels";

const QUIET = new Set(["CANCELLED", "COMPLETED", "RETURNED"]);

export function OrderBadges({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  // A cancelled or closed order has nothing left to collect: no red "unpaid" on it.
  const unpaid = paymentStatus === "UNPAID" && !QUIET.has(status);
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={status === "CANCELLED" ? "outline" : "secondary"}>{ORDER_STATUS[status]}</Badge>
      <Badge variant={unpaid ? "destructive" : "outline"}>{PAYMENT_STATUS[paymentStatus]}</Badge>
    </span>
  );
}
