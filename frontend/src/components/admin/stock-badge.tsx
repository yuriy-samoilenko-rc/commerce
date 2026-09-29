import { Badge } from "@/components/ui/badge";
import { STOCK_ALERT } from "@/lib/labels";

/**
 * Stock state of a product. `alert` is the level last announced by the backend, which only
 * changes when stock moves, so a product that was never received would still read "OK":
 * the actual available quantity decides "out of stock".
 */
export function StockBadge({ alert, archived, available }: { alert: string; archived?: boolean; available?: number }) {
  if (archived) return <Badge variant="outline">Arhiviran</Badge>;
  const level = available !== undefined && available <= 0 ? "OUT" : alert;
  return (
    <Badge variant={level === "OUT" ? "destructive" : level === "LOW" ? "secondary" : "outline"}>{STOCK_ALERT[level]}</Badge>
  );
}
