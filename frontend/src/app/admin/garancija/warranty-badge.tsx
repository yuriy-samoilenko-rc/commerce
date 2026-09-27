import { Badge } from "@/components/ui/badge";
import { WARRANTY_STATUS } from "@/lib/labels";

export function WarrantyBadge({ status }: { status: string }) {
  const variant =
    status === "CLOSED" || status === "REPLACED" ? "secondary" : status === "REJECTED" ? "destructive" : "outline";
  return <Badge variant={variant}>{WARRANTY_STATUS[status]}</Badge>;
}
