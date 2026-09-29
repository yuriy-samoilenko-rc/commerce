"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { guestWishlistStore } from "@/lib/shop-store";
import { cn } from "@/lib/utils";

const field =
  "h-12 w-full rounded-xl border-[1.5px] border-shop-field bg-white px-3.5 text-[15px] text-shop-ink outline-none focus:border-shop-blue";

/**
 * Login or registration for shop customers. On success the guest's wishlist moves into
 * the account, then the visitor goes on to `next` (or the current page reloads its data).
 */
export function AuthForm({ initial = "login", next }: { initial?: "login" | "register"; next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const id = useId();

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const body = Object.fromEntries(form);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; user?: { role: string } };
      if (!res.ok) {
        setError(data.message ?? "Prijava trenutno nije moguća.");
        return;
      }
      if (data.user?.role !== "CUSTOMER") {
        toast.message("Prijavljeni ste nalogom zaposlenog.");
        router.push("/admin");
        return;
      }
      const guest = guestWishlistStore.get();
      if (guest.length) {
        await api("/wishlist/merge", { method: "POST", json: { productIds: guest } }).catch(() => null);
        guestWishlistStore.set([]);
      }
      toast.success(mode === "login" ? "Dobro došli nazad!" : "Nalog je napravljen. Dobro došli!");
      if (next) router.push(next);
      router.refresh();
    } catch {
      setError("Server trenutno nije dostupan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-shop-ground p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn("h-11 rounded-lg text-[15px] font-bold", mode === m ? "bg-white text-shop-blue shadow-sm" : "text-shop-muted")}
          >
            {m === "login" ? "Prijava" : "Novi nalog"}
          </button>
        ))}
      </div>
      <form action={submit} className="flex flex-col gap-4">
        {mode === "register" && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Ime i prezime
            <input name="name" required maxLength={100} autoComplete="name" className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-semibold">
          <label htmlFor={`${id}-password`}>Lozinka</label>
          <span className="relative">
            <input
              id={`${id}-password`}
              aria-describedby={mode === "register" ? `${id}-hint` : undefined}
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={mode === "register" ? 8 : 1}
              maxLength={72}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={cn(field, "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Sakrij lozinku" : "Prikaži lozinku"}
              className="absolute top-0 right-0 flex size-12 items-center justify-center text-shop-muted"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </span>
          {mode === "register" && (
            <span id={`${id}-hint`} className="font-normal text-shop-muted">
              Najmanje 8 znakova.
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-shop-sale-tint p-3 text-sm font-semibold text-shop-sale-ink">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="h-12 rounded-xl bg-shop-blue text-base font-bold text-white hover:bg-shop-blue-dark disabled:opacity-60">
          {mode === "login" ? "Prijavi se" : "Napravi nalog"}
        </button>
      </form>
    </div>
  );
}
