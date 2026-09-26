import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { count } from "@/lib/format";

/** Previous/next links that keep the current filters in the query string. */
export function Pager({
  path,
  params,
  page,
  limit,
  total,
}: {
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  limit: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const step = (p: number, label: string, enabled: boolean) =>
    enabled ? (
      <Link href={href(p)} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {label}
      </Link>
    ) : (
      <Button variant="outline" size="sm" disabled>
        {label}
      </Button>
    );

  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>Ukupno: {count(total)}</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {step(page - 1, "Prethodna", page > 1)}
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          {step(page + 1, "Sljedeća", page < pages)}
        </div>
      )}
    </div>
  );
}
