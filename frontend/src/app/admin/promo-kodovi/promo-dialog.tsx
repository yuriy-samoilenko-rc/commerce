"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api";
import type { PromoCode } from "@/lib/backend-types";
import { decimalInput, parseDecimal } from "@/lib/format";

/** "2026-10-04T00:00:00Z" → "2026-10-04" for a date field (local day). */
const dayInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Creates a code, or edits one when given. Dates are whole local days: from 00:00, until 24:00. */
export function PromoDialog({ promo }: { promo?: PromoCode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const value = parseDecimal(text("value"));
    const min = parseDecimal(text("minSubtotal"));
    if (value === null || Number.isNaN(value) || (min !== null && Number.isNaN(min))) {
      setError("Unesite ispravne iznose, npr. 10 ili 5,50.");
      return;
    }
    const start = text("startsAt");
    const end = text("endsAt");
    const json = {
      code: text("code"),
      description: text("description") || null,
      type: text("type"),
      value,
      minSubtotal: min,
      startsAt: start ? new Date(`${start}T00:00:00`).toISOString() : null,
      // "Until" includes the whole day.
      endsAt: end ? new Date(new Date(`${end}T00:00:00`).getTime() + 86_400_000).toISOString() : null,
      maxUses: text("maxUses") ? Number(text("maxUses")) : null,
      onePerCustomer: form.get("onePerCustomer") === "on",
      excludeSaleItems: form.get("excludeSaleItems") === "on",
      isActive: form.get("isActive") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      await api(promo ? `/admin/promo-codes/${promo.id}` : "/admin/promo-codes", {
        method: promo ? "PATCH" : "POST",
        json,
      });
      toast.success(promo ? "Promo kod je sačuvan." : "Promo kod je napravljen.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.code === "DUPLICATE"
            ? "Promo kod sa ovim nazivom već postoji."
            : e.status === 400 && !e.code
              ? "Kod: 3–40 slova, brojeva, „-“ ili „_“."
              : e.message
          : "Došlo je do greške. Pokušajte ponovo.",
      );
    } finally {
      setBusy(false);
    }
  }

  // The stored end is the next midnight; the field shows the last valid day.
  const lastDay = promo?.endsAt ? dayInput(new Date(new Date(promo.endsAt).getTime() - 1).toISOString()) : "";

  return (
    <>
      <Button variant={promo ? "outline" : "default"} size={promo ? "sm" : "default"} onClick={() => setOpen(true)}>
        {promo ? "Izmijeni" : "Novi promo kod"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form action={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{promo ? promo.code : "Novi promo kod"}</DialogTitle>
              <DialogDescription>Važi od početka prvog do kraja posljednjeg navedenog dana.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Kod</Label>
                <Input id="code" name="code" required defaultValue={promo?.code} className="uppercase" maxLength={40} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Opis (vidi ga kupac)</Label>
                <Input id="description" name="description" defaultValue={promo?.description ?? ""} maxLength={200} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Vrsta popusta</Label>
                <NativeSelect id="type" name="type" defaultValue={promo?.type ?? "PERCENT"}>
                  <NativeSelectOption value="PERCENT">Procenat (%)</NativeSelectOption>
                  <NativeSelectOption value="FIXED">Iznos (€)</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="value">Vrijednost</Label>
                <Input id="value" name="value" required inputMode="decimal" defaultValue={decimalInput(promo?.value).replace(/,00$/, "")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="minSubtotal">Najmanji iznos korpe (€)</Label>
                <Input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue={decimalInput(promo?.minSubtotal)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="maxUses">Najviše upotreba</Label>
                <Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={promo?.maxUses ?? ""} placeholder="bez ograničenja" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startsAt">Važi od</Label>
                <Input id="startsAt" name="startsAt" type="date" defaultValue={dayInput(promo?.startsAt)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endsAt">Važi do</Label>
                <Input id="endsAt" name="endsAt" type="date" defaultValue={lastDay} />
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="onePerCustomer" defaultChecked={promo?.onePerCustomer ?? true} className="size-4" />
                Jednom po kupcu
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="excludeSaleItems" defaultChecked={promo?.excludeSaleItems ?? true} className="size-4" />
                Ne važi za proizvode na akciji
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked={promo?.isActive ?? true} className="size-4" />
                Aktivan
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Nazad</DialogClose>
              <Button type="submit" disabled={busy}>
                Sačuvaj
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
