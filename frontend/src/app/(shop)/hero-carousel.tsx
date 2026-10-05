"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PriceTag } from "@/components/shop/bits";
import type { PublicProduct } from "@/lib/backend-types";
import { BANNER_THEMES, type BannerTheme } from "@/lib/banner-themes";
import { cn } from "@/lib/utils";

/** One slide: a banner from the admin, or an offer made from a product on sale. */
export interface Slide {
  id: string;
  badge: string | null;
  title: string;
  text: string | null;
  href: string;
  button: string;
  secondary?: { href: string; label: string };
  theme: BannerTheme;
  image: { url: string; alt: string } | null;
  /** The picture fills the whole slide behind the text (banners); otherwise it sits on the right. */
  cover?: boolean;
  /** Shows the price under the title. */
  product?: PublicProduct;
}

const AUTOPLAY_MS = 7000;

/** Internal paths navigate inside the shop; full addresses open as plain links. */
function SlideLink({ href, className, children, ...rest }: React.ComponentProps<"a"> & { href: string }) {
  return href.startsWith("/") ? (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} rel="noopener" {...rest}>
      {children}
    </a>
  );
}

/** Big offer slides; they move on by themselves until someone uses the controls. */
export function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (!count) return null;
  const s = slides[index];
  const cover = !!(s.image && s.cover);
  const shade = BANNER_THEMES[s.theme].swatch;
  const go = (i: number) => {
    setPaused(true);
    setIndex((i + count) % count);
  };

  return (
    <div
      className={cn(
        "relative flex min-h-[420px] flex-col-reverse overflow-hidden rounded-3xl text-white transition-colors duration-500 md:min-h-[460px] md:flex-row md:items-center",
        BANNER_THEMES[s.theme].className,
      )}
      aria-roledescription="carousel"
      aria-label="Izdvojene ponude"
    >
      {cover && s.image && (
        <SlideLink href={s.href} tabIndex={-1} aria-hidden className="absolute inset-0">
          <Image src={s.image.url} alt="" fill unoptimized priority sizes="(min-width: 1024px) 1120px, 100vw" className="object-cover" />
          {/* The banner's colour fades over the picture where the text is, so white text stays readable. */}
          <span className="absolute inset-0 md:hidden" style={{ background: `linear-gradient(0deg, ${shade} 25%, ${shade}e6 55%, ${shade}b3 100%)` }} />
          <span
            className="absolute inset-0 hidden md:block"
            style={{ background: `linear-gradient(90deg, ${shade} 0%, ${shade}e6 35%, ${shade}66 60%, transparent 80%)` }}
          />
        </SlideLink>
      )}
      <div
        className={cn(
          "relative flex grow flex-col gap-4 p-6 pb-24 md:gap-5 md:pt-10 md:pb-24 md:pl-14",
          cover ? "justify-end md:max-w-[560px] md:justify-center md:pr-0" : s.image ? "md:max-w-[480px] md:pr-0" : "md:max-w-[720px] md:pr-14",
        )}
        aria-roledescription="slide"
        aria-label={`${index + 1} od ${count}`}
      >
        {s.badge && (
          <span className="self-start rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold tracking-wide text-[#dce8ff]">
            {s.badge}
          </span>
        )}
        <h1 className="font-display text-3xl leading-[1.08] font-bold tracking-tight md:text-[44px]">{s.title}</h1>
        {s.text && <p className="text-[17px] leading-normal text-[#cfdbf2]">{s.text}</p>}
        {s.product && <PriceTag product={s.product} size="lg" inverse />}
        <div className="flex flex-wrap gap-3">
          <SlideLink
            href={s.href}
            className="flex h-[52px] items-center gap-2.5 rounded-xl bg-white px-6 text-base font-bold text-shop-navy hover:bg-shop-tint"
          >
            {s.button} <ArrowRight className="size-[18px]" />
          </SlideLink>
          {s.secondary && (
            <Link
              href={s.secondary.href}
              className="flex h-[52px] items-center rounded-xl border-[1.5px] border-white/35 px-5 text-base font-semibold text-white hover:bg-white/10"
            >
              {s.secondary.label}
            </Link>
          )}
        </div>
      </div>
      {s.image && !cover && (
        <SlideLink
          href={s.href}
          tabIndex={-1}
          aria-hidden
          className="relative aspect-square w-full shrink-0 overflow-hidden bg-white md:ml-auto md:size-[400px] md:rounded-l-3xl"
        >
          <Image src={s.image.url} alt={s.image.alt} fill unoptimized sizes="400px" className="object-cover" />
        </SlideLink>
      )}
      {count > 1 && (
        <div className="absolute bottom-5 left-6 flex items-center gap-3 md:left-14">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Prethodna ponuda"
            className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-white/35 hover:bg-white/10"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
          <div className="flex">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Ponuda ${i + 1}`}
                aria-current={i === index}
                className="flex h-11 w-8 items-center justify-center"
              >
                <span className={cn("h-1.5 rounded-full", i === index ? "w-6 bg-white" : "w-2 bg-white/45")} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Sljedeća ponuda"
            className="flex size-11 items-center justify-center rounded-full border-[1.5px] border-white/35 hover:bg-white/10"
          >
            <ChevronRight className="size-[18px]" />
          </button>
        </div>
      )}
    </div>
  );
}
