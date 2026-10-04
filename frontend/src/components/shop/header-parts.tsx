"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Heart, Menu, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import type { Facets, PublicProductList, ShopCategory } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { categoryHref, productHref } from "@/lib/shop-links";
import { cartStore, useStore } from "@/lib/shop-store";
import { cn } from "@/lib/utils";
import { ProductPhoto } from "./bits";
import { useShop } from "./shop-provider";

const count = (n: number) => (n === 1 ? "1 proizvod" : `${n} proizvoda`);

function Badge({ value, tone }: { value: number; tone: "blue" | "sale" }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "absolute -top-2 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white",
        tone === "blue" ? "bg-shop-blue" : "bg-shop-sale",
      )}
    >
      {value}
    </span>
  );
}

export function WishlistLink() {
  const { wishlist, customer } = useShop();
  return (
    <Link
      href={customer ? "/nalog/lista-zelja" : "/lista-zelja"}
      aria-label={`Lista želja, ${wishlist.length}`}
      className="relative flex size-11 items-center justify-center rounded-xl text-shop-ink hover:bg-shop-ground sm:size-12"
    >
      <span className="relative flex">
        <Heart className="size-[22px]" />
        <Badge value={wishlist.length} tone="sale" />
      </span>
    </Link>
  );
}

export function CartLink() {
  const pieces = useStore(cartStore).reduce((s, l) => s + l.quantity, 0);
  return (
    <Link
      href="/korpa"
      aria-label={`Korpa, ${pieces} kom.`}
      className="flex h-11 items-center gap-2.5 rounded-xl bg-shop-tint px-3 font-semibold text-shop-ink sm:h-12 sm:px-4"
    >
      <span className="relative flex">
        <ShoppingCart className="size-[22px]" />
        <Badge value={pieces} tone="blue" />
      </span>
      <span className="hidden sm:inline">Korpa</span>
    </Link>
  );
}

/** "Sve kategorije": categories on the left, the chosen one's brands and top products right. */
export function MegaMenu({ categories }: { categories: ShopCategory[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const cat = categories[active];

  // Close on navigation, outside click and Escape.
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const products = useQuery({
    queryKey: ["mega-products", cat?.id],
    enabled: open && !!cat,
    queryFn: () => api<PublicProductList>(`/products?categoryId=${cat.id}&inStock=true&sort=price_desc&limit=2`),
  });
  const facets = useQuery({
    queryKey: ["facets", cat?.id],
    enabled: open && !!cat,
    queryFn: () => api<Facets>(`/shop/facets?categoryId=${cat.id}`),
  });

  if (!cat) return null;
  return (
    <div ref={box} className="static shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] bg-shop-blue px-4 font-bold whitespace-nowrap text-white hover:bg-shop-blue-dark"
      >
        <Menu className="size-[18px]" strokeWidth={2.2} /> Sve kategorije
      </button>
      {open && (
        <div className="absolute inset-x-4 top-full z-40 flex overflow-hidden rounded-b-3xl border border-shop-line bg-white shadow-[0_24px_48px_rgba(11,27,51,0.18)] lg:inset-x-20">
          <ul className="flex w-[300px] shrink-0 flex-col gap-0.5 bg-shop-ground p-3">
            {categories.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex h-12 w-full items-center justify-between rounded-xl px-4 text-[15px]",
                    i === active ? "bg-white font-bold text-shop-blue shadow-sm" : "font-semibold text-shop-ink",
                  )}
                >
                  {c.name}
                  <ChevronRight className="size-4 opacity-60" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex grow gap-10 p-8">
            <div className="flex w-64 flex-col gap-3.5">
              <Link href={categoryHref(cat)} className="font-display text-[22px] font-bold text-shop-ink hover:text-shop-blue">
                {cat.name}
              </Link>
              <span className="text-sm text-shop-muted">{count(cat.productCount)}</span>
              {cat.children.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {cat.children.map((c) => (
                    <Link key={c.id} href={categoryHref(c)} className="text-[15px] font-semibold text-shop-ink hover:text-shop-blue">
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
              {!!facets.data?.brands.length && (
                <>
                  <span className="mt-2 text-[13px] font-bold tracking-wider text-shop-muted">BRENDOVI</span>
                  <div className="flex flex-wrap gap-2">
                    {facets.data.brands.map((b) => (
                      <Link
                        key={b.id}
                        href={`${categoryHref(cat)}?brend=${b.id}`}
                        className="rounded-[10px] border border-shop-line px-3 py-2 text-sm font-semibold text-shop-ink hover:border-shop-blue"
                      >
                        {b.name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
              <Link href={categoryHref(cat)} className="mt-auto font-bold text-shop-blue">
                Sve iz kategorije →
              </Link>
            </div>
            <div className="flex grow flex-col gap-3.5">
              <span className="text-[13px] font-bold tracking-wider text-shop-muted">IZDVOJENO</span>
              <div className="grid grid-cols-2 gap-4">
                {products.data?.items.map((p) => (
                  <Link
                    key={p.id}
                    href={productHref(p)}
                    className="flex items-center gap-4 rounded-[18px] border border-shop-line p-3.5 transition hover:-translate-y-0.5 hover:border-[#9DB6E8] hover:shadow-lg"
                  >
                    <span className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-shop-ground">
                      <ProductPhoto product={p} sizes="112px" />
                    </span>
                    <span className="flex flex-col gap-1.5">
                      <strong className="text-[15px] leading-snug text-shop-ink">{p.name}</strong>
                      <span className="font-display text-lg font-bold text-shop-blue">{money(p.shopPrice)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The phone menu: categories and the account links. */
export function MobileMenu({ categories, account }: { categories: ShopCategory[]; account: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    setOpen(false);
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Meni"
        className="flex size-11 items-center justify-center rounded-xl text-shop-ink lg:hidden"
      >
        <Menu className="size-[22px]" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="shop w-[85vw] max-w-sm gap-1 overflow-y-auto p-4 font-shop">
          <SheetTitle className="px-2 pt-2 pb-3 font-display text-xl font-bold text-shop-ink">Kategorije</SheetTitle>
          <SheetDescription className="sr-only">Kategorije proizvoda i nalog</SheetDescription>
          {categories.map((c) => (
            <div key={c.id} className="flex flex-col">
              <Link href={categoryHref(c)} className="flex h-12 items-center justify-between rounded-xl px-3 font-semibold text-shop-ink hover:bg-shop-ground">
                {c.name}
                <span className="text-sm font-normal text-shop-muted">{c.productCount}</span>
              </Link>
              {c.children.map((k) => (
                <Link key={k.id} href={categoryHref(k)} className="flex h-11 items-center rounded-xl pl-7 text-shop-body hover:bg-shop-ground">
                  {k.name}
                </Link>
              ))}
            </div>
          ))}
          <div className="my-3 border-t border-shop-line" />
          <Link href="/katalog?akcija=1" className="flex h-12 items-center rounded-xl px-3 font-bold text-shop-sale hover:bg-shop-ground">
            Akcije
          </Link>
          <Link href="/uporedi" className="flex h-12 items-center rounded-xl px-3 font-semibold text-shop-ink hover:bg-shop-ground">
            Uporedi proizvode
          </Link>
          <Link href={account.href} className="flex h-12 items-center rounded-xl px-3 font-semibold text-shop-ink hover:bg-shop-ground">
            {account.label}
          </Link>
        </SheetContent>
      </Sheet>
    </>
  );
}
