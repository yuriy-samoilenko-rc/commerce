import type { Metadata } from "next";
import Link from "next/link";
import { CompareBar } from "@/components/shop/compare-bar";
import { categoryHref } from "@/lib/shop-links";
import { ProductCard } from "@/components/shop/product-card";
import type { Facets, PublicProductList } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import type { ShopCategory } from "@/lib/backend-types";
import { categoryPath, publicApi, shopCategories } from "@/lib/shop-api";
import { cn } from "@/lib/utils";
import { FilterSidebar, MobileFilters, SORTS, Toolbar } from "./catalog-filters";

const LIMIT = 24;

export type SP = Record<string, string | string[] | undefined>;
const one = (v: SP[string]) => (typeof v === "string" ? v : undefined);

/** Only values the API accepts; anything else is simply ignored. */
function readParams(sp: SP) {
  const num = (v?: string) => (v && /^\d+(\.\d+)?$/.test(v) ? v : undefined);
  const sort = one(sp.sort);
  return {
    brandIds: (one(sp.brend) ?? "").split(",").filter(isUuid),
    search: one(sp.q)?.trim().slice(0, 100) || undefined,
    onSale: one(sp.akcija) === "1",
    inStock: one(sp.naStanju) === "1",
    min: num(one(sp.min)),
    max: num(one(sp.max)),
    sort: sort && sort in SORTS ? sort : "newest",
    page: Math.max(1, Number(one(sp.strana)) || 1),
  };
}

/** Search results and filtered lists are not worth indexing; the plain category is. */
export function catalogMetadata(sp: SP, category?: ShopCategory): Metadata {
  const p = readParams(sp);
  const filtered = p.search || p.brandIds.length || p.onSale || p.inStock || p.min || p.max || p.page > 1;
  const title = p.search ? `Pretraga: ${p.search}` : (category?.name ?? (p.onSale ? "Akcije" : "Svi proizvodi"));
  return {
    title,
    description: category
      ? `${category.name}: ${category.productCount} proizvoda uz preuzimanje u prodavnici ili dostavu širom Crne Gore.`
      : undefined,
    alternates: { canonical: category ? categoryHref(category) : "/katalog" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export async function CatalogView({ sp, category }: { sp: SP; category?: ShopCategory }) {
  const p = { ...readParams(sp), categoryId: category?.id };
  const categories = await shopCategories();
  const path = category ? categoryPath(categories, category.id) : [];
  const basePath = category ? categoryHref(category) : "/katalog";

  const query = new URLSearchParams({ page: String(p.page), limit: String(LIMIT), sort: p.sort });
  if (p.categoryId) query.set("categoryId", p.categoryId);
  if (p.brandIds.length) query.set("brandIds", p.brandIds.join(","));
  if (p.search) query.set("search", p.search);
  if (p.onSale) query.set("onSale", "true");
  if (p.inStock) query.set("inStock", "true");
  if (p.min) query.set("minPrice", p.min);
  if (p.max) query.set("maxPrice", p.max);
  const facetQuery = new URLSearchParams();
  if (p.categoryId) facetQuery.set("categoryId", p.categoryId);
  if (p.search) facetQuery.set("search", p.search);
  if (p.onSale) facetQuery.set("onSale", "true");

  const [list, facets] = await Promise.all([
    publicApi<PublicProductList>(`/products?${query}`),
    publicApi<Facets>(`/shop/facets?${facetQuery}`),
  ]);
  const items = list?.items ?? [];
  const total = list?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const brandName = new Map((facets?.brands ?? []).map((b) => [b.id, b.name]));

  const chips = [
    ...p.brandIds.map((id) => ({ key: "brend", value: id, label: brandName.get(id) ?? "Brend" })),
    ...(p.onSale ? [{ key: "akcija", label: "Samo akcije" }] : []),
    ...(p.inStock ? [{ key: "naStanju", label: "Samo na stanju" }] : []),
    ...(p.min ? [{ key: "min", label: `od ${money(p.min)}` }] : []),
    ...(p.max ? [{ key: "max", label: `do ${money(p.max)}` }] : []),
    ...(p.search ? [{ key: "q", label: `„${p.search}“` }] : []),
  ];
  const title = p.search ? `Rezultati za „${p.search}“` : (category?.name ?? (p.onSale ? "Akcije" : "Svi proizvodi"));
  const pageHref = (n: number) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    if (n > 1) q.set("strana", String(n));
    else q.delete("strana");
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <main className="flex flex-col gap-7 px-4 pt-6 pb-28 lg:px-20 lg:pt-8">
      <div className="flex flex-col gap-2.5">
        <nav aria-label="Putanja" className="flex flex-wrap gap-2 text-sm text-shop-muted">
          <Link href="/" className="text-shop-blue">
            Početna
          </Link>
          <span aria-hidden>/</span>
          <Link href="/katalog" className="text-shop-blue">
            Katalog
          </Link>
          {path.map((c) => (
            <span key={c.id} className="flex gap-2">
              <span aria-hidden>/</span>
              {c.id === category?.id ? <span>{c.name}</span> : <Link href={categoryHref(c)} className="text-shop-blue">{c.name}</Link>}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <span className="text-base text-shop-muted">{total === 1 ? "1 proizvod" : `${total} proizvoda`}</span>
        </div>
        {!!category?.children.length && (
          <div className="flex flex-wrap gap-2 pt-2">
            {category.children.map((c) => (
              <Link
                key={c.id}
                href={categoryHref(c)}
                className="rounded-full border border-shop-line bg-white px-4 py-2 text-sm font-semibold text-shop-ink hover:border-shop-blue"
              >
                {c.name} <span className="font-normal text-shop-muted">{c.productCount}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-8">
        {facets && <FilterSidebar facets={facets} />}
        <section aria-label="Proizvodi" className="flex min-w-0 grow flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            {facets && <MobileFilters facets={facets} />}
            <div className="grow">
              <Toolbar chips={chips} />
            </div>
          </div>
          {items.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} compare />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-shop-field bg-white p-12 text-center text-shop-muted">
              Nema proizvoda koji odgovaraju filterima.
            </div>
          )}
          {pages > 1 && (
            <nav aria-label="Stranice" className="flex flex-wrap justify-center gap-2 pt-4">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === p.page ? "page" : undefined}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border font-semibold",
                    n === p.page ? "border-shop-blue bg-shop-blue text-white" : "border-shop-line bg-white text-shop-ink hover:border-shop-blue",
                  )}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
      <CompareBar />
    </main>
  );
}
