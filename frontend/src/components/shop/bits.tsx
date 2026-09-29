import { ImageOff } from "lucide-react";
import Image from "next/image";
import type { PublicProduct } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { courierQuote, priceOf } from "@/lib/shop-price";
import { cn } from "@/lib/utils";

type WithImages = Pick<PublicProduct, "name" | "images">;

/** The product's first photo (or a neutral placeholder), filling its box. */
export function ProductPhoto({
  product,
  index = 0,
  large,
  sizes,
  className,
  alt,
}: {
  product: WithImages;
  index?: number;
  large?: boolean;
  sizes: string;
  className?: string;
  alt?: string;
}) {
  const image = product.images[index];
  if (!image)
    return (
      <span className={cn("flex size-full items-center justify-center bg-shop-ground text-shop-muted", className)}>
        <ImageOff className="size-1/4" aria-label="Bez slike" />
      </span>
    );
  return (
    <Image
      src={large ? image.url : image.thumbUrl}
      alt={alt ?? image.alt ?? product.name}
      fill
      unoptimized
      sizes={sizes}
      className={cn("object-cover", className)}
    />
  );
}

/** Current price, the regular one crossed out when on sale. */
export function PriceTag({
  product,
  size = "md",
  inverse,
}: {
  product: Pick<PublicProduct, "sellingPrice" | "discountPrice" | "shopPrice">;
  size?: "sm" | "md" | "lg";
  /** White text, for dark backgrounds. */
  inverse?: boolean;
}) {
  const p = priceOf(product);
  return (
    <span className="flex flex-wrap items-baseline gap-x-2.5">
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          inverse ? "text-white" : "text-shop-ink",
          size === "sm" && "text-lg",
          size === "md" && "text-[22px]",
          size === "lg" && "text-4xl",
        )}
      >
        {money(p.now)}
      </span>
      {p.old !== null && (
        <span className={cn("line-through", inverse ? "text-[#9fb3d9]" : "text-shop-muted", size === "lg" ? "text-lg" : "text-sm")}>{money(p.old)}</span>
      )}
    </span>
  );
}

export function SaleBadge({ product, className }: { product: Parameters<typeof priceOf>[0]; className?: string }) {
  const { percent } = priceOf(product);
  if (!percent) return null;
  return (
    <span className={cn("rounded-lg bg-shop-sale px-2.5 py-1 text-[13px] font-bold text-white", className)}>
      −{percent}%
    </span>
  );
}

export function StockLine({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-shop-ok">
      <span className="size-2 rounded-full bg-shop-ok" aria-hidden />
      Na stanju
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-shop-muted">
      <span className="size-2 rounded-full bg-slate-400" aria-hidden />
      Trenutno nema na stanju
    </span>
  );
}

/** "Još 12,20 € do besplatne dostave" with a bar; nothing when there is no threshold. */
export function FreeShippingBar({
  subtotal,
  courierFee,
  freeShippingFrom,
  className,
}: {
  subtotal: number;
  courierFee: number;
  freeShippingFrom: number | null;
  className?: string;
}) {
  const q = courierQuote(subtotal, courierFee, freeShippingFrom);
  if (q.progress === null) return null;
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl p-3.5", q.free ? "bg-shop-ok-tint" : "bg-shop-tint", className)}>
      <span className={cn("text-sm font-bold", q.free ? "text-shop-ok" : "text-shop-navy")}>
        {q.free ? "Ostvarili ste besplatnu dostavu" : `Još ${money(q.missing)} do besplatne dostave`}
      </span>
      <div
        className="h-2 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={q.progress}
        aria-label="Do besplatne dostave"
      >
        <div className={cn("h-2 rounded-full", q.free ? "bg-shop-ok" : "bg-shop-blue")} style={{ width: `${q.progress}%` }} />
      </div>
    </div>
  );
}

/** ★★★★☆ for an average (rounded to whole stars), with a text for screen readers. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("tracking-[2px] text-shop-star", className)} role="img" aria-label={`Ocjena ${value} od 5`}>
      {"★".repeat(full)}
      <span className="text-shop-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}
