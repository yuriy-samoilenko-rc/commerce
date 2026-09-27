"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { lineProblem, priceOk, quantityOk, type StockLine, StockLines, toItems } from "@/components/admin/stock-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Receiving } from "@/lib/backend-types";
import { count, decimalInput, money, parseDecimal } from "@/lib/format";

type Option = { id: string; name: string };

/**
 * Receiving from a supplier (ТЗ UI 9): header, then goods with quantity, purchase price
 * and, for serial-tracked goods, one serial number per unit. A draft can be saved
 * half-done; confirming posts the stock and issues the receiving note.
 */
export function ReceivingForm({
  receiving,
  warehouses,
  suppliers,
  defaultWarehouseId,
}: {
  /** A draft being edited; omitted for a new receiving. */
  receiving?: Receiving;
  warehouses: Option[];
  suppliers: Option[];
  defaultWarehouseId?: string;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(receiving?.supplier.id ?? "");
  const [warehouseId, setWarehouseId] = useState(receiving?.warehouse.id ?? defaultWarehouseId ?? warehouses[0]?.id ?? "");
  const [docNumber, setDocNumber] = useState(receiving?.supplierDocNumber ?? "");
  const [docDate, setDocDate] = useState(receiving?.supplierDocDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(receiving?.notes ?? "");
  const [lines, setLines] = useState<StockLine[]>(
    (receiving?.items ?? []).map((i) => ({
      product: i.product,
      quantity: String(i.quantity),
      price: decimalInput(i.purchasePrice),
      serials: i.serialNumbers.join("\n"),
    })),
  );
  // Set once a new receiving is saved: later saves update that draft instead of creating another.
  const [draftId, setDraftId] = useState(receiving?.id);
  const [busy, setBusy] = useState<"save" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const units = lines.reduce((s, l) => s + (quantityOk(l) ? Number(l.quantity) : 0), 0);
  const total = lines.reduce(
    (s, l) =>
      s + (quantityOk(l) && priceOk(l) ? Math.round((parseDecimal(l.price ?? "") ?? 0) * 100) * Number(l.quantity) : 0),
    0,
  );

  async function save(confirming: boolean) {
    const problem = !supplierId
      ? "Izaberite dobavljača."
      : !warehouseId
        ? "Izaberite skladište."
        : lineProblem(lines, { withPrice: true, complete: confirming });
    setError(problem);
    if (problem) return;
    setBusy(confirming ? "confirm" : "save");
    try {
      const saved = await api<Receiving>(draftId ? `/receivings/${draftId}` : "/receivings", {
        method: draftId ? "PATCH" : "POST",
        json: {
          supplierId,
          warehouseId,
          supplierDocNumber: docNumber.trim() || null,
          supplierDocDate: docDate || null,
          notes: notes.trim() || null,
          items: toItems(lines, true),
        },
      });
      if (confirming) {
        try {
          await api(`/receivings/${saved.id}/confirm`, { method: "POST" });
        } catch (e) {
          // The draft is saved: stay in this form with the error, now at the draft's address.
          if (!draftId) {
            setDraftId(saved.id);
            window.history.replaceState(null, "", `/admin/prijem/${saved.id}`);
          }
          throw e;
        }
        toast.success(`Prijem ${saved.number} je potvrđen, roba je na stanju.`);
      } else {
        toast.success(`Nacrt ${saved.number} je sačuvan.`);
      }
      router.push(`/admin/prijem/${saved.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader>
          <CardTitle>Roba</CardTitle>
        </CardHeader>
        <CardContent>
          <StockLines lines={lines} onChange={setLines} withPrice />
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Dokument dobavljača</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="supplier">Dobavljač</Label>
              <NativeSelect id="supplier" className="w-full" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <NativeSelectOption value="">Izaberite…</NativeSelectOption>
                {suppliers.map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>
                    {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="warehouse">Skladište</Label>
              <NativeSelect id="warehouse" className="w-full" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <NativeSelectOption key={w.id} value={w.id}>
                    {w.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="doc-number">Broj računa</Label>
                <Input id="doc-number" maxLength={100} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="doc-date">Datum računa</Label>
                <Input id="doc-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Napomena</Label>
              <Textarea id="notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Stavki</dt>
              <dd className="text-right tabular-nums">{count(lines.length)}</dd>
              <dt className="text-muted-foreground">Komada</dt>
              <dd className="text-right tabular-nums">{count(units)}</dd>
              <dt className="font-medium">Nabavna vrijednost</dt>
              <dd className="text-right font-medium tabular-nums">{money(total / 100)}</dd>
            </dl>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button size="lg" disabled={!!busy} onClick={() => save(true)}>
              {busy === "confirm" ? "Potvrđivanje…" : "Potvrdi prijem"}
            </Button>
            <Button size="lg" variant="outline" disabled={!!busy} onClick={() => save(false)}>
              {busy === "save" ? "Čuvanje…" : "Sačuvaj nacrt"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Potvrda povećava zalihu na skladištu i izdaje prijemnicu. Nacrt se može dopuniti kasnije.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
