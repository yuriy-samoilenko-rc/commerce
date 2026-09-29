"use client";

import { Columns2, Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProductPhoto } from "@/components/shop/bits";
import { useShop } from "@/components/shop/shop-provider";
import { api, ApiError } from "@/lib/api";
import type { PublicProduct, PublicProductDetail } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { cart, compareStore, MAX_QTY, toggleCompare, useStore } from "@/lib/shop-store";
import { cn } from "@/lib/utils";

export function Gallery({ product }: { product: PublicProductDetail }) {
  const [index, setIndex] = useState(0);
  const images = product.images;
  const image = images[index];
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-shop-line bg-white">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            unoptimized
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
          />
        ) : (
          <ProductPhoto product={product} sizes="640px" />
        )}
      </div>
      {images.length > 1 && (
        <div role="group" aria-label="Slike proizvoda" className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slika ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative size-20 overflow-hidden rounded-2xl bg-white sm:size-24",
                i === index ? "border-2 border-shop-blue" : "border border-shop-line",
              )}
            >
              <Image src={img.thumbUrl} alt="" fill unoptimized sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quantity, "Dodaj u korpu", wishlist and compare. */
export function BuyBox({ product }: { product: PublicProduct }) {
  const { addToCart, toggleWish, wishlist } = useShop();
  const compared = useStore(compareStore).includes(product.id);
  const [qty, setQty] = useState(1);
  const wished = wishlist.includes(product.id);
  return (
    <div className="flex flex-col gap-3">
      {product.inStock ? (
        <div className="flex gap-3">
          <div role="group" aria-label="Količina" className="flex h-14 items-center overflow-hidden rounded-2xl border-[1.5px] border-shop-field bg-white">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Manje" className="flex h-14 w-12 items-center justify-center hover:bg-shop-ground">
              <Minus className="size-5" />
            </button>
            <span className="w-10 text-center text-[17px] font-bold" aria-live="polite">
              {qty}
            </span>
            <button type="button" onClick={() => setQty(Math.min(MAX_QTY, qty + 1))} aria-label="Više" className="flex h-14 w-12 items-center justify-center hover:bg-shop-ground">
              <Plus className="size-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => addToCart(product, qty)}
            className="flex h-14 grow items-center justify-center gap-2.5 rounded-2xl bg-shop-blue text-[17px] font-bold text-white hover:bg-shop-blue-dark"
          >
            <ShoppingCart className="size-5" /> Dodaj u korpu
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-shop-ground p-4 text-[15px] text-shop-muted">
          Proizvod trenutno nije na stanju. Dodajte ga na listu želja i vratite se uskoro.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => toggleWish(product)}
          aria-pressed={wished}
          className={cn(
            "flex h-[46px] grow items-center justify-center gap-2 rounded-xl border-[1.5px] border-shop-field bg-white text-[15px] font-bold hover:border-shop-blue",
            wished ? "text-shop-sale" : "text-shop-ink",
          )}
        >
          <Heart className="size-5" fill={wished ? "currentColor" : "none"} />
          {wished ? "Na listi želja" : "Dodaj na listu želja"}
        </button>
        <button
          type="button"
          onClick={() => toggleCompare(product.id)}
          aria-pressed={compared}
          className={cn(
            "flex h-[46px] grow items-center justify-center gap-2 rounded-xl border-[1.5px] bg-white text-[15px] font-bold",
            compared ? "border-shop-blue text-shop-blue" : "border-shop-field text-shop-ink hover:border-shop-blue",
          )}
        >
          <Columns2 className="size-5" /> {compared ? "U poređenju" : "Uporedi"}
        </button>
      </div>
      {compared && (
        <Link href="/uporedi" className="self-start text-sm font-semibold text-shop-blue">
          Otvori poređenje →
        </Link>
      )}
    </div>
  );
}

/** "Kupite uz ovo": the product plus ticked add-ons, into the cart in one go. */
export function Bundle({ product, addOns }: { product: PublicProduct; addOns: PublicProduct[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => addOns.slice(0, 2).map((a) => a.id));
  const chosen = addOns.filter((a) => picked.includes(a.id));
  const total = Number(product.shopPrice) + chosen.reduce((s, a) => s + Number(a.shopPrice), 0);
  const n = chosen.length + 1;
  return (
    <section aria-label="Kupite uz ovo" className="flex flex-col gap-5 rounded-3xl border border-shop-line bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">Kupite uz ovo</h2>
        <span className="text-[15px] text-shop-muted">Dodaci koji idu uz ovaj proizvod</span>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3.5 rounded-[18px] bg-shop-ground p-3.5 lg:w-56 lg:shrink-0">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
            <ProductPhoto product={product} sizes="64px" />
          </span>
          <span className="flex flex-col gap-1">
            <strong className="line-clamp-2 text-sm leading-snug">{product.name}</strong>
            <span className="text-[15px] font-bold">{money(product.shopPrice)}</span>
          </span>
        </div>
        {addOns.map((a) => {
          const checked = picked.includes(a.id);
          return (
            <div key={a.id} className="flex items-center gap-3 lg:contents">
              <span className="hidden text-2xl font-light text-slate-400 lg:inline" aria-hidden>
                +
              </span>
              <label
                className={cn(
                  "flex grow cursor-pointer items-center gap-3.5 rounded-[18px] border-[1.5px] p-3.5 lg:w-56 lg:grow-0",
                  checked ? "border-shop-blue" : "border-shop-line",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setPicked(checked ? picked.filter((x) => x !== a.id) : [...picked, a.id])}
                  className="size-5 shrink-0 accent-shop-blue"
                />
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-shop-ground">
                  <ProductPhoto product={a} sizes="64px" />
                </span>
                <span className="flex flex-col gap-1">
                  <strong className="line-clamp-2 text-sm leading-snug">{a.name}</strong>
                  <span className="text-[15px] font-bold">{money(a.shopPrice)}</span>
                </span>
              </label>
            </div>
          );
        })}
        <div className="flex flex-col gap-2.5 lg:ml-auto lg:items-end">
          <span className="text-sm text-shop-muted">Ukupno za {n === 1 ? "1 proizvod" : `${n} proizvoda`}</span>
          <span className="font-display text-[28px] font-bold">{money(total)}</span>
          <button
            type="button"
            disabled={!product.inStock}
            onClick={() => {
              cart.add(product.id);
              chosen.forEach((a) => cart.add(a.id));
              router.push("/korpa");
            }}
            className="flex h-12 items-center justify-center rounded-xl bg-shop-blue px-5 font-bold text-white hover:bg-shop-blue-dark disabled:opacity-50"
          >
            Dodaj izabrano u korpu
          </button>
        </div>
      </div>
    </section>
  );
}

/** Shown to a customer who received the product and has not reviewed it yet. */
export function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <p className="rounded-2xl bg-shop-ok-tint p-4 text-sm font-semibold text-shop-ok">
        Hvala! Vaša ocjena će biti objavljena nakon provjere.
      </p>
    );
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 rounded-xl border-[1.5px] border-shop-blue bg-white font-bold text-shop-blue hover:bg-shop-tint"
      >
        Napišite ocjenu
      </button>
    );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api(`/products/${productId}/reviews`, {
            method: "POST",
            json: { rating, title: String(form.get("title") ?? "") || undefined, text: String(form.get("text") ?? "") },
          });
          // No refresh: the thank-you stays; a later visit shows "awaiting review".
          setSent(true);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Ocjena trenutno ne može da se pošalje.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="flex items-center gap-1">
        <legend className="mb-2 text-sm font-semibold">Vaša ocjena</legend>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} od 5`}
            aria-pressed={n === rating}
            className={cn("size-10 text-3xl leading-none", n <= rating ? "text-shop-star" : "text-shop-line")}
          >
            ★
          </button>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Naslov (nije obavezno)
        <input name="title" maxLength={120} className="h-11 rounded-xl border-[1.5px] border-shop-field px-3 font-normal outline-none focus:border-shop-blue" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Vaše iskustvo
        <textarea
          name="text"
          required
          minLength={10}
          maxLength={3000}
          rows={4}
          className="rounded-xl border-[1.5px] border-shop-field p-3 font-normal outline-none focus:border-shop-blue"
        />
      </label>
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-shop-blue font-bold text-white hover:bg-shop-blue-dark disabled:opacity-60">
        Pošalji ocjenu
      </button>
    </form>
  );
}

/** Phones: price and "Dodaj u korpu" stay at the bottom of the screen. */
export function StickyBuyBar({ product }: { product: PublicProduct }) {
  const { addToCart } = useShop();
  if (!product.inStock) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3.5 border-t border-shop-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(11,27,51,0.08)] lg:hidden">
      <span className="flex flex-col">
        <span className="font-display text-xl font-bold">{money(product.shopPrice)}</span>
        <span className="text-xs text-shop-muted">sa PDV-om</span>
      </span>
      <button
        type="button"
        onClick={() => addToCart(product)}
        className="flex h-[52px] grow items-center justify-center gap-2 rounded-2xl bg-shop-blue text-base font-bold text-white"
      >
        <ShoppingCart className="size-5" /> Dodaj u korpu
      </button>
    </div>
  );
}
