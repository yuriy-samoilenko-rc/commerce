import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WishlistGrid } from "@/components/shop/wishlist-grid";
import { currentCustomer } from "@/lib/shop-api";

export const metadata: Metadata = { title: "Lista želja" };

/** A guest's wishlist (kept in the browser); a customer's lives in the account. */
export default async function GuestWishlistPage() {
  if (await currentCustomer()) redirect("/nalog/lista-zelja");
  return (
    <main className="flex flex-col gap-6 px-4 pt-6 pb-16 lg:px-20 lg:pt-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Lista želja</h1>
        <p className="text-[15px] text-shop-muted">
          Lista je sačuvana samo u ovom pregledaču.{" "}
          <Link href="/nalog/prijava?next=/nalog/lista-zelja">Prijavite se</Link> da je imate na svakom uređaju.
        </p>
      </div>
      <WishlistGrid />
    </main>
  );
}
