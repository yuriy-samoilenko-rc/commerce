"use client";

import { Check, Minus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ScanInput } from "@/components/mobile/scan-input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { PickSheet } from "@/lib/backend-types";
import { cn } from "@/lib/utils";

type Feedback = { ok: boolean; text: string };

/**
 * Picking one order (ТЗ UI 14): scan each unit, the sheet shows what is left; a wrong
 * scan is undone on its line. Every answer comes back as the fresh sheet.
 */
export function PickWorkspace({ initial, warehouseId }: { initial: PickSheet; warehouseId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const orderId = sheet.order.id;

  async function send(action: "pick" | "unpick", code: string, doneText: (s: PickSheet) => string) {
    setBusy(true);
    try {
      const next = await api<PickSheet>(`/admin/orders/${orderId}/${action}`, {
        method: "POST",
        json: { code, warehouseId },
      });
      setSheet(next);
      setFeedback({ ok: true, text: doneText(next) });
      navigator.vibrate?.(40);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo." });
      navigator.vibrate?.([80, 60, 80]);
    } finally {
      setBusy(false);
    }
  }

  const scan = (code: string) =>
    send("pick", code, (next) => {
      const line = next.lines.find((l) => l.product.sku === code || l.product.barcode === code || l.serialNumbers?.includes(code));
      return line ? `✓ ${line.product.name} — ${line.picked}/${line.quantity}` : "✓ Spakovano";
    });

  async function complete() {
    setBusy(true);
    try {
      await api(`/admin/orders/${orderId}/complete-picking`, { method: "POST" });
      toast.success(`Narudžba ${sheet.order.number} je spremna za slanje.`);
      router.push("/m/sklapanje");
      router.refresh();
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ScanInput onScan={scan} busy={busy} />
      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={cn(
            "rounded-xl px-4 py-3 text-base font-medium",
            feedback.ok ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "bg-destructive/10 text-destructive",
          )}
        >
          {feedback.text}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label="Stavke za sklapanje">
        {/* What is still to be taken comes first; finished lines sink to the bottom. */}
        {[...sheet.lines].sort((a, b) => Number(a.remaining === 0) - Number(b.remaining === 0)).map((l) => {
          const done = l.remaining === 0;
          return (
            <li
              key={`${l.product.id}-${l.warehouse.id}`}
              className={cn("flex flex-col gap-2 rounded-2xl border p-4", done && "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{l.product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.product.sku}
                    {l.product.barcode && ` · ${l.product.barcode}`}
                    {l.product.trackSerial && " · skenirajte serijski broj"}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-lg font-semibold tabular-nums">
                  {done && <Check className="size-5 text-emerald-600" />}
                  {l.picked}/{l.quantity}
                </span>
              </div>
              {l.serialNumbers && l.serialNumbers.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {l.serialNumbers.map((sn) => (
                    <li key={sn}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => send("unpick", sn, () => `Vraćeno na policu: ${sn}`)}
                        aria-label={`Poništi ${sn}`}
                      >
                        {sn} <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {!l.product.trackSerial && l.picked > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  disabled={busy}
                  onClick={() => send("unpick", l.product.sku, () => `Vraćen 1 kom. na policu: ${l.product.name}`)}
                  aria-label={`Vrati jedan: ${l.product.name}`}
                >
                  <Minus /> Vrati 1 kom.
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Button size="lg" className="h-14 text-base" disabled={busy || !sheet.complete} onClick={complete}>
        {sheet.complete ? "Završi sklapanje" : `Ostalo: ${sheet.lines.reduce((s, l) => s + l.remaining, 0)} kom.`}
      </Button>
    </div>
  );
}
