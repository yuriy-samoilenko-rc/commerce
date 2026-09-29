"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PriceTag, ProductPhoto } from "@/components/shop/bits";
import { productHref } from "@/lib/shop-links";
import type { PublicProduct } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { priceOf } from "@/lib/shop-price";
import { cn } from "@/lib/utils";

const BACKGROUNDS = ["bg-shop-navy", "bg-[#123a8c]", "bg-shop-ink"];
const AUTOPLAY_MS = 7000;

/** Big offer slides; they move on by themselves until someone uses the controls. */
export function HeroCarousel({ slides }: { slides: PublicProduct[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  if (!count) return null;
  const p = slides[index];
  const price = priceOf(p);
  const go = (i: number) => {
    setPaused(true);
    setIndex((i + count) % count);
  };

  return (
    <div
      className={cn(
        "relative flex min-h-[420px] flex-col-reverse overflow-hidden rounded-3xl text-white transition-colors duration-500 md:min-h-[460px] md:flex-row md:items-center",
        BACKGROUNDS[index % BACKGROUNDS.length],
      )}
      aria-roledescription="carousel"
      aria-label="Izdvojene ponude"
    >
      <div className="flex grow flex-col gap-4 p-6 pb-24 md:max-w-[480px] md:gap-5 md:pt-10 md:pr-0 md:pb-24 md:pl-14">
        <span className="self-start rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold tracking-wide text-[#dce8ff]">
          {price.old ? "AKCIJA" : "NOVO"} · {p.category.name}
        </span>
        <h1 className="font-display text-3xl leading-[1.08] font-bold tracking-tight md:text-[44px]">{p.name}</h1>
        {price.old !== null && (
          <p className="text-[17px] leading-normal text-[#cfdbf2]">Uštedite {money(price.saving)} dok traju zalihe.</p>
        )}
        <PriceTag product={p} size="lg" inverse />
        <div className="flex flex-wrap gap-3">
          <Link
            href={productHref(p)}
            className="flex h-[52px] items-center gap-2.5 rounded-xl bg-white px-6 text-base font-bold text-shop-navy hover:bg-shop-tint"
          >
            Pogledaj ponudu <ArrowRight className="size-[18px]" />
          </Link>
          <Link
            href="/katalog?akcija=1"
            className="flex h-[52px] items-center rounded-xl border-[1.5px] border-white/35 px-5 text-base font-semibold text-white hover:bg-white/10"
          >
            Sve akcije
          </Link>
        </div>
      </div>
      <Link
        href={productHref(p)}
        tabIndex={-1}
        aria-hidden
        className="relative aspect-square w-full shrink-0 bg-white md:ml-auto md:size-[400px] md:rounded-l-3xl"
      >
        <ProductPhoto product={p} large sizes="400px" />
      </Link>
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
            {slides.map((s, i) => (
              <button
                key={s.id}
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
