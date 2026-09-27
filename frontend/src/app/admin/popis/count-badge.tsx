import { Badge } from "@/components/ui/badge";
import { COUNT_STATUS } from "@/lib/labels";

export function CountBadge({ status }: { status: string }) {
  const variant = status === "APPROVED" ? "secondary" : status === "CANCELLED" ? "destructive" : "outline";
  return <Badge variant={variant}>{COUNT_STATUS[status]}</Badge>;
}
