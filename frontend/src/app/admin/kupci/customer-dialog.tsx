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
import type { CustomerCard } from "@/lib/backend-types";
import { submitTo } from "@/lib/form";

type Editable = Pick<CustomerCard, "id" | "name" | "email" | "phone" | "deliveryAddress" | "staffNote" | "isActive">;

/**
 * Opens an account for a customer (they get an email to set the password), or edits
 * one. The email is the login, so it is not changed here.
 */
export function CustomerDialog({ customer }: { customer?: Editable }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const json = {
      name: text("name"),
      phone: text("phone") || null,
      deliveryAddress: text("deliveryAddress") || null,
      staffNote: text("staffNote") || null,
      ...(customer ? { isActive: form.get("isActive") === "on" } : { email: text("email") }),
    };
    setBusy(true);
    setError(null);
    try {
      if (customer) {
        await api(`/admin/customers/${customer.id}`, { method: "PATCH", json });
        toast.success("Podaci kupca su sačuvani.");
        setOpen(false);
        router.refresh();
      } else {
        const made = await api<{ id: string; linkedOrders: number }>("/admin/customers", { method: "POST", json });
        toast.success(
          made.linkedOrders
            ? `Nalog je otvoren i povezan sa ${made.linkedOrders} ranijih narudžbi. Kupac je dobio email za lozinku.`
            : "Nalog je otvoren. Kupac je dobio email da postavi lozinku.",
        );
        setOpen(false);
        router.push(`/admin/kupci/${made.id}`);
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.code === "DUPLICATE"
            ? "Nalog sa ovom email adresom već postoji."
            : e.status === 400 && !e.code
              ? "Provjerite podatke: ispravan email i telefon (npr. +382 67 123 456)."
              : e.message
          : "Došlo je do greške. Pokušajte ponovo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={customer ? "outline" : "default"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {customer ? "Izmijeni" : "Novi kupac"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={submitTo(save)} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{customer ? customer.name : "Novi kupac"}</DialogTitle>
              <DialogDescription>
                {customer
                  ? customer.email
                  : "Kupac dobija email sa linkom da postavi lozinku. Ranije narudžbe sa istim emailom se povezuju sa nalogom."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-name">Ime i prezime</Label>
                <Input id="customer-name" name="name" required minLength={2} maxLength={100} defaultValue={customer?.name} />
              </div>
              {!customer && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input id="customer-email" name="email" type="email" required autoComplete="off" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-phone">Telefon</Label>
                <Input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  placeholder="+382 67 123 456"
                  pattern="\+?[0-9 ()\-]{6,20}"
                  defaultValue={customer?.phone ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="customer-address">Adresa za dostavu</Label>
                <Input id="customer-address" name="deliveryAddress" maxLength={300} defaultValue={customer?.deliveryAddress ?? ""} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="customer-note">Napomena (vidi je samo osoblje)</Label>
                <Textarea
                  id="customer-note"
                  name="staffNote"
                  rows={3}
                  maxLength={2000}
                  placeholder="npr. zvati poslije 17h, veleprodajni kupac"
                  defaultValue={customer?.staffNote ?? ""}
                />
              </div>
            </div>
            {customer && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={customer.isActive} className="size-4" />
                Aktivan nalog (deaktiviran kupac ne može da se prijavi u prodavnicu)
              </label>
            )}
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
