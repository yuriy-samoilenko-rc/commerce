"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Facets } from "@/lib/backend-types";
import { money, parseDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const SORTS = {
  newest: "Najnovije",
  price_asc: "Cijena: od najniže",
  price_desc: "Cijena: od najviše",
  name: "Naziv (A–Ž)",
} as const;

/** Every filter lives in the URL, so a filtered list can be shared and the back button works. */
function useParamsUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(change)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("strana");
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };
  return { params, update, pending };
}

function Filters({ facets }: { facets: Facets }) {
  const { params, update } = useParamsUpdate();
  const brands = (params.get("brend") ?? "").split(",").filter(Boolean);
  const toggleBrand = (id: string) => {
    const next = brands.includes(id) ? brands.filter((b) => b !== id) : [...brands, id];
    update({ brend: next.join(",") || null });
  };
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const applyPrice = () => {
    const lo = parseDecimal(min);
    const hi = parseDecimal(max);
    update({
      min: lo !== null && !Number.isNaN(lo) ? String(lo) : null,
      max: hi !== null && !Number.isNaN(hi) ? String(hi) : null,
    });
  };

  const group = "flex flex-col gap-3 border-b border-[#e6ecf5] py-5 last:border-0";
  const legend = "pb-3 text-[15px] font-bold text-shop-ink";
  return (
    <div className="flex flex-col">
      {facets.brands.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Brend</legend>
          {facets.brands.map((b) => (
            <label key={b.id} className="flex min-h-7 cursor-pointer items-center gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={brands.includes(b.id)}
                onChange={() => toggleBrand(b.id)}
                className="size-5 accent-shop-blue"
              />
              <span className="grow">{b.name}</span>
              <span className="text-[13px] text-shop-muted">{b.count}</span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className={group}>
        <legend className={legend}>Cijena (€)</legend>
        <form
          className="flex items-center gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrice();
          }}
        >
          <input
            inputMode="decimal"
            aria-label="Cijena od"
            placeholder={facets.minPrice ? String(Math.floor(Number(facets.minPrice))) : "od"}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={applyPrice}
            className="h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-shop-field px-3 text-[15px] outline-none focus:border-shop-blue"
          />
          <span className="text-shop-muted">–</span>
          <input
            inputMode="decimal"
            aria-label="Cijena do"
            placeholder={facets.maxPrice ? String(Math.ceil(Number(facets.maxPrice))) : "do"}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onBlur={applyPrice}
            className="h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-shop-field px-3 text-[15px] outline-none focus:border-shop-blue"
          />
          <button type="submit" className="sr-only">
            Primijeni cijenu
          </button>
        </form>
        {facets.minPrice && facets.maxPrice && (
          <span className="text-[13px] text-shop-muted">
            U ponudi od {money(facets.minPrice)} do {money(facets.maxPrice)}
          </span>
        )}
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Ponuda</legend>
        <label className="flex min-h-7 cursor-pointer items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={params.get("akcija") === "1"}
            onChange={(e) => update({ akcija: e.target.checked ? "1" : null })}
            className="size-5 accent-shop-blue"
          />
          Samo akcije
        </label>
        <label className="flex min-h-7 cursor-pointer items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={params.get("naStanju") === "1"}
            onChange={(e) => update({ naStanju: e.target.checked ? "1" : null })}
            className="size-5 accent-shop-blue"
          />
          Samo na stanju
        </label>
      </fieldset>
    </div>
  );
}

export function FilterSidebar({ facets }: { facets: Facets }) {
  // Remount on every URL change: the price fields then show what the URL says.
  const key = useSearchParams().toString();
  return (
    <aside aria-label="Filteri" className="hidden w-[280px] shrink-0 rounded-[20px] border border-shop-line bg-white px-6 py-2 lg:block">
      <Filters key={key} facets={facets} />
    </aside>
  );
}

export function MobileFilters({ facets }: { facets: Facets }) {
  const [open, setOpen] = useState(false);
  const key = useSearchParams().toString();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-shop-field bg-white px-4 font-semibold lg:hidden"
      >
        <SlidersHorizontal className="size-[18px]" /> Filteri
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="shop w-[85vw] max-w-sm overflow-y-auto p-5 font-shop">
          <SheetTitle className="font-display text-xl font-bold">Filteri</SheetTitle>
          <SheetDescription className="sr-only">Suzite izbor proizvoda</SheetDescription>
          <Filters key={key} facets={facets} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 h-12 rounded-xl bg-shop-blue font-bold text-white"
          >
            Prikaži proizvode
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Active filters as removable chips, plus the sort order. */
export function Toolbar({ chips }: { chips: { key: string; value?: string; label: string }[] }) {
  const { params, update, pending } = useParamsUpdate();
  const remove = (chip: { key: string; value?: string }) => {
    if (chip.key === "brend" && chip.value) {
      const rest = (params.get("brend") ?? "").split(",").filter((b) => b && b !== chip.value);
      update({ brend: rest.join(",") || null });
    } else update({ [chip.key]: null });
  };
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={`${c.key}-${c.value ?? ""}`}
            type="button"
            onClick={() => remove(c)}
            aria-label={`Ukloni filter ${c.label}`}
            className="flex h-9 items-center gap-2 rounded-full bg-shop-tint pr-3 pl-3.5 text-sm font-semibold text-shop-navy hover:bg-[#d6e2ff]"
          >
            {c.label} <X className="size-3.5" strokeWidth={2.6} />
          </button>
        ))}
        {chips.length > 1 && (
          <button
            type="button"
            onClick={() => update(Object.fromEntries(chips.map((c) => [c.key, null])))}
            className="h-9 px-2 text-sm font-semibold text-shop-blue"
          >
            Očisti sve
          </button>
        )}
      </div>
      <label className="flex items-center gap-2.5 text-sm whitespace-nowrap text-shop-muted">
        Sortiraj
        <select
          value={params.get("sort") ?? "newest"}
          onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}
          className="h-11 rounded-[10px] border-[1.5px] border-shop-field bg-white px-3 text-[15px] text-shop-ink"
        >
          {Object.entries(SORTS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
