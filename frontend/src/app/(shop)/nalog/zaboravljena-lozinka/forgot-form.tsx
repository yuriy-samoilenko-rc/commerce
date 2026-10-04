"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sentTo)
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="rounded-2xl bg-shop-ok-tint p-4 text-[15px] text-shop-body">
          Ako postoji nalog sa adresom <strong>{sentTo}</strong>, poslali smo link za novu lozinku. Link važi sat vremena;
          provjerite i folder za neželjenu poštu.
        </p>
        <Link href="/nalog/prijava" className="font-semibold">
          ← Nazad na prijavu
        </Link>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      action={async (form) => {
        const email = String(form.get("email") ?? "").trim();
        setBusy(true);
        setError(null);
        try {
          await api("/auth/forgot-password", { method: "POST", json: { email } });
          setSentTo(email);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Zahtjev trenutno ne može da se pošalje.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-12 rounded-xl border-[1.5px] border-shop-field px-3.5 text-[15px] font-normal outline-none focus:border-shop-blue"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-shop-sale-tint p-3 text-sm font-semibold text-shop-sale-ink">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-shop-blue font-bold text-white hover:bg-shop-blue-dark disabled:opacity-60">
        Pošalji link
      </button>
      <Link href="/nalog/prijava" className="text-sm font-semibold">
        ← Nazad na prijavu
      </Link>
    </form>
  );
}
