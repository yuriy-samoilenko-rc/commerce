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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { SupplierCard } from "@/lib/backend-types";
import { submitTo } from "@/lib/form";

type Editable = Pick<
  SupplierCard,
  | "id"
  | "name"
  | "taxId"
  | "phone"
  | "email"
  | "address"
  | "contactPerson"
  | "notes"
  | "bankAccount"
  | "contractNumber"
  | "contractUntil"
  | "isActive"
>;

const FIELDS = [
  ["name", "Naziv", "text"],
  ["taxId", "PIB", "text"],
  ["contactPerson", "Kontakt osoba", "text"],
  ["phone", "Telefon", "tel"],
  ["email", "E-pošta", "email"],
  ["address", "Adresa", "text"],
  ["bankAccount", "Žiro račun", "text"],
  ["contractNumber", "Broj ugovora", "text"],
  ["contractUntil", "Ugovor važi do", "date"],
] as const;

/** Adds a supplier, or edits one when given; empty fields are stored as empty. */
export function SupplierDialog({ supplier }: { supplier?: Editable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "").trim() || null;
    const json = {
      ...Object.fromEntries(FIELDS.map(([k]) => [k, text(k)])),
      notes: text("notes"),
      isActive: form.get("isActive") === "on",
    };
    setBusy(true);
    setError(null);
    try {
      const saved = await api<{ id: string }>(supplier ? `/suppliers/${supplier.id}` : "/suppliers", {
        method: supplier ? "PATCH" : "POST",
        json,
      });
      toast.success(supplier ? "Dobavljač je sačuvan." : "Dobavljač je dodat.");
      setOpen(false);
      if (supplier) router.refresh();
      else router.push(`/admin/dobavljaci/${saved.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.code === "DUPLICATE"
            ? "Dobavljač sa ovim nazivom već postoji."
            : e.status === 400 && !e.code
              ? "Provjerite unesene podatke (npr. ispravna e-pošta)."
              : e.message
          : "Došlo je do greške. Pokušajte ponovo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const initial = (k: (typeof FIELDS)[number][0]) => {
    const v = supplier?.[k];
    return k === "contractUntil" ? (v ?? "").slice(0, 10) : (v ?? "");
  };

  return (
    <>
      <Button
        variant={supplier ? "outline" : "default"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {supplier ? "Izmijeni" : "Novi dobavljač"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={submitTo(save)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{supplier ? supplier.name : "Novi dobavljač"}</DialogTitle>
              <DialogDescription>Obavezan je samo naziv; ostalo se može dopuniti kasnije.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map(([k, label, type]) => (
                <div key={k} className={k === "address" ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
                  <Label htmlFor={`supplier-${k}`}>{label}</Label>
                  <Input
                    id={`supplier-${k}`}
                    name={k}
                    type={type}
                    required={k === "name"}
                    maxLength={k === "address" ? 300 : k === "name" ? 200 : 100}
                    defaultValue={initial(k)}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="supplier-notes">Napomena</Label>
                <Textarea id="supplier-notes" name="notes" rows={3} maxLength={2000} defaultValue={supplier?.notes ?? ""} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={supplier?.isActive ?? true} className="size-4" />
              Aktivan (može se izabrati pri prijemu robe)
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
