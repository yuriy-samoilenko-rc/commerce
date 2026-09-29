"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { compareStore, MAX_COMPARE, toggleCompare, useStore } from "@/lib/shop-store";
import { useProductsByIds } from "@/lib/shop-products";
import { ProductPhoto } from "./bits";

/** Floats at the bottom while products are picked for comparison. */
export function CompareBar() {
  const ids = useStore(compareStore);
  const products = useProductsByIds(ids);
  if (!ids.length) return null;
  return (
    <div
      role="region"
      aria-label="Poređenje proizvoda"
      className="fixed inset-x-3 bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-[20px] bg-shop-navy p-3 pl-5 text-white shadow-[0_18px_40px_rgba(11,27,51,0.3)] md:inset-x-auto md:right-1/2 md:translate-x-1/2 md:gap-5"
    >
      <strong className="font-display text-[17px] whitespace-nowrap">
        Uporedi ({ids.length}/{MAX_COMPARE})
      </strong>
      <div className="hidden gap-2.5 md:flex">
        {products.data?.map((p) => (
          <span key={p.id} className="flex items-center gap-2.5 rounded-xl bg-white/10 p-1.5">
            <span className="relative size-10 overflow-hidden rounded-lg bg-white">
              <ProductPhoto product={p} sizes="40px" />
            </span>
            <span className="max-w-40 truncate text-sm font-semibold">{p.name}</span>
            <button
              type="button"
              onClick={() => toggleCompare(p.id)}
              aria-label={`Ukloni ${p.name} iz poređenja`}
              className="flex size-8 items-center justify-center rounded-lg text-[#cfdbf2] hover:bg-white/10"
            >
              <X className="size-3.5" strokeWidth={2.6} />
            </button>
          </span>
        ))}
      </div>
      <button type="button" onClick={() => compareStore.set([])} className="h-11 px-2 font-semibold text-[#cfdbf2] hover:text-white">
        Očisti
      </button>
      <Link href="/uporedi" className="ml-auto flex h-12 items-center rounded-xl bg-white px-5 font-bold text-shop-navy hover:bg-shop-tint">
        Uporedi →
      </Link>
    </div>
  );
}
