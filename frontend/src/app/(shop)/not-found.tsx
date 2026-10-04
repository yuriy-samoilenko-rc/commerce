import { Search } from "lucide-react";
import Link from "next/link";
import { shopCategories } from "@/lib/shop-api";
import { categoryHref } from "@/lib/shop-links";

/** 404 inside the shop: a search and the categories, so the visit does not end here. */
export default async function ShopNotFound() {
  const categories = await shopCategories();
  return (
    <main className="flex flex-col items-center gap-8 px-4 py-14 text-center md:py-20">
      <div className="flex flex-col items-center gap-3">
        <span className="font-display text-7xl font-bold text-shop-blue md:text-8xl">404</span>
        <h1 className="font-display text-3xl font-bold tracking-tight">Stranica nije pronađena</h1>
        <p className="max-w-md text-[15px] text-shop-muted">
          Proizvod možda više nije u ponudi ili je adresa pogrešno upisana. Potražite ga ili pogledajte kategorije.
        </p>
      </div>
      <form action="/katalog" role="search" className="w-full max-w-lg">
        <div className="flex h-13 overflow-hidden rounded-xl border-[1.5px] border-shop-field bg-white focus-within:border-shop-blue">
          <input
            type="search"
            name="q"
            aria-label="Pretraga"
            placeholder="Šta tražite?"
            className="min-w-0 grow bg-transparent px-4 text-[15px] outline-none"
          />
          <button type="submit" aria-label="Traži" className="flex w-14 items-center justify-center bg-shop-blue text-white">
            <Search className="size-5" />
          </button>
        </div>
      </form>
      <div className="flex max-w-2xl flex-wrap justify-center gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c)}
            className="rounded-full border border-shop-line bg-white px-4 py-2 text-sm font-semibold text-shop-ink hover:border-shop-blue"
          >
            {c.name}
          </Link>
        ))}
      </div>
      <Link href="/" className="flex h-12 items-center rounded-xl bg-shop-blue px-6 font-bold text-white hover:bg-shop-blue-dark">
        Na početnu
      </Link>
    </main>
  );
}
