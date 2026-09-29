"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useShop } from "@/components/shop/shop-provider";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/nalog", label: "Pregled" },
  { href: "/nalog/narudzbe", label: "Moje narudžbe" },
  { href: "/nalog/lista-zelja", label: "Lista želja", wish: true },
  { href: "/nalog/podaci", label: "Lični podaci i adresa" },
];

export function AccountNav({ name, email, initials }: { name: string; email: string; initials: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { wishlist } = useShop();
  const active = (href: string) => (href === "/nalog" ? pathname === href : pathname.startsWith(href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/");
    router.refresh();
  }

  return (
    <nav aria-label="Moj nalog" className="flex shrink-0 flex-col gap-1 rounded-3xl border border-shop-line bg-white p-4 lg:w-[280px] lg:p-5">
      <div className="mb-2 flex items-center gap-3.5 border-b border-[#e6ecf5] px-1 pb-4">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-shop-blue font-display text-lg font-bold text-white">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col">
          <strong className="truncate">{name}</strong>
          <span className="truncate text-[13px] text-shop-muted">{email}</span>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto lg:flex-col">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active(l.href) ? "page" : undefined}
            className={cn(
              "flex h-12 shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 text-[15px] whitespace-nowrap",
              active(l.href) ? "bg-shop-tint font-bold text-shop-blue" : "font-semibold text-shop-ink hover:bg-shop-ground",
            )}
          >
            {l.label}
            {l.wish && wishlist.length > 0 && <span className="text-[13px] text-shop-muted">{wishlist.length}</span>}
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={logout}
        className="mt-2 flex h-12 items-center rounded-xl border-t border-[#e6ecf5] px-3.5 text-left font-semibold text-shop-muted hover:text-shop-ink"
      >
        Odjava
      </button>
    </nav>
  );
}
