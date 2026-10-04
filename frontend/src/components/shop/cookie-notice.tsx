"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "ts_cookie_notice";
const listeners = new Set<() => void>();

const read = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * The shop only uses what it needs to work (login cookie, cart in the browser), so this is
 * a notice, not a consent form. Shown until dismissed.
 */
export function CookieNotice() {
  // The server (and the first render) treat it as dismissed: no flash for returning visitors.
  const seen = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => true,
  );
  if (seen) return null;
  return (
    <div
      role="region"
      aria-label="Obavještenje o kolačićima"
      className="fixed inset-x-3 bottom-3 z-40 flex flex-col gap-3 rounded-2xl border border-shop-line bg-white p-4 text-sm text-shop-body shadow-[0_18px_40px_rgba(11,27,51,0.18)] sm:right-auto sm:left-4 sm:max-w-md"
    >
      <p>
        Koristimo samo kolačić neophodan za prijavu i memoriju pregledača za korpu i listu želja — bez praćenja i
        reklama. Detalji su u <Link href="/politika-privatnosti">Politici privatnosti</Link>.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            // Storage unavailable: the notice simply comes back next time.
          }
          listeners.forEach((l) => l());
        }}
        className="h-11 self-end rounded-xl bg-shop-blue px-5 font-bold text-white hover:bg-shop-blue-dark"
      >
        U redu
      </button>
    </div>
  );
}
