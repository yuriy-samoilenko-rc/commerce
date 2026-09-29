import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { PublicProduct, PublicProductList } from "./backend-types";
export { courierQuote, priceOf } from "./shop-price";
import { cartStore, useStore } from "./shop-store";

/** Public products by id (compare list, guest wishlist, cart), in the given order. */
export function useProductsByIds(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["products-by-ids", key],
    enabled: ids.length > 0,
    queryFn: () => api<PublicProductList>(`/products?ids=${key}&limit=50`),
    select: (data) => {
      const byId = new Map(data.items.map((p) => [p.id, p]));
      return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    },
  });
}

export type CartItem = { product: PublicProduct; quantity: number; total: number };

/** The cart with current prices from the API; lines of vanished products drop out. */
export function useCart() {
  const lines = useStore(cartStore);
  const products = useProductsByIds(lines.map((l) => l.productId));
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]));
  const items: CartItem[] = lines.flatMap((l) => {
    const product = byId.get(l.productId);
    return product ? [{ product, quantity: l.quantity, total: Number(product.shopPrice) * l.quantity }] : [];
  });
  return {
    lines,
    items,
    loading: lines.length > 0 && products.isPending,
    pieces: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.total, 0),
  };
}
