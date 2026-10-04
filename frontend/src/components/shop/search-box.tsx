"use client";

import { useQuery } from "@tanstack/react-query";
import { ImageOff, Search } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Suggestions } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { categoryHref, productHref } from "@/lib/shop-links";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

type Item = { key: string; href: string };

/**
 * The header search with suggestions (ARIA combobox): products with photo and price,
 * then categories and brands; arrows move, Enter opens, Escape closes. Without a
 * choice, Enter searches the whole catalog.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  // The catalog's own search text stays in the field there.
  const [text, setText] = useState(() => (pathname.startsWith("/katalog") ? (params.get("q") ?? "") : ""));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = useDebounced(text.trim(), 200);

  const { data } = useQuery({
    queryKey: ["suggest", q],
    enabled: q.length >= 2,
    queryFn: () => api<Suggestions>(`/shop/suggest?q=${encodeURIComponent(q)}`),
    placeholderData: (prev) => prev,
  });
  const s = q.length >= 2 ? data : undefined;
  const items: Item[] = s
    ? [
        ...s.products.map((p) => ({ key: `p-${p.id}`, href: productHref(p) })),
        ...s.categories.map((c) => ({ key: `c-${c.id}`, href: categoryHref(c) })),
        ...s.brands.map((b) => ({ key: `b-${b.id}`, href: `/katalog?brend=${b.id}` })),
        { key: "all", href: `/katalog?q=${encodeURIComponent(q)}` },
      ]
    : [];
  const show = open && items.length > 0;
  const optionId = (key: string) => `${id}-${key}`;
  const index = (key: string) => items.findIndex((i) => i.key === key);

  const go = (href: string) => {
    setOpen(false);
    setActive(-1);
    router.push(href);
  };

  const option = (key: string, children: React.ReactNode, extra?: string) => {
    const i = index(key);
    return (
      <li
        key={key}
        id={optionId(key)}
        role="option"
        aria-selected={i === active}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => go(items[i].href)}
        className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", i === active && "bg-shop-tint", extra)}
      >
        {children}
      </li>
    );
  };

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form
        action="/katalog"
        role="search"
        onSubmit={(e) => {
          if (active >= 0 && items[active]) {
            e.preventDefault();
            go(items[active].href);
          } else setOpen(false);
        }}
      >
        <div className="flex h-12 overflow-hidden rounded-xl border-[1.5px] border-shop-field bg-white focus-within:border-shop-blue">
          <input
            type="search"
            name="q"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setActive(-1);
              } else if (show && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                const last = items.length - 1;
                setActive((a) => (e.key === "ArrowDown" ? (a < last ? a + 1 : 0) : a <= 0 ? last : a - 1));
              }
            }}
            role="combobox"
            aria-label="Pretraga"
            aria-autocomplete="list"
            aria-expanded={show}
            aria-controls={`${id}-list`}
            aria-activedescendant={show && active >= 0 && items[active] ? optionId(items[active].key) : undefined}
            autoComplete="off"
            placeholder="Pretražite televizore, telefone, laptopove…"
            className="min-w-0 grow bg-transparent px-4 text-[15px] text-shop-ink outline-none placeholder:text-shop-muted"
          />
          <button type="submit" aria-label="Traži" className="flex w-14 items-center justify-center bg-shop-blue text-white hover:bg-shop-blue-dark">
            <Search className="size-5" />
          </button>
        </div>
      </form>
      {show && s && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Prijedlozi"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-50 flex max-h-[70vh] flex-col overflow-y-auto rounded-2xl border border-shop-line bg-white p-2 shadow-[0_24px_48px_rgba(11,27,51,0.18)]"
        >
          {s.products.length > 0 && (
            <li role="presentation" className="px-3 pt-1.5 pb-1 text-[12px] font-bold tracking-wider text-shop-muted">
              PROIZVODI
            </li>
          )}
          {s.products.map((p) =>
            option(
              `p-${p.id}`,
              <>
                <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-shop-ground">
                  {p.thumbUrl ? (
                    <Image src={p.thumbUrl} alt="" fill unoptimized sizes="48px" className="object-cover" />
                  ) : (
                    <ImageOff className="size-4 text-shop-muted" />
                  )}
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-[15px] font-semibold text-shop-ink">{p.name}</span>
                  <span className="text-[13px] text-shop-muted">
                    {p.brand?.name}
                    {!p.inStock && " · nema na stanju"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-display font-bold text-shop-ink">{money(p.shopPrice)}</span>
                  {p.discountPrice && <span className="text-[12px] text-shop-muted line-through">{money(p.sellingPrice)}</span>}
                </span>
              </>,
            ),
          )}
          {(s.categories.length > 0 || s.brands.length > 0) && (
            <li role="presentation" className="px-3 pt-3 pb-1 text-[12px] font-bold tracking-wider text-shop-muted">
              KATEGORIJE I BRENDOVI
            </li>
          )}
          {s.categories.map((c) => option(`c-${c.id}`, <span className="text-[15px] text-shop-ink">{c.name}</span>))}
          {s.brands.map((b) =>
            option(
              `b-${b.id}`,
              <span className="text-[15px] text-shop-ink">
                {b.name} <span className="text-shop-muted">· brend</span>
              </span>,
            ),
          )}
          {option(
            "all",
            <span className="font-semibold text-shop-blue">Prikaži sve rezultate za „{q}“ →</span>,
            "mt-1 border-t border-shop-line pt-3",
          )}
        </ul>
      )}
    </div>
  );
}
