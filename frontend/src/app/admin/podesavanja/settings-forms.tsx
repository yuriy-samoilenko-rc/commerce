"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api, ApiError } from "@/lib/api";
import type { CompanySettings, WarehouseList } from "@/lib/backend-types";
import { decimalInput, parseDecimal } from "@/lib/format";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim() || null;

function Field({ name, label, defaultValue, hint, ...rest }: { name: string; label: string; defaultValue?: string | null; hint?: string } & Omit<React.ComponentProps<"input">, "defaultValue">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} {...rest} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function CompanyForm({ settings }: { settings: CompanySettings }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    const fee = parseDecimal(String(form.get("courierFee") ?? ""));
    const free = parseDecimal(String(form.get("freeShippingFrom") ?? ""));
    if (fee === null || Number.isNaN(fee) || (free !== null && Number.isNaN(free))) {
      toast.error("Unesite ispravne iznose za dostavu, npr. 10 ili 99,90.");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/settings/company", {
        method: "PATCH",
        json: {
          name: text(form, "name") ?? settings.name,
          legalName: text(form, "legalName"),
          address: text(form, "address"),
          taxId: text(form, "taxId"),
          registrationNumber: text(form, "registrationNumber"),
          bankAccount: text(form, "bankAccount"),
          phone: text(form, "phone"),
          email: text(form, "email"),
          website: text(form, "website"),
          courierFee: fee,
          freeShippingFrom: free,
        },
      });
      toast.success("Podešavanja su sačuvana.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form action={save} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Firma</CardTitle>
          <CardDescription>Podaci na računima, otpremnicama i u internet prodavnici.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field name="name" label="Naziv prodavnice" defaultValue={settings.name} required maxLength={200} />
          <Field name="legalName" label="Pravni naziv" defaultValue={settings.legalName} maxLength={300} />
          <Field name="address" label="Adresa sjedišta" defaultValue={settings.address} maxLength={300} />
          <Field name="taxId" label="PIB" defaultValue={settings.taxId} maxLength={50} />
          <Field name="registrationNumber" label="Registarski broj" defaultValue={settings.registrationNumber} maxLength={50} />
          <Field name="bankAccount" label="Žiro račun" defaultValue={settings.bankAccount} maxLength={100} />
          <Field name="phone" label="Telefon" defaultValue={settings.phone} maxLength={50} />
          <Field name="email" label="Email" type="email" defaultValue={settings.email} />
          <Field name="website" label="Sajt" defaultValue={settings.website} maxLength={200} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dostava</CardTitle>
          <CardDescription>Lično preuzimanje je besplatno; kurirska dostava se naplaćuje ispod praga.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field name="courierFee" label="Cijena kurirske dostave (€)" inputMode="decimal" defaultValue={decimalInput(settings.courierFee)} required />
          <Field
            name="freeShippingFrom"
            label="Besplatna dostava od (€)"
            inputMode="decimal"
            defaultValue={decimalInput(settings.freeShippingFrom)}
            hint="Prazno: dostava se uvijek naplaćuje."
          />
        </CardContent>
      </Card>
      <div>
        <Button type="submit" disabled={busy}>
          Sačuvaj podešavanja
        </Button>
      </div>
    </form>
  );
}

type Warehouse = WarehouseList[number];

/** Edits a warehouse (or creates one when none is given). */
export function WarehouseDialog({ warehouse }: { warehouse?: Warehouse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(form: FormData) {
    setBusy(true);
    setError(null);
    try {
      const json = {
        name: text(form, "name"),
        address: text(form, "address"),
        phone: text(form, "phone"),
        openingHours: text(form, "openingHours"),
        isPickupPoint: form.get("isPickupPoint") === "on",
        isActive: form.get("isActive") === "on",
      };
      await api(warehouse ? `/warehouses/${warehouse.id}` : "/warehouses", { method: warehouse ? "PATCH" : "POST", json });
      toast.success(warehouse ? "Skladište je sačuvano." : "Skladište je dodato.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {warehouse ? "Izmijeni" : "Novo skladište"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{warehouse ? warehouse.name : "Novo skladište"}</DialogTitle>
              <DialogDescription>Adresu, telefon i radno vrijeme prodavnica prikazuje kupcima kod ličnog preuzimanja.</DialogDescription>
            </DialogHeader>
            <Field name="name" label="Naziv" defaultValue={warehouse?.name} required maxLength={100} />
            <Field name="address" label="Adresa" defaultValue={warehouse?.address} maxLength={300} />
            <Field name="phone" label="Telefon" defaultValue={warehouse?.phone} maxLength={50} />
            <Field name="openingHours" label="Radno vrijeme" defaultValue={warehouse?.openingHours} maxLength={200} hint="Npr. Pon–Pet 09–20, Sub 09–15" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPickupPoint" defaultChecked={warehouse?.isPickupPoint ?? false} className="size-4" />
              Mjesto preuzimanja za internet narudžbe
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={warehouse?.isActive ?? true} className="size-4" />
              Aktivno
            </label>
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
