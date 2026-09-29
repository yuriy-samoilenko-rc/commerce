"use client";

import { Heart, ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { PublicProduct } from "@/lib/backend-types";
import { productHref } from "@/lib/shop-links";
import { compareStore, toggleCompare, useStore } from "@/lib/shop-store";
import { cn } from "@/lib/utils";
import { PriceTag, ProductPhoto, SaleBadge, StockLine, Stars } from "./bits";
import { useShop } from "./shop-provider";

/** A product tile: lifts on hover and shows the second photo, like the design. */
export function ProductCard({ product, compare }: { product: PublicProduct; compare?: boolean }) {
  const { wishlist, toggleWish, addToCart } = useShop();
  const compared = useStore(compareStore).includes(product.id);
  const wished = wishlist.includes(product.id);
  const href = productHref(product);
  const rating = product.ratingCount ? Number(product.ratingAvg) : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[20px] border border-shop-line bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(14,42,107,0.12)]">
      <div className="relative overflow-hidden bg-shop-ground">
        <Link href={href} className="relative block aspect-square" tabIndex={-1} aria-hidden>
          <ProductPhoto
            product={product}
            sizes="(min-width: 1024px) 300px, 50vw"
            className="transition duration-300 group-hover:scale-[1.04]"
          />
          {product.images.length > 1 && (
            <ProductPhoto
              product={product}
              index={1}
              alt=""
              sizes="(min-width: 1024px) 300px, 50vw"
              className="opacity-0 transition duration-300 group-hover:opacity-100"
            />
          )}
        </Link>
        <SaleBadge product={product} className="absolute top-3.5 left-3.5" />
        <button
          type="button"
          onClick={() => toggleWish(product)}
          aria-pressed={wished}
          aria-label={wished ? `Ukloni ${product.name} sa liste želja` : `Dodaj ${product.name} na listu želja`}
          className={cn(
            "absolute top-2.5 right-2.5 flex size-11 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(11,27,51,0.12)] transition hover:scale-105",
            wished ? "text-shop-sale" : "text-shop-muted",
          )}
        >
          <Heart className="size-5" fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="flex grow flex-col gap-2 p-4 sm:p-[18px]">
        {product.brand && <span className="text-[13px] font-semibold text-shop-muted">{product.brand.name}</span>}
        <Link href={href} className="min-h-[43px] text-[15px] leading-snug font-semibold text-shop-ink hover:text-shop-blue sm:text-base">
          {product.name}
        </Link>
        {rating !== null && (
          <span className="flex items-center gap-1.5 text-[13px] text-shop-muted">
            <Stars value={rating} className="text-sm" /> ({product.ratingCount})
          </span>
        )}
        <StockLine inStock={product.inStock} />
        <div className="mt-auto pt-1">
          <PriceTag product={product} />
        </div>
        <div className="flex items-center gap-2.5">
          {product.inStock ? (
            <button
              type="button"
              onClick={() => addToCart(product)}
              className="flex h-[46px] grow items-center justify-center gap-2 rounded-xl bg-shop-blue text-[15px] font-bold text-white transition hover:bg-shop-blue-dark"
            >
              <ShoppingCart className="size-[18px]" /> U korpu
            </button>
          ) : (
            <Link
              href={href}
              className="flex h-[46px] grow items-center justify-center rounded-xl border-[1.5px] border-shop-field text-[15px] font-bold text-shop-ink hover:border-shop-blue"
            >
              Detalji
            </Link>
          )}
          {compare && (
            <label className="flex h-[46px] cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-shop-field px-3 text-sm font-semibold text-shop-ink">
              <input
                type="checkbox"
                checked={compared}
                onChange={() => toggleCompare(product.id)}
                className="size-[18px] accent-shop-blue"
              />
              Uporedi
            </label>
          )}
        </div>
      </div>
    </article>
  );
}
