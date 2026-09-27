"use client";

import { useQuery } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProductSearch } from "@/components/admin/product-search";
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { Count, CountLineView } from "@/lib/backend-types";
import { parseSerials } from "@/lib/serials";
import { DiffTable } from "./diff-table";

type Row = Count["lines"][number];
type Editing = { id: string; name: string; trackSerial: boolean };

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");

/**
 * Counting while the count is open: scan (a scanner types the code and presses Enter),
 * or set a product's figure by hand. Every change reloads the differences from the server.
 */
export function CountWorkspace({ count }: { count: Count }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  async function scan() {
    const text = code.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const quantity = Number(qty);
      const line = await api<CountLineView>(`/inventory-counts/${count.id}/scan`, {
        method: "POST",
        json: { code: text, ...(quantity > 1 && { quantity }) },
      });
      setLast({ ok: true, text: `${line.product.name}: izbrojano ${line.counted}, u evidenciji ${line.expected}.` });
      setCode("");
      setQty("1");
      router.refresh();
    } catch (e) {
      setLast({ ok: false, text: message(e) });
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Skeniranje</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              scan();
            }}
          >
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Label htmlFor="scan-code">Bar-kod, šifra ili serijski broj</Label>
              <Input
                id="scan-code"
                ref={input}
                autoFocus
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scan-qty">Komada</Label>
              <Input
                id="scan-qty"
                inputMode="numeric"
                className="w-20"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, "") || "1")}
              />
            </div>
            <Button type="submit" disabled={busy || !code.trim()}>
              <ScanLine /> Izbroji
            </Button>
          </form>
          {last && (
            <p
              role={last.ok ? "status" : "alert"}
              className={
                last.ok
                  ? "rounded-md bg-muted px-3 py-2 text-sm"
                  : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {last.text}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            „Komada“ važi za robu bez serijskog broja: npr. 12 kablova jednim skeniranjem. Robu sa serijskim brojem
            skenirajte komad po komad.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ručni unos</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductSearch
            requireStock={false}
            onAdd={(p) => setEditing({ id: p.id, name: p.name, trackSerial: p.trackSerial })}
          />
        </CardContent>
      </Card>

      <DiffTable
        rows={count.lines}
        actions={(row: Row) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Ispravi: ${row.product.name}`}
            onClick={() => setEditing({ id: row.product.id, name: row.product.name, trackSerial: row.product.trackSerial })}
          >
            Ispravi
          </Button>
        )}
      />

      {editing && (
        <LineEditor
          countId={count.id}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Sets what was counted for one product: a number, or the full list of serial numbers. */
function LineEditor({
  countId,
  product,
  onClose,
  onSaved,
}: {
  countId: string;
  product: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Starts from what is already counted, so a correction does not lose earlier scans.
  const line = useQuery({
    queryKey: ["count-line", countId, product.id],
    queryFn: () => api<CountLineView>(`/inventory-counts/${countId}/lines/${product.id}`),
    gcTime: 0,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {line.data ? `U evidenciji ${line.data.expected} kom.` : "Učitavanje…"}{" "}
            {product.trackSerial
              ? "Unesite sve izbrojane serijske brojeve, jedan po redu; nepoznati se na odobrenju evidentiraju kao višak."
              : "Unesite ukupan izbrojani broj komada."}
          </DialogDescription>
        </DialogHeader>
        {line.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message(line.error)}
          </p>
        )}
        {line.data && <LineForm countId={countId} product={product} line={line.data} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function LineForm({
  countId,
  product,
  line,
  onSaved,
}: {
  countId: string;
  product: Editing;
  line: CountLineView;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(product.trackSerial ? (line.serialNumbers ?? []).join("\n") : String(line.counted));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serials = parseSerials(value);
  const valid = product.trackSerial || (/^\d+$/.test(value.trim()) && Number(value) <= 1_000_000);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/inventory-counts/${countId}/lines/${product.id}`, {
        method: "PUT",
        json: product.trackSerial ? { serialNumbers: serials } : { countedQuantity: Number(value) },
      });
      toast.success(`${product.name}: izbrojano ${product.trackSerial ? serials.length : Number(value)}.`);
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {product.trackSerial ? (
        <div className="grid gap-1.5">
          <Label htmlFor="line-serials">Serijski brojevi ({serials.length})</Label>
          <Textarea id="line-serials" rows={6} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="line-qty">Izbrojano komada</Label>
          <Input id="line-qty" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid} />
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Odustani</DialogClose>
        <Button disabled={busy || !valid} onClick={save}>
          Sačuvaj
        </Button>
      </DialogFooter>
    </>
  );
}
