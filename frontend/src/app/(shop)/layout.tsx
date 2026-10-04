import { Figtree, Sora } from "next/font/google";
import { CookieNotice } from "@/components/shop/cookie-notice";
import { ShopFooter } from "@/components/shop/shop-footer";
import { ShopHeader } from "@/components/shop/shop-header";
import { ShopProvider } from "@/components/shop/shop-provider";
import type { WishlistIds } from "@/lib/backend-types";
import { currentUser, shopCategories, shopInfo } from "@/lib/shop-api";
import { apiServer } from "@/lib/session";

// latin-ext carries č, ć, đ, š, ž.
const sora = Sora({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-sora" });
const figtree = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-figtree" });

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const [info, categories, user] = await Promise.all([shopInfo(), shopCategories(), currentUser()]);
  const customer = user?.role === "CUSTOMER" ? user : null;
  const wishlist = customer ? ((await apiServer<WishlistIds>("/wishlist/ids")).data?.productIds ?? []) : [];

  return (
    <div className={`shop ${sora.variable} ${figtree.variable} flex flex-1 flex-col bg-shop-ground font-shop text-shop-ink`}>
      <ShopProvider
        key={customer?.id ?? "guest"}
        customer={
          customer && {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            deliveryAddress: customer.deliveryAddress,
          }
        }
        delivery={{
          courierFee: Number(info?.courierFee ?? 10),
          freeShippingFrom: info?.freeShippingFrom ? Number(info.freeShippingFrom) : null,
        }}
        initialWishlist={wishlist}
      >
        <ShopHeader info={info} categories={categories} user={user} />
        <div className="flex-1">{children}</div>
        <ShopFooter info={info} />
        <CookieNotice />
      </ShopProvider>
    </div>
  );
}
