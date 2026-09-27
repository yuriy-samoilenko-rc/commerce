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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

export type DialogField =
  | { name: string; label: string; kind: "select"; options: { id: string; name: string }[] }
  | { name: string; label: string; kind: "text" | "textarea"; required?: boolean; minLength?: number; maxLength?: number };

/**
 * A button that opens a small form and POSTs its fields as JSON (empty optional fields
 * are left out), then refreshes the page. For document actions that need a few inputs.
 */
export function FieldDialog({
  path,
  label,
  title,
  description,
  done,
  fields,
  variant = "default",
}: {
  path: string;
  label: string;
  title: string;
  description: string;
  done: string;
  fields: DialogField[];
  variant?: "default" | "outline" | "destructive";
}) {
  const router = useRouter();
  const initial = () =>
    Object.fromEntries(fields.map((f) => [f.name, f.kind === "select" ? (f.options[0]?.id ?? "") : ""]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = fields.every((f) => {
    const v = values[f.name].trim();
    if (f.kind === "select") return !!v;
    if (f.required && v.length < (f.minLength ?? 1)) return false;
    return true;
  });

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const json = Object.fromEntries(
        fields.map((f) => [f.name, values[f.name].trim()]).filter(([, v]) => v),
      );
      await api(path, { method: "POST", json });
      toast.success(done);
      setOpen(false);
      setValues(initial());
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {fields.map((f) => {
            const id = `field-${f.name}`;
            const set = (v: string) => setValues((all) => ({ ...all, [f.name]: v }));
            return (
              <div key={f.name} className="grid gap-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                {f.kind === "select" ? (
                  <NativeSelect id={id} className="w-full" value={values[f.name]} onChange={(e) => set(e.target.value)}>
                    {f.options.map((o) => (
                      <NativeSelectOption key={o.id} value={o.id}>
                        {o.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : f.kind === "textarea" ? (
                  <Textarea id={id} rows={3} maxLength={f.maxLength} value={values[f.name]} onChange={(e) => set(e.target.value)} />
                ) : (
                  <Input id={id} maxLength={f.maxLength} value={values[f.name]} onChange={(e) => set(e.target.value)} />
                )}
              </div>
            );
          })}
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Nazad</DialogClose>
            <Button variant={variant === "outline" ? "default" : variant} disabled={busy || !valid} onClick={run}>
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
