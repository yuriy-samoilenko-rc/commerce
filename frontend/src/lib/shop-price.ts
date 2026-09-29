import type { PublicProduct } from "./backend-types";

// Pure price helpers, safe on the server and in the browser.

/** What a price tag shows: the price now, the crossed-out one and the saving. */
export function priceOf(p: Pick<PublicProduct, "sellingPrice" | "discountPrice" | "shopPrice">) {
  const now = Number(p.shopPrice);
  const regular = Number(p.sellingPrice);
  const onSale = p.discountPrice !== null && now < regular;
  return {
    now,
    old: onSale ? regular : null,
    saving: onSale ? regular - now : 0,
    percent: onSale ? Math.round((1 - now / regular) * 100) : 0,
  };
}

/** Courier delivery for this subtotal, and how far it is from free delivery. */
export function courierQuote(subtotal: number, courierFee: number, freeFrom: number | null) {
  const free = freeFrom !== null && subtotal >= freeFrom;
  return {
    fee: free ? 0 : courierFee,
    free,
    missing: freeFrom === null || free ? 0 : freeFrom - subtotal,
    progress: freeFrom === null ? null : Math.min(100, Math.round((subtotal / Math.max(freeFrom, 0.01)) * 100)),
  };
}
