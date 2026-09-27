"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProductSearch } from "@/components/admin/product-search";
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { parseSerials } from "@/lib/serials";

export interface AdjustTarget {
  id: string;
  name: string;
  trackSerial: boolean;
  /** Units on this warehouse now, when known. */
  quantity?: number;
}

/**
 * Stock correction outside any document: damage, loss, units found. Admin only;
 * the ledger records who did it and why.
 */
export function AdjustButton({
  warehouseId,
  product,
  label = "Korekcija",
  variant = "ghost",
}: {
  warehouseId: string;
  product?: AdjustTarget;
  label?: string;
  variant?: "ghost" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<AdjustTarget | undefined>(product);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [serials, setSerials] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(delta);
  const serialList = parseSerials(serials);
  const validQty = /^[+-]?\d+$/.test(delta.trim()) && quantity !== 0 && Math.abs(quantity) <= 100_000;
  const serialsOk = !picked?.trackSerial || serialList.length === Math.abs(quantity);
  const valid = !!picked && validQty && reason.trim().length >= 3 && serialsOk;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setPicked(product);
      setDelta("");
      setReason("");
      setSerials("");
      setError(null);
    }
  }

  async function submit() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api("/stock/adjustments", {
        method: "POST",
        json: {
          warehouseId,
          productId: picked.id,
          quantity,
          reason: reason.trim(),
          ...(picked.trackSerial && { serialNumbers: serialList }),
        },
      });
      toast.success("Korekcija je evidentirana.");
      reset(false);
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
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={product ? `Korekcija: ${product.name}` : undefined}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Korekcija zalihe</DialogTitle>
            <DialogDescription>
              Za oštećenu, izgubljenu ili pronađenu robu. Primljena roba se unosi kroz prijem, a razlike u popisu kroz
              popis.
            </DialogDescription>
          </DialogHeader>
          {picked ? (
            <p className="text-sm">
              <span className="font-medium">{picked.name}</span>
              {picked.quantity !== undefined && <span className="text-muted-foreground"> · na stanju {picked.quantity}</span>}
              {!product && (
                <Button variant="link" size="sm" onClick={() => setPicked(undefined)}>
                  promijeni
                </Button>
              )}
            </p>
          ) : (
            <ProductSearch
              requireStock={false}
              onAdd={(p) => setPicked({ id: p.id, name: p.name, trackSerial: p.trackSerial })}
            />
          )}
          <div className="grid gap-2">
            <Label htmlFor="adjust-qty">Promjena količine</Label>
            <Input
              id="adjust-qty"
              inputMode="numeric"
              placeholder="npr. -2 ili +1"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              aria-invalid={delta !== "" && !validQty}
            />
            <p className="text-xs text-muted-foreground">Minus skida robu sa stanja, plus dodaje.</p>
          </div>
          {picked?.trackSerial && (
            <div className="grid gap-2">
              <Label htmlFor="adjust-serials">Serijski brojevi (jedan po redu)</Label>
              <Textarea id="adjust-serials" rows={3} value={serials} onChange={(e) => setSerials(e.target.value)} />
              <p className={serialsOk ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                Uneseno {serialList.length} od {validQty ? Math.abs(quantity) : "?"}.
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="adjust-reason">Razlog</Label>
            <Textarea
              id="adjust-reason"
              rows={2}
              maxLength={500}
              placeholder="npr. oštećeno pri istovaru"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Odustani</DialogClose>
            <Button disabled={busy || !valid} onClick={submit}>
              Evidentiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
