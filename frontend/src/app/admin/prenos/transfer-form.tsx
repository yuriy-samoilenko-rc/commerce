"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { lineProblem, quantityOk, type StockLine, StockLines, toItems } from "@/components/admin/stock-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Transfer } from "@/lib/backend-types";
import { count } from "@/lib/format";

type Option = { id: string; name: string };

/**
 * Moving goods between warehouses (ТЗ UI 10). Sending takes them off the source and
 * shows them "in transit" with a transfer note; the destination confirms arrival later.
 */
export function TransferForm({
  transfer,
  sources,
  destinations,
  defaultFromId,
}: {
  /** A draft being edited; omitted for a new transfer. */
  transfer?: Transfer;
  sources: Option[];
  destinations: Option[];
  defaultFromId?: string;
}) {
  const router = useRouter();
  const [fromId, setFromId] = useState(transfer?.fromWarehouse.id ?? defaultFromId ?? "");
  const [toId, setToId] = useState(transfer?.toWarehouse.id ?? "");
  const [notes, setNotes] = useState(transfer?.notes ?? "");
  const [lines, setLines] = useState<StockLine[]>(
    (transfer?.items ?? []).map((i) => ({ product: i.product, quantity: String(i.quantity), serials: i.serialNumbers.join("\n") })),
  );
  const [draftId, setDraftId] = useState(transfer?.id);
  const [busy, setBusy] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const units = lines.reduce((s, l) => s + (quantityOk(l) ? Number(l.quantity) : 0), 0);

  async function save(sending: boolean) {
    const problem = !fromId
      ? "Izaberite skladište iz kojeg roba ide."
      : !toId
        ? "Izaberite skladište u koje roba ide."
        : fromId === toId
          ? "Skladište iz kojeg i u koje se roba prenosi mora biti različito."
          : lineProblem(lines, { withPrice: false, complete: sending });
    setError(problem);
    if (problem) return;
    setBusy(sending ? "send" : "save");
    try {
      const saved = await api<Transfer>(draftId ? `/transfers/${draftId}` : "/transfers", {
        method: draftId ? "PATCH" : "POST",
        json: { fromWarehouseId: fromId, toWarehouseId: toId, notes: notes.trim() || null, items: toItems(lines, false) },
      });
      if (sending) {
        try {
          await api(`/transfers/${saved.id}/send`, { method: "POST" });
        } catch (e) {
          // The draft is saved: stay in this form with the error, now at the draft's address.
          if (!draftId) {
            setDraftId(saved.id);
            window.history.replaceState(null, "", `/admin/prenos/${saved.id}`);
          }
          throw e;
        }
        toast.success(`Prenos ${saved.number} je poslat, roba je u prenosu.`);
      } else {
        toast.success(`Nacrt ${saved.number} je sačuvan.`);
      }
      router.push(`/admin/prenos/${saved.id}`);
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
          <StockLines lines={lines} onChange={setLines} withPrice={false} />
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Pravac</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="from">Iz skladišta</Label>
              <NativeSelect id="from" className="w-full" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <NativeSelectOption value="">Izaberite…</NativeSelectOption>
                {sources.map((w) => (
                  <NativeSelectOption key={w.id} value={w.id}>
                    {w.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <ArrowRight className="mx-auto size-4 rotate-90 text-muted-foreground" aria-hidden />
            <div className="grid gap-1.5">
              <Label htmlFor="to">U skladište</Label>
              <NativeSelect id="to" className="w-full" value={toId} onChange={(e) => setToId(e.target.value)}>
                <NativeSelectOption value="">Izaberite…</NativeSelectOption>
                {destinations.map((w) => (
                  <NativeSelectOption key={w.id} value={w.id} disabled={w.id === fromId}>
                    {w.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
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
            </dl>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button size="lg" disabled={!!busy} onClick={() => save(true)}>
              {busy === "send" ? "Slanje…" : "Pošalji robu"}
            </Button>
            <Button size="lg" variant="outline" disabled={!!busy} onClick={() => save(false)}>
              {busy === "save" ? "Čuvanje…" : "Sačuvaj nacrt"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Slanje skida robu sa izvornog skladišta i izdaje prenosnicu; na odredištu je vidljiva kao „stiže“ dok je
              ne prime.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
