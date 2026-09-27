import { Badge } from "@/components/ui/badge";
import { TRANSFER_STATUS } from "@/lib/labels";

export function TransferBadge({ status }: { status: string }) {
  const variant = status === "RECEIVED" ? "secondary" : status === "CANCELLED" ? "destructive" : "outline";
  return <Badge variant={variant}>{TRANSFER_STATUS[status]}</Badge>;
}
