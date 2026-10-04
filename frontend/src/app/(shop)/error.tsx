"use client";

import Link from "next/link";

/** Something failed while loading a shop page (e.g. the API is down for a moment). */
export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-col items-center gap-5 px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight">Nešto nije u redu</h1>
      <p className="max-w-md text-[15px] text-shop-muted">
        Stranica trenutno ne može da se učita. Pokušajte ponovo za trenutak — vaša korpa je sačuvana.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="h-12 rounded-xl bg-shop-blue px-6 font-bold text-white hover:bg-shop-blue-dark">
          Pokušaj ponovo
        </button>
        <Link href="/" className="flex h-12 items-center rounded-xl border-[1.5px] border-shop-field px-6 font-bold text-shop-ink">
          Na početnu
        </Link>
      </div>
    </main>
  );
}
