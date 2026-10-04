"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

const field =
  "h-12 rounded-xl border-[1.5px] border-shop-field px-3.5 text-[15px] font-normal outline-none focus:border-shop-blue";

export function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done)
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="rounded-2xl bg-shop-ok-tint p-4 text-[15px] font-semibold text-shop-ok">
          Lozinka je promijenjena. Prijavite se novom lozinkom; ostali uređaji su odjavljeni.
        </p>
        <Link href="/nalog/prijava" className="flex h-12 items-center justify-center rounded-xl bg-shop-blue font-bold text-white">
          Prijava
        </Link>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      action={async (form) => {
        const password = String(form.get("password") ?? "");
        if (password !== String(form.get("repeat") ?? "")) {
          setError("Lozinke se ne poklapaju.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await api("/auth/reset-password", { method: "POST", json: { token, password } });
          setDone(true);
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "Lozinka trenutno ne može da se promijeni.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Nova lozinka
        <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Ponovite lozinku
        <input name="repeat" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-shop-sale-tint p-3 text-sm font-semibold text-shop-sale-ink">
          {error}{" "}
          {error.includes("link") && <Link href="/nalog/zaboravljena-lozinka">Zatražite novi link.</Link>}
        </p>
      )}
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-shop-blue font-bold text-white hover:bg-shop-blue-dark disabled:opacity-60">
        Sačuvaj novu lozinku
      </button>
    </form>
  );
}
