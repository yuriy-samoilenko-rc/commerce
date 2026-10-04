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
import type { User } from "@/lib/backend-types";
import { ROLE, STAFF_ROLES } from "@/lib/labels";

/**
 * Adds an employee, or edits one when given. The admin's own account (`self`) keeps
 * its role and stays active, so nobody locks the last admin out.
 */
export function EmployeeDialog({ employee, self = false }: { employee?: User; self?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "").trim();
    const password = String(form.get("password") ?? "");
    if ((!employee || password) && password.length < 8) {
      setError("Lozinka mora imati najmanje 8 znakova.");
      return;
    }
    const json = employee
      ? {
          name: text("name"),
          ...(!self && { role: text("role"), isActive: form.get("isActive") === "on" }),
          ...(password && { password }),
        }
      : { name: text("name"), email: text("email"), role: text("role"), password };
    setBusy(true);
    setError(null);
    try {
      await api(employee ? `/users/${employee.id}` : "/users", { method: employee ? "PATCH" : "POST", json });
      toast.success(employee ? "Izmjene su sačuvane." : "Zaposleni je dodat.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.code === "DUPLICATE"
            ? "Nalog sa ovom e-poštom već postoji."
            : e.status === 400 && !e.code
              ? "Provjerite unesene podatke (ispravna e-pošta, lozinka 8–72 znaka)."
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
        variant={employee ? "outline" : "default"}
        size={employee ? "sm" : "default"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {employee ? "Izmijeni" : "Novi zaposleni"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form action={save} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{employee ? employee.name : "Novi zaposleni"}</DialogTitle>
              <DialogDescription>
                {employee
                  ? "Nova lozinka odjavljuje zaposlenog sa svih uređaja."
                  : "Zaposleni se prijavljuje e-poštom i ovom lozinkom; može je kasnije promijeniti."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Ime i prezime</Label>
                <Input id="name" name="name" required maxLength={100} defaultValue={employee?.name} />
              </div>
              {employee ? (
                <p className="text-sm text-muted-foreground">{employee.email}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">E-pošta</Label>
                  <Input id="email" name="email" type="email" required autoComplete="off" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role">Uloga</Label>
                <NativeSelect id="role" name="role" defaultValue={employee?.role ?? "WAREHOUSE"} disabled={self}>
                  {STAFF_ROLES.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {ROLE[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{employee ? "Nova lozinka" : "Lozinka"}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  required={!employee}
                  placeholder={employee ? "ostavite prazno da ostane ista" : "najmanje 8 znakova"}
                />
              </div>
              {employee && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={employee.isActive} disabled={self} className="size-4" />
                  Aktivan nalog
                </label>
              )}
              {self && <p className="text-xs text-muted-foreground">Svoju ulogu i status ne možete mijenjati.</p>}
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
