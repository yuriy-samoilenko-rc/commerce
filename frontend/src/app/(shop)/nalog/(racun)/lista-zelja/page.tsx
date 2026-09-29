import type { Metadata } from "next";
import { WishlistGrid } from "@/components/shop/wishlist-grid";

export const metadata: Metadata = { title: "Lista želja" };

export default function AccountWishlistPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Lista želja</h1>
      <WishlistGrid />
    </>
  );
}
