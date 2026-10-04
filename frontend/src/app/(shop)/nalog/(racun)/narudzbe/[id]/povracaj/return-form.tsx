"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CustomerOrder, CustomerReturn } from "@/lib/backend-types";
import { money } from "@/lib/format";
import { CUSTOMER_RETURN_REASON as CUSTOMER_REASON } from "@/lib/labels";
import { cn } from "@/lib/utils";


type Line = { picked: boolean; quantity: number; serials: string[]; reason: string; note: string };

export function ReturnForm({ order }: { order: CustomerOrder }) {
  const router = useRouter();
  const [lines, setLines] = useState<Record<string, Line>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, { picked: false, quantity: 1, serials: [], reason: "CHANGED_MIND", note: "" }])),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (id: string, change: Partial<Line>) => setLines((l) => ({ ...l, [id]: { ...l[id], ...change } }));

  const chosen = order.items.filter((i) => lines[i.id].picked);
  const valid =
    chosen.length > 0 &&
    chosen.every((i) => (i.serialUnits.length ? lines[i.id].serials.length > 0 : lines[i.id].quantity > 0));

  async function submit() {
    setBusy(true);
    try {
      const created = await api<CustomerReturn>("/returns", {
        method: "POST",
        json: {
          orderId: order.id,
          note: note.trim() || undefined,
          items: chosen.map((i) => {
            const l = lines[i.id];
            const serial = i.serialUnits.length > 0;
            return {
              orderItemId: i.id,
              quantity: serial ? l.serials.length : l.quantity,
              ...(serial && { serialNumbers: l.serials }),
              reason: l.reason,
              reasonNote: l.note.trim() || undefined,
            };
          }),
        },
      });
      toast.success(`Zahtjev za povraćaj ${created.number} je poslat.`);
      router.push("/nalog/povracaji");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Zahtjev trenutno ne može da se pošalje.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Proizvodi za povraćaj" className="flex flex-col rounded-3xl border border-shop-line bg-white">
        {order.items.map((i) => {
          const l = lines[i.id];
          const serial = i.serialUnits.length > 0;
          return (
            <div key={i.id} className="flex flex-col gap-4 border-b border-[#e6ecf5] p-5 last:border-0 md:px-7">
              <label className="flex cursor-pointer items-center gap-3.5">
                <input type="checkbox" checked={l.picked} onChange={(e) => set(i.id, { picked: e.target.checked })} className="size-5 accent-shop-blue" />
                <span className="flex grow flex-col">
                  <strong className="text-[15px]">{i.productName}</strong>
                  <span className="text-sm text-shop-muted">
                    Poručeno {i.quantity} × {money(i.unitPrice)}
                  </span>
                </span>
              </label>
              {l.picked && (
                <div className="flex flex-col gap-4 pl-8">
                  {serial ? (
                    <fieldset className="flex flex-col gap-2">
                      <legend className="pb-2 text-sm font-semibold">Koji komadi se vraćaju (serijski broj)</legend>
                      {i.serialUnits.map((u) => (
                        <label key={u.serialNumber} className="flex items-center gap-3 text-[15px]">
                          <input
                            type="checkbox"
                            checked={l.serials.includes(u.serialNumber)}
                            onChange={(e) =>
                              set(i.id, {
                                serials: e.target.checked ? [...l.serials, u.serialNumber] : l.serials.filter((s) => s !== u.serialNumber),
                              })
                            }
                            className="size-5 accent-shop-blue"
                          />
                          <span className="font-mono text-sm">{u.serialNumber}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    i.quantity > 1 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">Količina</span>
                        <div role="group" aria-label={`Količina: ${i.productName}`} className="flex h-11 items-center overflow-hidden rounded-xl border-[1.5px] border-shop-field">
                          <button type="button" aria-label="Manje" onClick={() => set(i.id, { quantity: Math.max(1, l.quantity - 1) })} className="flex size-11 items-center justify-center">
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{l.quantity}</span>
                          <button type="button" aria-label="Više" onClick={() => set(i.id, { quantity: Math.min(i.quantity, l.quantity + 1) })} className="flex size-11 items-center justify-center">
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                  <label className="flex max-w-md flex-col gap-1.5 text-sm font-semibold">
                    Razlog
                    <select
                      value={l.reason}
                      onChange={(e) => set(i.id, { reason: e.target.value })}
                      className="h-12 rounded-xl border-[1.5px] border-shop-field bg-white px-3 text-[15px] font-normal"
                    >
                      {Object.entries(CUSTOMER_REASON).map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  {l.reason !== "CHANGED_MIND" && (
                    <label className="flex flex-col gap-1.5 text-sm font-semibold">
                      Opišite problem
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={l.note}
                        onChange={(e) => set(i.id, { note: e.target.value })}
                        className="rounded-xl border-[1.5px] border-shop-field p-3 text-[15px] font-normal outline-none focus:border-shop-blue"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Napomena (nije obavezno)
        <textarea
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Npr. kada vam odgovara da preuzmemo robu"
          className="rounded-xl border-[1.5px] border-shop-field bg-white p-3 text-[15px] font-normal outline-none focus:border-shop-blue"
        />
      </label>
      <button
        type="button"
        disabled={!valid || busy}
        onClick={submit}
        className={cn("h-13 self-start rounded-2xl bg-shop-blue px-7 text-base font-bold text-white hover:bg-shop-blue-dark disabled:opacity-50")}
      >
        Pošalji zahtjev za povraćaj
      </button>
    </div>
  );
}
