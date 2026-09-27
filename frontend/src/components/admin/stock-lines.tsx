"use client";

import { Trash2 } from "lucide-react";
import { ProductSearch } from "@/components/admin/product-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StaffProduct } from "@/lib/backend-types";
import { decimalInput, parseDecimal } from "@/lib/format";
import { parseSerials } from "@/lib/serials";

/** One product line of a stock document (receiving, transfer) while it is being edited. */
export interface StockLine {
  product: { id: string; name: string; sku: string; trackSerial: boolean };
  quantity: string;
  /** Receivings only. */
  price?: string;
  serials: string;
}

export const quantityOk = (l: StockLine) =>
  /^\d+$/.test(l.quantity) && Number(l.quantity) >= 1 && Number(l.quantity) <= 100_000;

export const priceOk = (l: StockLine) => {
  const n = parseDecimal(l.price ?? "");
  return n !== null && !Number.isNaN(n) && n <= 99_999_999.99;
};

/**
 * What is wrong with the lines, or null. Drafts may carry fewer serial numbers than
 * units; posting the document (`complete`) needs exactly one per unit.
 */
export function lineProblem(lines: StockLine[], opts: { withPrice: boolean; complete: boolean }) {
  if (opts.complete && !lines.length) return "Dodajte bar jedan proizvod.";
  for (const l of lines) {
    if (!quantityOk(l)) return `„${l.product.name}“: količina mora biti cio broj od 1 do 100.000.`;
    if (opts.withPrice && !priceOk(l)) return `„${l.product.name}“: unesite nabavnu cijenu, npr. 249,90.`;
    const n = parseSerials(l.serials).length;
    if (n > Number(l.quantity)) return `„${l.product.name}“: više serijskih brojeva nego komada.`;
    if (opts.complete && l.product.trackSerial && n !== Number(l.quantity))
      return `„${l.product.name}“: potrebno je ${l.quantity} serijskih brojeva, uneseno ${n}.`;
  }
  return null;
}

/** The lines as the API takes them. */
export const toItems = (lines: StockLine[], withPrice: boolean) =>
  lines.map((l) => ({
    productId: l.product.id,
    quantity: Number(l.quantity),
    ...(withPrice && { purchasePrice: parseDecimal(l.price ?? "") }),
    ...(l.product.trackSerial && { serialNumbers: parseSerials(l.serials) }),
  }));

/** Product search plus the editable list of lines. */
export function StockLines({
  lines,
  onChange,
  withPrice,
}: {
  lines: StockLine[];
  onChange: (lines: StockLine[]) => void;
  withPrice: boolean;
}) {
  const update = (i: number, patch: Partial<StockLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function add(p: StaffProduct) {
    const at = lines.findIndex((l) => l.product.id === p.id);
    if (at >= 0) return update(at, { quantity: String(Number(lines[at].quantity || 0) + 1) });
    const product = { id: p.id, name: p.name, sku: p.sku, trackSerial: p.trackSerial };
    // The last purchase price is a good first guess, for those who may see it.
    const cost = "purchasePrice" in p ? (p.purchasePrice as string | null) : null;
    onChange([...lines, { product, quantity: "1", serials: "", ...(withPrice && { price: decimalInput(cost) }) }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductSearch requireStock={false} onAdd={add} />
      {lines.length ? (
        <ul className="flex flex-col divide-y rounded-lg border" aria-label="Stavke dokumenta">
          {lines.map((l, i) => (
            <li key={l.product.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.product.name}</div>
                  <div className="text-xs text-muted-foreground">{l.product.sku}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Ukloni: ${l.product.name}`}
                  onClick={() => onChange(lines.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="grid gap-1">
                  <Label htmlFor={`qty-${i}`} className="text-xs">
                    Količina
                  </Label>
                  <Input
                    id={`qty-${i}`}
                    inputMode="numeric"
                    className="w-24"
                    value={l.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    aria-invalid={!quantityOk(l)}
                    aria-label={`Količina: ${l.product.name}`}
                  />
                </div>
                {withPrice && (
                  <div className="grid gap-1">
                    <Label htmlFor={`price-${i}`} className="text-xs">
                      Nabavna cijena (€)
                    </Label>
                    <Input
                      id={`price-${i}`}
                      inputMode="decimal"
                      className="w-32"
                      value={l.price ?? ""}
                      onChange={(e) => update(i, { price: e.target.value })}
                      aria-invalid={!!l.price && !priceOk(l)}
                      aria-label={`Nabavna cijena: ${l.product.name}`}
                    />
                  </div>
                )}
              </div>
              {l.product.trackSerial && (
                <div className="grid gap-1">
                  <Label htmlFor={`serials-${i}`} className="text-xs">
                    Serijski brojevi — skenirajte jedan po jedan ({parseSerials(l.serials).length} od {l.quantity || 0})
                  </Label>
                  <Textarea
                    id={`serials-${i}`}
                    rows={Math.min(6, Math.max(2, Number(l.quantity) || 2))}
                    value={l.serials}
                    onChange={(e) => update(i, { serials: e.target.value })}
                    aria-label={`Serijski brojevi: ${l.product.name}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Pronađite proizvod po nazivu, šifri ili bar-kodu i dodajte ga.</p>
      )}
    </div>
  );
}
