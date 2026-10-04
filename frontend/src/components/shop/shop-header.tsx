import { Tag, User } from "lucide-react";
import Link from "next/link";
import type { ShopCategory, ShopInfo, User as UserType } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { categoryHref } from "@/lib/shop-links";
import { SearchBox } from "./search-box";
import { CartLink, MegaMenu, MobileMenu, WishlistLink } from "./header-parts";

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 text-shop-ink" aria-label="TechStore, početna">
      <svg width={small ? 28 : 34} height={small ? 28 : 34} viewBox="0 0 34 34" aria-hidden>
        <rect width="34" height="34" rx="9" fill="#1d4fd8" />
        <path d="M10 12h14M17 12v12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={small ? "font-display text-[19px] font-bold tracking-tight" : "font-display text-[22px] font-bold tracking-tight"}>
        TechStore
      </span>
    </Link>
  );
}

export function ShopHeader({
  info,
  categories,
  user,
}: {
  info: ShopInfo | null;
  categories: ShopCategory[];
  user: UserType | null;
}) {
  const customer = user?.role === "CUSTOMER" ? user : null;
  const account = customer
    ? { href: "/nalog", label: "Moj nalog" }
    : user
      ? { href: "/admin", label: "Administracija" }
      : { href: "/nalog/prijava", label: "Prijava" };
  const stores = info?.pickupPoints.map((p) => p.name).join(", ");
  const free = info?.freeShippingFrom ? Number(info.freeShippingFrom) : null;

  return (
    <header className="relative z-30 bg-white">
      <div className="hidden h-9 items-center justify-between gap-6 bg-shop-ink px-4 text-[13px] text-[#c9d6ec] md:flex lg:px-20">
        <span className="min-w-0 truncate">
          {stores ? `Preuzimanje: ${stores} · ` : ""}Dostava kurirskom službom širom Crne Gore
          {free !== null ? ` · besplatno od ${money(free)}` : ""} · Plaćanje pouzećem ili na račun
        </span>
        <span className="flex shrink-0 gap-6">
          {info?.phone && <a href={`tel:${info.phone.replace(/\s/g, "")}`} className="text-[#c9d6ec] hover:text-white">{info.phone}</a>}
          {info?.email && <a href={`mailto:${info.email}`} className="text-[#c9d6ec] hover:text-white">{info.email}</a>}
        </span>
      </div>
      <div className="border-b border-shop-line">
        <div className="flex h-16 items-center gap-2 px-2 sm:gap-4 lg:h-20 lg:gap-10 lg:px-20">
          <MobileMenu categories={categories} account={account} />
          <Logo />
          <SearchBox className="hidden grow md:block" />
          <nav aria-label="Nalog i korpa" className="ml-auto flex items-center gap-1 sm:gap-1.5 md:ml-0">
            <Link
              href={account.href}
              className="hidden h-12 items-center gap-2 rounded-xl px-3 font-semibold text-shop-ink hover:bg-shop-ground sm:flex"
            >
              <User className="size-[22px]" />
              {customer ? customer.name.split(" ")[0] : account.label}
            </Link>
            <WishlistLink />
            <CartLink />
          </nav>
        </div>
        <SearchBox className="mx-4 mb-3 md:hidden" />
        <nav aria-label="Kategorije" className="hidden h-[52px] items-center gap-7 px-20 text-[15px] font-semibold lg:flex">
          {/* Categories take what room is left; the ones that do not fit are in "Sve kategorije". */}
          <MegaMenu categories={categories} />
          <div className="flex h-full min-w-0 grow flex-wrap items-center gap-x-7 overflow-hidden">
            {categories.slice(0, 8).map((c) => (
              <Link key={c.id} href={categoryHref(c)} className="flex h-full items-center whitespace-nowrap text-shop-ink hover:text-shop-blue">
                {c.name}
              </Link>
            ))}
          </div>
          <Link href="/uporedi" className="shrink-0 whitespace-nowrap text-shop-ink hover:text-shop-blue">
            Uporedi
          </Link>
          <Link href="/katalog?akcija=1" className="flex shrink-0 items-center gap-1.5 text-shop-sale">
            <Tag className="size-[18px]" /> Akcije
          </Link>
        </nav>
      </div>
    </header>
  );
}
