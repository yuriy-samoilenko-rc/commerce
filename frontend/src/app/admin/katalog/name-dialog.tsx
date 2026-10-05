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

/**
 * Creates or renames a category or a brand. With `parents` (categories) it also
 * places the category in the tree; "" is the top level.
 */
export function NameDialog({
  trigger,
  title,
  description,
  path,
  method,
  name = "",
  parentId,
  parents,
  done,
  duplicate,
  variant = "outline",
}: {
  trigger: string;
  title: string;
  description?: string;
  path: string;
  method: "POST" | "PATCH";
  name?: string;
  parentId?: string | null;
  /** [id, indented name] pairs the category may be placed under (a function is called on open). */
  parents?: [string, string][] | (() => [string, string][]);
  done: string;
  duplicate: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData) {
    const json: Record<string, unknown> = { name: String(form.get("name") ?? "").trim() };
    if (parents) json.parentId = String(form.get("parentId") ?? "") || null;
    setBusy(true);
    setError(null);
    try {
      await api(path, { method, json });
      toast.success(done);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError ? (e.code === "DUPLICATE" ? duplicate : e.message) : "Došlo je do greške. Pokušajte ponovo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={variant === "default" ? "default" : "sm"}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {/* onSubmit, not action: a form action resets the fields even when saving fails. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(new FormData(e.currentTarget));
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="catalog-name">Naziv</Label>
              <Input id="catalog-name" name="name" required maxLength={100} defaultValue={name} />
            </div>
            {parents && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="catalog-parent">Nadređena kategorija</Label>
                <NativeSelect id="catalog-parent" name="parentId" defaultValue={parentId ?? ""}>
                  <NativeSelectOption value="">— glavna kategorija —</NativeSelectOption>
                  {(typeof parents === "function" ? parents() : parents).map(([id, label]) => (
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
