import { Badge } from "@/components/ui/badge";
import { RECEIVING_STATUS } from "@/lib/labels";

export function ReceivingBadge({ status }: { status: string }) {
  const variant = status === "CONFIRMED" ? "secondary" : status === "DRAFT" ? "outline" : "destructive";
  return <Badge variant={variant}>{RECEIVING_STATUS[status]}</Badge>;
}
