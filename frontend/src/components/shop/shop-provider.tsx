"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { PublicProduct, WishlistIds } from "@/lib/backend-types";
import { cart, guestWishlistStore, useStore } from "@/lib/shop-store";
import { MiniCart } from "./mini-cart";

export type ShopCustomer = { name: string; email: string; phone: string | null; deliveryAddress: string | null };
export type Delivery = { courierFee: number; freeShippingFrom: number | null };

type ShopContext = {
  customer: ShopCustomer | null;
  delivery: Delivery;
  wishlist: string[];
  toggleWish: (product: Pick<PublicProduct, "id" | "name">) => void;
  /** Puts the product in the cart and shows the mini cart. */
  addToCart: (product: PublicProduct, quantity?: number) => void;
};

const Context = createContext<ShopContext | null>(null);

export function useShop() {
  const ctx = use(Context);
  if (!ctx) throw new Error("useShop outside ShopProvider");
  return ctx;
}

export function ShopProvider({
  customer,
  delivery,
  initialWishlist,
  children,
}: {
  customer: ShopCustomer | null;
  delivery: Delivery;
  /** The customer's saved wishlist (ignored for guests, theirs is in the browser). */
  initialWishlist: string[];
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const guestWishlist = useStore(guestWishlistStore);
  const [serverWishlist, setServerWishlist] = useState(initialWishlist);
  const wishlist = customer ? serverWishlist : guestWishlist;
  const [added, setAdded] = useState<{ product: PublicProduct; quantity: number } | null>(null);

  const toggleWish = useCallback(
    (product: Pick<PublicProduct, "id" | "name">) => {
      const wished = wishlist.includes(product.id);
      if (!customer) {
        guestWishlistStore.set(wished ? wishlist.filter((id) => id !== product.id) : [product.id, ...wishlist]);
      } else {
        // Optimistic: the heart changes at once, the server answer settles it.
        setServerWishlist(wished ? wishlist.filter((id) => id !== product.id) : [product.id, ...wishlist]);
        api<WishlistIds>(`/wishlist/${product.id}`, { method: wished ? "DELETE" : "PUT" })
          .then((r) => {
            setServerWishlist(r.productIds);
            void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
          })
          .catch((e) => {
            setServerWishlist(wishlist);
            toast.error(e instanceof ApiError ? e.message : "Lista želja trenutno nije dostupna.");
          });
      }
      toast.success(wished ? `„${product.name}“ je uklonjen sa liste želja.` : `„${product.name}“ je na listi želja.`);
    },
    [customer, wishlist, queryClient],
  );

  const addToCart = useCallback((product: PublicProduct, quantity = 1) => {
    cart.add(product.id, quantity);
    setAdded({ product, quantity });
  }, []);

  const value = useMemo(
    () => ({ customer, delivery, wishlist, toggleWish, addToCart }),
    [customer, delivery, wishlist, toggleWish, addToCart],
  );

  return (
    <Context value={value}>
      {children}
      <MiniCart added={added} onClose={() => setAdded(null)} delivery={delivery} />
    </Context>
  );
}
