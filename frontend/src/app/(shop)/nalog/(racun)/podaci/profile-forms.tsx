"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";

const field =
  "h-12 w-full rounded-xl border-[1.5px] border-shop-field bg-white px-3.5 text-[15px] font-normal text-shop-ink outline-none focus:border-shop-blue";
const label = "flex flex-col gap-1.5 text-sm font-semibold";
const card = "flex flex-col gap-5 rounded-3xl border border-shop-line bg-white p-5 md:p-7";

function useSubmit(run: (form: FormData) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    action: async (form: FormData) => {
      setBusy(true);
      try {
        await run(form);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Izmjene trenutno ne mogu da se sačuvaju.");
      } finally {
        setBusy(false);
      }
    },
  };
}

export function ProfileForm(props: { name: string; email: string; phone: string; deliveryAddress: string }) {
  const router = useRouter();
  const { busy, action } = useSubmit(async (form) => {
    await api("/auth/me", {
      method: "PATCH",
      json: {
        name: String(form.get("name") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        deliveryAddress: String(form.get("deliveryAddress") ?? "").trim(),
      },
    });
    toast.success("Podaci su sačuvani.");
    router.refresh();
  });
  return (
    <form action={action} className={card}>
      <h2 className="font-display text-xl font-bold">Podaci za narudžbe</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>
          Ime i prezime
          <input name="name" required maxLength={100} defaultValue={props.name} autoComplete="name" className={field} />
        </label>
        <label className={label}>
          Email
          <input value={props.email} readOnly className={`${field} bg-shop-ground text-shop-muted`} />
        </label>
        <label className={label}>
          Telefon
          <input
            name="phone"
            type="tel"
            pattern="\+?[0-9 ()\-]{6,20}"
            title="Broj telefona, npr. +382 67 123 456"
            defaultValue={props.phone}
            placeholder="+382 67 123 456"
            autoComplete="tel"
            className={field}
          />
        </label>
        <label className={label}>
          Adresa za dostavu
          <input
            name="deliveryAddress"
            maxLength={300}
            defaultValue={props.deliveryAddress}
            placeholder="Ulica i broj, poštanski broj, grad"
            autoComplete="street-address"
            className={field}
          />
        </label>
      </div>
      <button type="submit" disabled={busy} className="h-12 self-start rounded-xl bg-shop-blue px-6 font-bold text-white hover:bg-shop-blue-dark disabled:opacity-60">
        Sačuvaj izmjene
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [key, setKey] = useState(0);
  const { busy, action } = useSubmit(async (form) => {
    const next = String(form.get("newPassword") ?? "");
    if (next !== String(form.get("repeat") ?? "")) {
      toast.error("Nova lozinka i ponovljena lozinka se ne poklapaju.");
      return;
    }
    await api("/auth/password", {
      method: "POST",
      json: { currentPassword: String(form.get("currentPassword") ?? ""), newPassword: next },
    });
    toast.success("Lozinka je promijenjena.");
    setKey((k) => k + 1);
  });
  return (
    <form key={key} action={action} className={card}>
      <h2 className="font-display text-xl font-bold">Promjena lozinke</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <label className={label}>
          Trenutna lozinka
          <input name="currentPassword" type="password" required autoComplete="current-password" className={field} />
        </label>
        <label className={label}>
          Nova lozinka
          <input name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
        <label className={label}>
          Ponovite novu lozinku
          <input name="repeat" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className={field} />
        </label>
      </div>
      <button type="submit" disabled={busy} className="h-12 self-start rounded-xl border-[1.5px] border-shop-field px-6 font-bold text-shop-ink hover:border-shop-blue disabled:opacity-60">
        Promijeni lozinku
      </button>
    </form>
  );
}
