"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { StaffProduct, StaffProductList } from "@/lib/backend-types";
import { count, money } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

/**
 * Finds catalog products by name, SKU or barcode. A scanner types the barcode and
 * presses Enter: the single match is added instead of the form being submitted.
 */
export function ProductSearch({
  onAdd,
  requireStock,
}: {
  onAdd: (p: StaffProduct) => void;
  /** Selling needs available stock; receiving goods does not. */
  requireStock: boolean;
}) {
  const [text, setText] = useState("");
  const search = useDebounced(text.trim());
  const results = useQuery({
    queryKey: ["admin-products", "pick", search],
    queryFn: () => api<StaffProductList>(`/admin/products?${new URLSearchParams({ search, limit: "8", sort: "name" })}`),
    enabled: search.length >= 2,
  });
  const blocked = (p: StaffProduct) => requireStock && p.stock.available <= 0;

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const only = results.data?.items.length === 1 ? results.data.items[0] : undefined;
          if (only && !blocked(only)) {
            onAdd(only);
            setText("");
          }
        }}
        placeholder="Naziv, šifra ili bar-kod"
        aria-label="Pretraga proizvoda"
      />
      {search.length >= 2 && (
        <ul className="flex flex-col divide-y rounded-lg border" aria-label="Rezultati pretrage">
          {results.isPending && <li className="p-3 text-sm text-muted-foreground">Pretraga…</li>}
          {results.data?.items.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nema proizvoda za „{search}“.</li>
          )}
          {results.data?.items.map((p) => {
            const out = p.stock.available <= 0;
            return (
              <li key={p.id} className="flex items-center gap-3 p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.sku} · {money(p.discountPrice ?? p.sellingPrice)}
                    {p.discountPrice && <span className="ml-1 line-through">{money(p.sellingPrice)}</span>}
                    {p.trackSerial && " · serijski br."}
                  </div>
                </div>
                <span className={cn("text-xs whitespace-nowrap", out && requireStock ? "text-destructive" : "text-muted-foreground")}>
                  {out ? "Nema na stanju" : `Dostupno ${count(p.stock.available)}`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocked(p)}
                  onClick={() => onAdd(p)}
                  aria-label={`Dodaj: ${p.name}`}
                >
                  <Plus /> Dodaj
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
