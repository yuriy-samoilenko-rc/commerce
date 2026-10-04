import { Banknote, Check, ShieldCheck, Store, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { PriceTag, SaleBadge, Stars } from "@/components/shop/bits";
import { CountdownLine } from "@/components/shop/countdown";
import { categoryHref, productHref } from "@/lib/shop-links";
import { ProductCard } from "@/components/shop/product-card";
import type { PublicProductDetail, Recommendations, ReviewEligibility, ReviewPage } from "@/lib/backend-types";
import { date, money } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { categoryPath, currentCustomer, publicApi, shopCategories, shopInfo } from "@/lib/shop-api";
import { priceOf } from "@/lib/shop-price";
import { apiServer } from "@/lib/session";
import { Bundle, BuyBox, Gallery, ReviewForm, StickyBuyBar } from "./product-parts";

/**
 * By slug; an old address with the product id moves permanently to the slug one, so
 * links and search results from before keep working.
 */
const loadProduct = cache(async (slug: string) => {
  if (isUuid(slug)) {
    const old = await publicApi<PublicProductDetail>(`/products/${slug}`);
    if (old) permanentRedirect(productHref(old));
    notFound();
  }
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) notFound();
  const product = await publicApi<PublicProductDetail>(`/products/by-slug/${slug}`);
  if (!product) notFound();
  return product;
});

/** 1 mjesec, 2–4 mjeseca, 5+ mjeseci. */
const months = (n: number) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? "mjesec" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "mjeseca" : "mjeseci"}`;
const reviewsWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "ocjena" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "ocjene" : "ocjena");

export async function generateMetadata({ params }: PageProps<"/proizvod/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  const image = product.images[0];
  return {
    title: product.name,
    description: product.description?.split("\n")[0] ?? `${product.name} — ${money(product.shopPrice)}`,
    alternates: { canonical: productHref(product) },
    openGraph: {
      type: "website",
      title: `${product.name} — ${money(product.shopPrice)}`,
      url: productHref(product),
      images: image ? [{ url: image.url, width: image.width, height: image.height, alt: image.alt ?? product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/proizvod/[slug]">) {
  const product = await loadProduct((await params).slug);
  const id = product.id;
  const [recs, reviews, info, categories, customer] = await Promise.all([
    publicApi<Recommendations>(`/products/${id}/recommendations`),
    publicApi<ReviewPage>(`/products/${id}/reviews?limit=5`),
    shopInfo(),
    shopCategories(),
    currentCustomer(),
  ]);
  const eligibility = customer ? (await apiServer<ReviewEligibility>(`/products/${id}/reviews/eligibility`)).data : null;
  const path = categoryPath(categories, product.category.id);
  const price = priceOf(product);
  const attributes = Object.entries((product.attributes ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)] as const);
  const highlights = attributes.filter(([k]) => k !== "Garancija").slice(0, 4);
  const paragraphs = (product.description ?? "").split(/\n{2,}/).filter(Boolean);
  const summary = reviews?.summary;
  const free = info?.freeShippingFrom ? Number(info.freeShippingFrom) : null;

  const delivery = [
    info?.pickupPoints.length && {
      icon: Store,
      title: "Preuzimanje u prodavnici — besplatno",
      text: `${info.pickupPoints.map((p) => p.name).join(" ili ")}, kada vas obavijestimo da je spremno`,
    },
    {
      icon: Truck,
      title: "Dostava na adresu",
      text: `Kurirskom službom širom Crne Gore · ${money(info?.courierFee ?? 0)}${free !== null ? `, besplatno od ${money(free)}` : ""}`,
    },
    { icon: Banknote, title: "Plaćanje pouzećem ili na račun", text: "Račun i garantni list dobijate uz proizvod" },
    product.warrantyMonths && {
      icon: ShieldCheck,
      title: `Garancija ${months(product.warrantyMonths)}`,
      text: "Servis preko ovlašćenog servisa u Crnoj Gori",
    },
  ].filter(Boolean) as { icon: typeof Store; title: string; text: string }[];

  // Product rich result for search engines.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    image: product.images.map((i) => i.url),
    description: product.description ?? undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: Number(product.shopPrice).toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    aggregateRating: product.ratingCount
      ? { "@type": "AggregateRating", ratingValue: Number(product.ratingAvg), reviewCount: product.ratingCount }
      : undefined,
  };

  return (
    <main className="flex flex-col gap-10 px-4 pt-6 pb-32 lg:gap-12 lg:px-20 lg:pt-8 lg:pb-16">
      <StickyBuyBar product={product} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Putanja" className="flex flex-wrap gap-2 text-sm text-shop-muted">
        <Link href="/" className="text-shop-blue">
          Početna
        </Link>
        {path.map((c) => (
          <span key={c.id} className="flex gap-2">
            <span aria-hidden>/</span>
            <Link href={categoryHref(c)} className="text-shop-blue">
              {c.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>/</span>
        <span>{product.name}</span>
      </nav>

      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-14">
        <div className="relative">
          <Gallery product={product} />
          <SaleBadge product={product} className="absolute top-5 left-5 text-sm" />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            {product.brand && (
              <Link href={`/katalog?brend=${product.brand.id}`} className="text-[15px] font-bold text-shop-blue">
                {product.brand.name}
              </Link>
            )}
            <h1 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-shop-muted">
              {product.ratingCount > 0 && (
                <a href="#ocjene" className="flex items-center gap-1.5 text-shop-muted">
                  <Stars value={Number(product.ratingAvg)} /> {Number(product.ratingAvg).toLocaleString("sr-Latn-ME")} ·{" "}
                  {product.ratingCount} {reviewsWord(product.ratingCount)}
                </a>
              )}
              <span>
                Šifra: {product.sku}
                {product.model && ` · Model: ${product.model}`}
              </span>
            </div>
          </div>
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {highlights.map(([k, v]) => (
                <span key={k} className="rounded-[10px] border border-shop-line bg-white px-3 py-2 text-sm font-semibold" title={k}>
                  {v}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-5 rounded-3xl border border-shop-line bg-white p-5 md:p-7">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-3.5">
                <PriceTag product={product} size="lg" />
                {price.saving > 0 && (
                  <span className="rounded-lg bg-shop-sale-tint px-2.5 py-1 text-sm font-bold text-shop-sale-ink">
                    Ušteda {money(price.saving)}
                  </span>
                )}
              </div>
              <span className="text-sm text-shop-muted">Cijena sa PDV-om</span>
            </div>
            {product.discountEndsAt && price.old !== null && <CountdownLine until={product.discountEndsAt} />}
            {product.inStock && (
              <span className="flex items-center gap-2 text-[15px] font-bold text-shop-ok">
                <Check className="size-[18px]" strokeWidth={2.6} /> Na stanju
              </span>
            )}
            <BuyBox product={product} />
          </div>
          <ul className="flex flex-col overflow-hidden rounded-[20px] border border-shop-line bg-white">
            {delivery.map((d) => (
              <li key={d.title} className="flex items-center gap-3.5 border-b border-[#e6ecf5] px-5 py-4 last:border-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-shop-tint text-shop-blue">
                  <d.icon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <strong className="text-[15px]">{d.title}</strong>
                  <span className="text-sm text-shop-muted">{d.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {(paragraphs.length > 0 || attributes.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-12">
          {paragraphs.length > 0 && (
            <div className="flex flex-col gap-4 rounded-3xl border border-shop-line bg-white p-6 md:p-8 lg:col-span-7">
              <h2 className="font-display text-2xl font-bold tracking-tight">Opis</h2>
              {paragraphs.map((t, i) => (
                <p key={i} className="text-base leading-relaxed text-shop-body">
                  {t}
                </p>
              ))}
            </div>
          )}
          {attributes.length > 0 && (
            <div className="flex flex-col gap-4 rounded-3xl border border-shop-line bg-white p-6 md:p-8 lg:col-span-5">
              <h2 className="font-display text-2xl font-bold tracking-tight">Karakteristike</h2>
              <dl className="grid grid-cols-[minmax(0,140px)_1fr] text-[15px]">
                {attributes.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="border-b border-[#e6ecf5] py-3 text-shop-muted">{k}</dt>
                    <dd className="border-b border-[#e6ecf5] py-3 font-semibold">{v}</dd>
                  </div>
                ))}
                {product.warrantyMonths && !attributes.some(([k]) => k === "Garancija") && (
                  <div className="contents">
                    <dt className="py-3 text-shop-muted">Garancija</dt>
                    <dd className="py-3 font-semibold">{months(product.warrantyMonths)}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </section>
      )}

      {!!recs?.addOns.length && <Bundle product={product} addOns={recs.addOns.slice(0, 3)} />}

      <section id="ocjene" aria-label="Ocjene kupaca" className="grid scroll-mt-6 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 rounded-3xl border border-shop-line bg-white p-6 md:p-8 lg:col-span-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">Ocjene kupaca</h2>
          {summary?.average != null ? (
            <>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-5xl font-bold">{summary.average.toLocaleString("sr-Latn-ME")}</span>
                <span className="text-shop-muted">od 5</span>
              </div>
              <Stars value={summary.average} className="text-[22px]" />
              <span className="text-sm text-shop-muted">
                Na osnovu {summary.count} {reviewsWord(summary.count)} kupaca
              </span>
              <div className="flex flex-col gap-2">
                {summary.distribution.map((d) => (
                  <div key={d.stars} className="flex items-center gap-2.5 text-sm">
                    <span className="w-6 text-shop-muted">{d.stars}★</span>
                    <div className="h-2 grow rounded-full bg-[#e6ecf5]">
                      <div className="h-2 rounded-full bg-shop-star" style={{ width: `${summary.count ? (d.count / summary.count) * 100 : 0}%` }} />
                    </div>
                    <span className="w-8 text-right text-shop-muted">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[15px] text-shop-muted">Ovaj proizvod još nema ocjena.</p>
          )}
          {eligibility?.canReview ? (
            <ReviewForm productId={product.id} />
          ) : eligibility?.review ? (
            <p className="rounded-2xl bg-shop-ground p-4 text-sm text-shop-muted">
              {eligibility.review.status === "PENDING"
                ? "Vaša ocjena čeka provjeru prije objavljivanja."
                : eligibility.review.status === "APPROVED"
                  ? "Hvala, vaša ocjena je objavljena."
                  : "Vaša ocjena nije objavljena."}
            </p>
          ) : null}
          <span className="text-[13px] leading-normal text-shop-muted">
            Ocjenu mogu ostaviti samo kupci koji su ovaj proizvod kupili u TechStore-u.
          </span>
        </div>
        <div className="flex flex-col gap-4 lg:col-span-8">
          {reviews?.items.map((r) => (
            <article key={r.id} className="flex flex-col gap-3 rounded-3xl border border-shop-line bg-white p-6 md:p-7">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex size-11 items-center justify-center rounded-full bg-shop-tint font-bold text-shop-blue">
                  {r.author
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="flex flex-col">
                  <strong className="text-[15px]">{r.author}</strong>
                  <span className="text-[13px] text-shop-muted">{date(r.createdAt)}</span>
                </span>
                <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-shop-ok-tint px-2.5 py-1 text-[13px] font-bold text-shop-ok">
                  <Check className="size-3.5" strokeWidth={2.6} /> Potvrđena kupovina
                </span>
              </div>
              <Stars value={r.rating} className="text-lg" />
              {r.title && <strong className="text-base">{r.title}</strong>}
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-shop-body">{r.text}</p>
            </article>
          ))}
          {!reviews?.items.length && (
            <div className="flex h-full min-h-40 items-center justify-center rounded-3xl border border-dashed border-shop-field bg-white p-8 text-center text-shop-muted">
              Budite prvi koji će ocijeniti ovaj proizvod nakon kupovine.
            </div>
          )}
        </div>
      </section>

      {!!recs?.similar.length && (
        <section className="flex flex-col gap-6">
          <h2 className="font-display text-2xl font-bold tracking-tight md:text-[28px]">Slični proizvodi</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {recs.similar.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

