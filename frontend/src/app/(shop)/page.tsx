import { Banknote, MapPin, ShieldCheck, Store, Truck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PriceTag, ProductPhoto, SaleBadge } from "@/components/shop/bits";
import { CountdownBoxes } from "@/components/shop/countdown";
import { categoryHref } from "@/lib/shop-links";
import { ProductCard } from "@/components/shop/product-card";
import { productHref } from "@/lib/shop-links";
import type { BrandList, PublicProductList } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { publicApi, shopCategories, shopInfo } from "@/lib/shop-api";
import { HeroCarousel } from "./hero-carousel";

export const metadata: Metadata = {
  title: { absolute: "TechStore — tehnika za dom i posao" },
  description: "Televizori, telefoni, laptopovi i kućni aparati uz preuzimanje u prodavnici ili dostavu širom Crne Gore.",
};

function SectionHead({ title, href, link, children }: { title: string; href?: string; link?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-[28px]">{title}</h2>
        {children}
      </div>
      {href && (
        <Link href={href} className="text-[15px] font-semibold text-shop-blue hover:text-shop-blue-dark">
          {link} →
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [info, categories, sale, fresh, brands] = await Promise.all([
    shopInfo(),
    shopCategories(),
    publicApi<PublicProductList>("/products?onSale=true&inStock=true&sort=price_desc&limit=12"),
    publicApi<PublicProductList>("/products?inStock=true&sort=newest&limit=4"),
    publicApi<BrandList>("/brands", 300),
  ]);
  const onSale = sale?.items ?? [];
  const pictured = onSale.filter((p) => p.images.length);
  const slides = pictured.slice(0, 3);
  const tiles = pictured.slice(3, 5);
  // The sale that ends first sets the countdown.
  const endsAt = onSale
    .map((p) => p.discountEndsAt)
    .filter((d): d is string => !!d)
    .sort()[0];
  const free = info?.freeShippingFrom ? Number(info.freeShippingFrom) : null;
  const courier = Number(info?.courierFee ?? 0);

  const benefits = [
    {
      icon: Store,
      title: "Preuzimanje u prodavnici",
      text: info?.pickupPoints.length ? `${info.pickupPoints.map((p) => p.name).join(", ")}, bez troškova` : "Bez troškova dostave",
    },
    {
      icon: Truck,
      title: free !== null ? `Besplatna dostava od ${money(free)}` : `Dostava ${money(courier)}`,
      text: "Kurirskom službom širom Crne Gore",
    },
    { icon: Banknote, title: "Plaćanje pouzećem", text: "ili uplatom na žiro račun" },
    { icon: ShieldCheck, title: "Garancija i servis", text: "Račun i garantni list uz svaki proizvod" },
  ];

  return (
    <main className="flex flex-col gap-12 px-4 pt-6 pb-16 md:gap-16 lg:px-20 lg:pt-10">
      {slides.length > 0 && (
        <section className="grid gap-6 lg:grid-cols-3">
          <div className={tiles.length ? "lg:col-span-2" : "lg:col-span-3"}>
            <HeroCarousel slides={slides} />
          </div>
          {tiles.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {tiles.map((p, i) => (
                <Link
                  key={p.id}
                  href={productHref(p)}
                  className={`flex items-center gap-4 overflow-hidden rounded-3xl border p-6 text-shop-ink transition hover:-translate-y-0.5 hover:shadow-lg ${
                    i === 0 ? "border-[#d3e0fa] bg-shop-tint" : "border-shop-line bg-white"
                  }`}
                >
                  <span className="flex grow flex-col gap-2">
                    <SaleBadge product={p} className="self-start" />
                    <span className="font-display text-xl leading-tight font-bold">{p.name}</span>
                    <PriceTag product={p} size="sm" />
                  </span>
                  <span className="relative size-32 shrink-0 overflow-hidden rounded-2xl bg-white xl:size-[150px]">
                    <ProductPhoto product={p} sizes="150px" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-label="Zašto TechStore" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.map((b) => (
          <div key={b.title} className="flex items-center gap-3.5 rounded-2xl border border-shop-line bg-white p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-shop-tint text-shop-blue">
              <b.icon className="size-[22px]" />
            </span>
            <span className="flex flex-col gap-0.5">
              <strong className="text-[15px]">{b.title}</strong>
              <span className="text-sm text-shop-muted">{b.text}</span>
            </span>
          </div>
        ))}
      </section>

      {categories.length > 0 && (
        <section className="flex flex-col gap-6">
          <SectionHead title="Kategorije" href="/katalog" link="Svi proizvodi" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={categoryHref(c)}
                className="group flex items-center gap-4 overflow-hidden rounded-[20px] border border-shop-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#9db6e8] hover:shadow-[0_14px_28px_rgba(14,42,107,0.1)]"
              >
                <span className="relative size-[104px] shrink-0 overflow-hidden rounded-2xl bg-shop-ground">
                  {c.image && (
                    <Image src={c.image.thumbUrl} alt="" fill unoptimized sizes="104px" className="object-cover transition duration-300 group-hover:scale-105" />
                  )}
                </span>
                <span className="flex flex-col gap-1.5">
                  <strong className="font-display text-[17px]">{c.name}</strong>
                  <span className="text-sm text-shop-muted">{c.productCount === 1 ? "1 proizvod" : `${c.productCount} proizvoda`}</span>
                  <span className="text-sm font-bold text-shop-blue">Pogledaj →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {onSale.length > 0 && (
        <section className="flex flex-col gap-6">
          <SectionHead title="Akcije" href="/katalog?akcija=1" link="Sve akcije">
            {endsAt && <CountdownBoxes until={endsAt} />}
          </SectionHead>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {onSale.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {!!fresh?.items.length && (
        <section className="flex flex-col gap-6">
          <SectionHead title="Novo u ponudi" href="/katalog?sort=newest" link="Pogledaj sve" />
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {fresh.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {!!info?.pickupPoints.length && (
        <section className="flex flex-col gap-6">
          <SectionHead title="Naše prodavnice" />
          <div className="grid gap-6 lg:grid-cols-2">
            {info.pickupPoints.map((s) => (
              <article key={s.id} className="flex flex-col overflow-hidden rounded-3xl border border-shop-line bg-white sm:flex-row">
                <div className="flex h-40 items-center justify-center bg-[#e3ecfa] bg-[linear-gradient(#d2dff5_1px,transparent_1px),linear-gradient(90deg,#d2dff5_1px,transparent_1px)] bg-[size:28px_28px] sm:h-auto sm:w-64">
                  <MapPin className="size-11 fill-shop-blue text-white" />
                </div>
                <div className="flex grow flex-col gap-2.5 p-6 sm:p-7">
                  <strong className="font-display text-2xl">{s.name}</strong>
                  {s.address && <span className="text-[15px] text-shop-body">{s.address}</span>}
                  {s.openingHours && <span className="text-[15px] text-shop-body">{s.openingHours}</span>}
                  {s.phone && <span className="text-[15px] text-shop-body">{s.phone}</span>}
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {s.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-11 items-center rounded-xl bg-shop-blue px-4 font-bold text-white hover:bg-shop-blue-dark"
                      >
                        Uputstva za dolazak
                      </a>
                    )}
                    {s.phone && (
                      <a
                        href={`tel:${s.phone.replace(/\s/g, "")}`}
                        className="flex h-11 items-center rounded-xl border-[1.5px] border-shop-field px-4 font-bold text-shop-ink hover:border-shop-blue"
                      >
                        Pozovite nas
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!!brands?.length && (
        <section aria-label="Brendovi" className="flex flex-col gap-5 rounded-[20px] border border-shop-line bg-white px-6 py-8 lg:px-10">
          <span className="text-sm font-bold tracking-wider text-shop-muted">BRENDOVI U PONUDI</span>
          <div className="flex flex-wrap justify-between gap-x-8 gap-y-3 font-display text-lg font-semibold text-[#3a4a66] lg:text-xl">
            {brands.map((b) => (
              <Link key={b.id} href={`/katalog?brend=${b.id}`} className="text-[#3a4a66] hover:text-shop-blue">
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
