import { Badge } from "@/components/ui/badge";
import { STOCK_ALERT } from "@/lib/labels";

export function StockBadge({ alert, archived }: { alert: string; archived?: boolean }) {
  if (archived) return <Badge variant="outline">Arhiviran</Badge>;
  return (
    <Badge variant={alert === "OUT" ? "destructive" : alert === "LOW" ? "secondary" : "outline"}>{STOCK_ALERT[alert]}</Badge>
  );
}
