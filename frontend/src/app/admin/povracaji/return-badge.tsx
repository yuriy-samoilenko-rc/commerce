import { Badge } from "@/components/ui/badge";
import { RETURN_STATUS } from "@/lib/labels";

export function ReturnBadge({ status }: { status: string }) {
  const variant =
    status === "REFUNDED" || status === "APPROVED"
      ? "secondary"
      : status === "REJECTED" || status === "CANCELLED"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{RETURN_STATUS[status]}</Badge>;
}
