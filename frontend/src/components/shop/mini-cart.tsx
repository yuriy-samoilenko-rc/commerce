"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import type { PublicProduct, Recommendations } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { useCart } from "@/lib/shop-products";
import { cart } from "@/lib/shop-store";
import { cn } from "@/lib/utils";
import { FreeShippingBar, PriceTag, ProductPhoto } from "./bits";
import type { Delivery } from "./shop-provider";

/** Slides in after "U korpu": what was added, what goes with it, and the way to the cart. */
export function MiniCart({
  added,
  onClose,
  delivery,
}: {
  added: { product: PublicProduct; quantity: number } | null;
  onClose: () => void;
  delivery: Delivery;
}) {
  const { subtotal, lines } = useCart();
  const addOns = useQuery({
    queryKey: ["recommendations", added?.product.id],
    enabled: !!added,
    queryFn: () => api<Recommendations>(`/products/${added!.product.id}/recommendations`),
    select: (r) => r.addOns.filter((p) => !lines.some((l) => l.productId === p.id)).slice(0, 3),
  });

  return (
    <Sheet open={!!added} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="shop w-full gap-5 overflow-y-auto p-6 font-shop sm:max-w-md">
        <SheetTitle className="flex items-center gap-2.5 font-display text-xl font-bold text-shop-ok">
          <Check className="size-6" strokeWidth={2.6} /> Dodato u korpu
        </SheetTitle>
        <SheetDescription className="sr-only">Proizvod je dodat u korpu.</SheetDescription>
        {added && (
          <div className="flex items-center gap-4 rounded-2xl bg-shop-ground p-3.5">
            <span className="relative size-22 shrink-0 overflow-hidden rounded-xl bg-white">
              <ProductPhoto product={added.product} sizes="88px" />
            </span>
            <span className="flex flex-col gap-1.5">
              <strong className="text-[15px] leading-snug text-shop-ink">{added.product.name}</strong>
              <span className="text-sm text-shop-muted">{added.quantity} kom.</span>
              <PriceTag product={added.product} size="sm" />
            </span>
          </div>
        )}
        <FreeShippingBar
          subtotal={subtotal}
          courierFee={delivery.courierFee}
          freeShippingFrom={delivery.freeShippingFrom}
        />
        {!!addOns.data?.length && (
          <div className="flex flex-col gap-3">
            <strong className="font-display text-[17px] text-shop-ink">Kupite uz ovo</strong>
            {addOns.data.map((p) => (
              <div key={p.id} className="flex items-center gap-3.5">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-shop-ground">
                  <ProductPhoto product={p} sizes="64px" />
                </span>
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-sm font-semibold text-shop-ink">{p.name}</span>
                  <span className="text-sm font-bold text-shop-blue">{money(p.shopPrice)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => cart.add(p.id)}
                  aria-label={`Dodaj ${p.name} u korpu`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-shop-field text-shop-ink hover:border-shop-blue hover:text-shop-blue"
                >
                  <Plus className="size-5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-baseline justify-between border-t border-shop-line pt-4">
          <span className="font-semibold text-shop-ink">Međuzbir korpe</span>
          <span className="font-display text-[22px] font-bold text-shop-ink">{money(subtotal)}</span>
        </div>
        <Link href="/korpa" onClick={onClose} className={cn(buttonVariants({ size: "lg" }), "h-13 rounded-2xl text-base font-bold")}>
          Idi u korpu
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="h-13 rounded-2xl border-[1.5px] border-shop-field text-base font-bold text-shop-ink hover:bg-shop-ground"
        >
          Nastavi kupovinu
        </button>
      </SheetContent>
    </Sheet>
  );
}
