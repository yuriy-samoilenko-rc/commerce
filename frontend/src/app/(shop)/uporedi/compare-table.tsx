"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PriceTag, ProductPhoto } from "@/components/shop/bits";
import { productHref } from "@/lib/shop-links";
import { useShop } from "@/components/shop/shop-provider";
import type { PublicProduct } from "@/lib/backend-types";
import { useProductsByIds } from "@/lib/shop-products";
import { compareStore, MAX_COMPARE, toggleCompare, useStore } from "@/lib/shop-store";
import { cn } from "@/lib/utils";

type Row = { label: string; values: string[] };

function rowsOf(products: PublicProduct[]): Row[] {
  const attrs = products.map((p) => (p.attributes ?? {}) as Record<string, unknown>);
  const keys = [...new Set(attrs.flatMap((a) => Object.keys(a)))].filter((k) => k !== "Garancija");
  return [
    { label: "Dostupnost", values: products.map((p) => (p.inStock ? "Na stanju" : "Nema na stanju")) },
    { label: "Brend", values: products.map((p) => p.brand?.name ?? "—") },
    ...keys.map((k) => ({ label: k, values: attrs.map((a) => (a[k] === undefined ? "—" : String(a[k]))) })),
    { label: "Garancija", values: products.map((p) => (p.warrantyMonths ? `${p.warrantyMonths} mj.` : "—")) },
    { label: "Model", values: products.map((p) => p.model ?? "—") },
  ];
}

export function CompareTable() {
  const ids = useStore(compareStore);
  const { data: products = [], isPending } = useProductsByIds(ids);
  const { addToCart } = useShop();
  const [onlyDiff, setOnlyDiff] = useState(false);

  if (!ids.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-shop-line bg-white p-12 text-center">
        <p className="text-lg text-shop-muted">Još niste izabrali proizvode za poređenje.</p>
        <p className="text-[15px] text-shop-muted">U katalogu označite „Uporedi“ na do {MAX_COMPARE} proizvoda.</p>
        <Link href="/katalog" className="flex h-12 items-center rounded-xl bg-shop-blue px-6 font-bold text-white">
          Idi u katalog
        </Link>
      </div>
    );
  if (isPending) return <div className="h-96 animate-pulse rounded-3xl bg-white" />;

  const rows = rowsOf(products)
    .map((r) => ({ ...r, differs: new Set(r.values).size > 1 }))
    .filter((r) => !onlyDiff || r.differs);
  const cols = `minmax(140px,220px) repeat(${products.length + (products.length < MAX_COMPARE ? 1 : 0)}, minmax(200px,1fr))`;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end text-[15px] font-semibold">
        <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="size-5 accent-shop-blue" />
        Prikaži samo razlike
      </label>
      <div className="overflow-x-auto rounded-3xl border border-shop-line bg-white">
        <div role="table" aria-label="Poređenje proizvoda" className="min-w-max text-[15px]">
          <div role="row" className="grid border-b border-[#e6ecf5]" style={{ gridTemplateColumns: cols }}>
            <div role="columnheader" className="flex items-end p-5 text-sm font-semibold text-shop-muted">
              {products.length} {products.length === 1 ? "proizvod" : "proizvoda"}
            </div>
            {products.map((p) => (
              <div key={p.id} role="columnheader" className="relative flex flex-col gap-3 border-l border-[#e6ecf5] p-5">
                <button
                  type="button"
                  onClick={() => toggleCompare(p.id)}
                  aria-label={`Ukloni ${p.name} iz poređenja`}
                  className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-shop-ground text-shop-muted hover:text-shop-sale"
                >
                  <X className="size-4" />
                </button>
                <Link href={productHref(p)} className="relative block size-40 overflow-hidden rounded-2xl bg-shop-ground">
                  <ProductPhoto product={p} sizes="160px" />
                </Link>
                <Link href={productHref(p)} className="min-h-[46px] font-bold leading-snug text-shop-ink hover:text-shop-blue">
                  {p.name}
                </Link>
                <PriceTag product={p} />
                {p.inStock ? (
                  <button type="button" onClick={() => addToCart(p)} className="h-[46px] rounded-xl bg-shop-blue font-bold text-white hover:bg-shop-blue-dark">
                    U korpu
                  </button>
                ) : (
                  <span className="flex h-[46px] items-center justify-center rounded-xl bg-shop-ground text-sm text-shop-muted">Nema na stanju</span>
                )}
              </div>
            ))}
            {products.length < MAX_COMPARE && (
              <div role="columnheader" className="flex items-center border-l border-[#e6ecf5] p-5">
                <Link
                  href="/katalog"
                  className="flex h-40 w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-shop-field font-bold text-shop-blue"
                >
                  <Plus className="size-7" /> Dodaj proizvod
                </Link>
              </div>
            )}
          </div>
          {rows.map((r) => (
            <div key={r.label} role="row" className={cn("grid border-b border-[#e6ecf5] last:border-0", r.differs && "bg-[#f5f8ff]")} style={{ gridTemplateColumns: cols }}>
              <div role="rowheader" className="px-5 py-4 font-semibold text-shop-muted">
                {r.label}
              </div>
              {r.values.map((v, i) => (
                <div key={i} role="cell" className={cn("border-l border-[#e6ecf5] px-5 py-4 font-semibold", v === "—" && "text-slate-400")}>
                  {v}
                </div>
              ))}
              {products.length < MAX_COMPARE && <div className="border-l border-[#e6ecf5]" />}
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-shop-muted">Istaknuti redovi su karakteristike po kojima se proizvodi razlikuju. „—“ znači da podatak nije naveden.</p>
    </div>
  );
}
