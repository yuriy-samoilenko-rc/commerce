"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Order, ReturnDetail } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { RETURN_REASON } from "@/lib/labels";

interface Pick {
  on: boolean;
  quantity: string;
  serials: string[];
  reason: string;
  reasonNote: string;
}

/**
 * What comes back from a delivered order: per line how many units (serial goods by
 * ticking the exact units) and why. The server checks what is still returnable.
 */
export function ReturnForm({ order }: { order: Order }) {
  const router = useRouter();
  // Only units the customer actually holds can come back.
  const soldSerials = (item: Order["items"][number]) =>
    item.serialUnits.filter((u) => u.status === "SOLD").map((u) => u.serialNumber);
  const [picks, setPicks] = useState<Record<string, Pick>>(() =>
    Object.fromEntries(
      order.items.map((i) => [i.id, { on: false, quantity: "1", serials: [], reason: "DEFECTIVE", reasonNote: "" }]),
    ),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Pick>) => setPicks((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

  async function submit() {
    const chosen = order.items.filter((i) => picks[i.id].on);
    const problem = !chosen.length
      ? "Označite bar jednu stavku koja se vraća."
      : chosen
          .map((i) => {
            const p = picks[i.id];
            const serial = i.serialUnits.length > 0;
            if (serial && !p.serials.length) return `„${i.productName}“: označite koje komade kupac vraća.`;
            if (!serial && !(/^\d+$/.test(p.quantity) && Number(p.quantity) >= 1 && Number(p.quantity) <= i.quantity))
              return `„${i.productName}“: količina od 1 do ${i.quantity}.`;
            return null;
          })
          .find(Boolean);
    setError(problem ?? null);
    if (problem) return;

    setBusy(true);
    try {
      const ret = await api<ReturnDetail>("/admin/returns", {
        method: "POST",
        json: {
          orderId: order.id,
          note: note.trim() || undefined,
          items: chosen.map((i) => {
            const p = picks[i.id];
            const serial = i.serialUnits.length > 0;
            return {
              orderItemId: i.id,
              quantity: serial ? p.serials.length : Number(p.quantity),
              ...(serial && { serialNumbers: p.serials }),
              reason: p.reason,
              reasonNote: p.reasonNote.trim() || undefined,
            };
          }),
        },
      });
      toast.success(`Povraćaj ${ret.number} je otvoren.`);
      router.push(`/admin/povracaji/${ret.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader>
          <CardTitle>Stavke narudžbe</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y rounded-lg border">
            {order.items.map((i) => {
              const p = picks[i.id];
              const serial = i.serialUnits.length > 0;
              const units = soldSerials(i);
              return (
                <li key={i.id} className="flex flex-col gap-3 p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={p.on}
                      onChange={(e) => update(i.id, { on: e.target.checked })}
                      aria-label={`Vraća se: ${i.productName}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{i.productName}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.sku} · kupljeno {i.quantity} × {money(i.unitPrice)}
                      </span>
                    </span>
                  </label>
                  {p.on && (
                    <div className="flex flex-col gap-3 pl-7">
                      {serial ? (
                        <fieldset className="flex flex-col gap-1.5">
                          <legend className="mb-1 text-sm font-medium">Koji komadi se vraćaju</legend>
                          {units.length ? (
                            units.map((sn) => (
                              <label key={sn} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={p.serials.includes(sn)}
                                  onChange={(e) =>
                                    update(i.id, {
                                      serials: e.target.checked ? [...p.serials, sn] : p.serials.filter((s) => s !== sn),
                                    })
                                  }
                                />
                                {sn}
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">Svi komadi ove stavke su već vraćeni.</p>
                          )}
                        </fieldset>
                      ) : (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`qty-${i.id}`}>Količina</Label>
                          <Input
                            id={`qty-${i.id}`}
                            inputMode="numeric"
                            className="w-24"
                            value={p.quantity}
                            onChange={(e) => update(i.id, { quantity: e.target.value })}
                            aria-label={`Količina za povraćaj: ${i.productName}`}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`reason-${i.id}`}>Razlog</Label>
                          <NativeSelect
                            id={`reason-${i.id}`}
                            value={p.reason}
                            onChange={(e) => update(i.id, { reason: e.target.value })}
                            aria-label={`Razlog: ${i.productName}`}
                          >
                            {Object.entries(RETURN_REASON).map(([code, text]) => (
                              <NativeSelectOption key={code} value={code}>
                                {text}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        </div>
                        <div className="grid min-w-48 flex-1 gap-1.5">
                          <Label htmlFor={`reason-note-${i.id}`}>Opis</Label>
                          <Input
                            id={`reason-note-${i.id}`}
                            maxLength={1000}
                            placeholder="npr. ne pali se"
                            value={p.reasonNote}
                            onChange={(e) => update(i.id, { reasonNote: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="return-note">Napomena</Label>
            <Textarea id="return-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button size="lg" disabled={busy} onClick={submit}>
            Otvori povraćaj
          </Button>
          <p className="text-xs text-muted-foreground">
            Roba se zatim prima na skladište i pregleda; novac se vraća tek nakon odobrenja.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
