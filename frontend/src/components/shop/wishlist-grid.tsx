"use client";

import Link from "next/link";
import { useProductsByIds } from "@/lib/shop-products";
import { ProductCard } from "./product-card";
import { useShop } from "./shop-provider";

/** The wishlist as product cards (guests read it from the browser, customers from the server). */
export function WishlistGrid() {
  const { wishlist } = useShop();
  const { data = [], isPending } = useProductsByIds(wishlist);
  if (!wishlist.length)
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-shop-field bg-white p-12 text-center">
        <p className="text-shop-muted">Lista želja je prazna. Dodajte proizvode klikom na srce.</p>
        <Link href="/katalog" className="flex h-12 items-center rounded-xl bg-shop-blue px-6 font-bold text-white">
          Pogledajte ponudu
        </Link>
      </div>
    );
  if (isPending) return <div className="h-80 animate-pulse rounded-3xl bg-white" />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
      {data.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
