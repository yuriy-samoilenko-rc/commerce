"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/admin/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Count } from "@/lib/backend-types";
import { count } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = Count["lines"][number];

const differs = (r: Row) => r.difference !== 0 || !!r.missingSerials?.length || !!r.extraSerials?.length;

/** Book stock against what was counted, per product; serial goods also list which units differ. */
export function DiffTable({ rows, actions }: { rows: Row[]; actions?: (row: Row) => React.ReactNode }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const shown = onlyDiff ? rows.filter(differs) : rows;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Evidencija i izbrojano</CardTitle>
        <label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={onlyDiff}
            onChange={(e) => setOnlyDiff(e.target.checked)}
          />
          Samo razlike
        </label>
      </CardHeader>
      <CardContent>
        <DataTable
          head={["Proizvod", "U evidenciji", "Izbrojano", "Razlika", ...(actions ? [""] : [])]}
          align={[1, 2, 3]}
          minWidth="36rem"
          empty={onlyDiff ? "Nema razlika." : "U opsegu popisa nema robe, a ništa još nije izbrojano."}
          rows={shown.map((r) => [
            <div key="p" className="flex flex-col gap-1">
              <Link href={`/admin/proizvodi/${r.product.id}`} className="underline-offset-4 hover:underline">
                {r.product.name}
              </Link>
              <span className="text-xs text-muted-foreground">{r.product.sku}</span>
              {!!r.missingSerials?.length && (
                <span className="text-xs text-destructive">Nedostaje: {r.missingSerials.join(", ")}</span>
              )}
              {!!r.extraSerials?.length && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Višak: {r.extraSerials.join(", ")}</span>
              )}
            </div>,
            count(r.expected),
            count(r.counted),
            <span
              key="d"
              className={cn(
                "font-medium",
                r.difference < 0 && "text-destructive",
                r.difference > 0 && "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {r.difference > 0 ? `+${r.difference}` : r.difference}
            </span>,
            ...(actions ? [actions(r)] : []),
          ])}
        />
      </CardContent>
    </Card>
  );
}
