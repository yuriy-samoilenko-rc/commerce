"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ReturnDetail } from "@/lib/backend-types";
import { RETURN_DECISION } from "@/lib/labels";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");

/** A dialog with one field that POSTs `{ [name]: value }`. */
function FieldDialog({
  path,
  label,
  title,
  description,
  done,
  field,
}: {
  path: string;
  label: string;
  title: string;
  description: string;
  done: string;
  field:
    | { name: string; label: string; kind: "select"; options: { id: string; name: string }[] }
    | { name: string; label: string; kind: "text"; optional: true };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(field.kind === "select" ? (field.options[0]?.id ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: "POST", json: { [field.name]: value.trim() || undefined } });
      toast.success(done);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="action-field">{field.label}</Label>
            {field.kind === "select" ? (
              <NativeSelect id="action-field" className="w-full" value={value} onChange={(e) => setValue(e.target.value)}>
                {field.options.map((o) => (
                  <NativeSelectOption key={o.id} value={o.id}>
                    {o.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input id="action-field" maxLength={200} value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Nazad</DialogClose>
            <Button disabled={busy || (field.kind === "select" && !value)} onClick={run}>
              {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReceiveReturn({ id, warehouses }: { id: string; warehouses: { id: string; name: string }[] }) {
  return (
    <FieldDialog
      path={`/admin/returns/${id}/receive`}
      label="Roba primljena"
      title="Roba je stigla od kupca?"
      description="Roba ulazi u zonu povraćaja izabranog skladišta i čeka pregled; još se ne prodaje."
      done="Roba je primljena na pregled."
      field={{ name: "warehouseId", label: "Skladište", kind: "select", options: warehouses }}
    />
  );
}

export function RefundReturn({ id, amount }: { id: string; amount: string }) {
  return (
    <FieldDialog
      path={`/admin/returns/${id}/refund`}
      label="Evidentiraj povraćaj novca"
      title="Novac je vraćen kupcu?"
      description={`Iznos za povraćaj: ${amount}. Upišite broj naloga, transakcije ili priznanice.`}
      done="Povraćaj novca je evidentiran."
      field={{ name: "reference", label: "Referenca uplate (nije obavezna)", kind: "text", optional: true }}
    />
  );
}

/** Inspection: what happens with each returned line. Can be revised until approval. */
export function Decisions({ ret }: { ret: ReturnDetail }) {
  const router = useRouter();
  // decision "" = not decided yet (the select's placeholder).
  const [values, setValues] = useState<Record<string, { decision: string; note: string }>>(() =>
    Object.fromEntries(ret.items.map((i) => [i.id, { decision: i.decision ?? "", note: i.inspectionNote ?? "" }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = ret.items.every((i) => values[i.id].decision);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/returns/${ret.id}/decide`, {
        method: "POST",
        json: {
          items: ret.items
            .filter((i) => values[i.id].decision)
            .map((i) => ({ itemId: i.id, decision: values[i.id].decision, note: values[i.id].note.trim() || undefined })),
        },
      });
      toast.success("Odluke su sačuvane.");
      router.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pregled robe</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y rounded-lg border">
          {ret.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-end gap-3 p-3">
              <div className="min-w-0 flex-1 basis-48">
                <div className="font-medium">{i.orderItem.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {i.quantity} kom.{i.serialNumbers.length > 0 && ` · ${i.serialNumbers.join(", ")}`}
                </div>
              </div>
              <NativeSelect
                value={values[i.id].decision}
                onChange={(e) => setValues((v) => ({ ...v, [i.id]: { ...v[i.id], decision: e.target.value } }))}
                aria-label={`Odluka: ${i.orderItem.productName}`}
              >
                <NativeSelectOption value="">Odluka…</NativeSelectOption>
                {Object.entries(RETURN_DECISION).map(([code, text]) => (
                  <NativeSelectOption key={code} value={code}>
                    {text}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                className="w-full sm:w-56"
                maxLength={1000}
                placeholder="Nalaz pregleda"
                value={values[i.id].note}
                onChange={(e) => setValues((v) => ({ ...v, [i.id]: { ...v[i.id], note: e.target.value } }))}
                aria-label={`Nalaz: ${i.orderItem.productName}`}
              />
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={busy} onClick={save}>
            Sačuvaj odluke
          </Button>
          {!complete && <span className="text-xs text-muted-foreground">Za odobrenje je potrebna odluka za svaku stavku.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
