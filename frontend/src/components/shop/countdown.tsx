"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

function split(ms: number) {
  const left = Math.max(0, ms);
  return {
    d: Math.floor(left / 86_400_000),
    h: Math.floor(left / 3_600_000) % 24,
    m: Math.floor(left / 60_000) % 60,
    s: Math.floor(left / 1000) % 60,
  };
}

/** Time left until `until`, ticking every second. The server renders nothing (no clock skew). */
function useTimeLeft(until: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now === null ? null : split(new Date(until).getTime() - now);
}

/** "Ističe za 2d 14h 32m 10s" boxes, as on the home page. */
export function CountdownBoxes({ until, label = "Ističe za" }: { until: string; label?: string }) {
  const t = useTimeLeft(until);
  if (!t) return null;
  const parts: [number | string, string][] = [
    [t.d, "d"],
    [pad(t.h), "h"],
    [pad(t.m), "m"],
    [pad(t.s), "s"],
  ];
  return (
    <div
      role="timer"
      aria-label={`${label} ${t.d} dana ${t.h} sati ${t.m} minuta`}
      className="flex items-center gap-2.5 rounded-[14px] bg-shop-sale-tint py-1.5 pr-2 pl-3.5 text-shop-sale-ink"
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="flex gap-1 font-display text-[15px] font-bold" aria-hidden>
        {parts.map(([v, u]) => (
          <span key={u} className="min-w-11 rounded-lg bg-white py-1.5 text-center">
            {v}
            {u}
          </span>
        ))}
      </span>
    </div>
  );
}

/** One-line variant for a product: "Akcijska cijena važi još 2 d 14:32:10". */
export function CountdownLine({ until, className }: { until: string; className?: string }) {
  const t = useTimeLeft(until);
  if (!t) return null;
  return (
    <div role="timer" className={cn("flex items-center gap-2.5 rounded-xl bg-shop-sale-tint px-3.5 py-2.5 text-sm font-bold text-shop-sale-ink", className)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      Akcijska cijena važi još{" "}
      <span className="font-display">
        {t.d > 0 && `${t.d} d `}
        {pad(t.h)}:{pad(t.m)}:{pad(t.s)}
      </span>
    </div>
  );
}
