"use client";

import { Plus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Count } from "@/lib/backend-types";

type Option = { id: string; name: string };

/** Starts a count: the whole warehouse or one category (with its subcategories). */
export function NewCountDialog({ warehouses, categories }: { warehouses: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const count = await api<Count>("/inventory-counts", {
        method: "POST",
        json: { warehouseId, categoryId: categoryId || undefined, notes: notes.trim() || undefined },
      });
      toast.success(`Popis ${count.number} je počeo.`);
      router.push(`/admin/popis/${count.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Novi popis
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi popis</DialogTitle>
            <DialogDescription>
              Dok popis traje, roba iz njegovog opsega na tom skladištu se ne može primati, slati ni prodavati.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="count-warehouse">Skladište</Label>
            <NativeSelect id="count-warehouse" className="w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <NativeSelectOption key={w.id} value={w.id}>
                  {w.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="count-category">Kategorija</Label>
            <NativeSelect id="count-category" className="w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <NativeSelectOption value="">Cijelo skladište</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="count-notes">Napomena</Label>
            <Textarea id="count-notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Odustani</DialogClose>
            <Button disabled={busy || !warehouseId} onClick={start}>
              Počni popis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
