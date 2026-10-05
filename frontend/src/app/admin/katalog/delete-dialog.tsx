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
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, ApiError } from "@/lib/api";

/**
 * Deletes a category or a brand. When something still uses it (`inUse`), the
 * admin picks where that goes first; for brands this merges two of them.
 */
export function DeleteDialog({
  path,
  title,
  inUse,
  targets,
  targetLabel,
  done,
}: {
  path: string;
  title: string;
  /** What still uses it, in words; empty when nothing does. */
  inUse: string;
  /** [id, label] pairs the products may move to (a function is called on open). */
  targets: [string, string][] | (() => [string, string][]);
  targetLabel: string;
  done: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(form: FormData) {
    const moveTo = String(form.get("moveTo") ?? "");
    setBusy(true);
    setError(null);
    try {
      await api(moveTo ? `${path}?moveTo=${moveTo}` : path, { method: "DELETE" });
      toast.success(done);
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Obriši
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(new FormData(e.currentTarget));
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {inUse ? `Još se koristi: ${inUse}. Prvo ih premjestite.` : "Ništa ga ne koristi, pa se može trajno obrisati."}
              </DialogDescription>
            </DialogHeader>
            {inUse && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catalog-move">{targetLabel}</Label>
                <NativeSelect id="catalog-move" name="moveTo" required defaultValue="">
                  <NativeSelectOption value="" disabled>
                    Izaberite…
                  </NativeSelectOption>
                  {(typeof targets === "function" ? targets() : targets).map(([id, label]) => (
                    <NativeSelectOption key={id} value={id}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>Nazad</DialogClose>
              <Button type="submit" variant="destructive" disabled={busy}>
                {inUse ? "Premjesti i obriši" : "Obriši"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
