"use client";

import Link from "next/link";
import { useState } from "react";
import { Facts } from "@/components/admin/facts";
import { ScanInput } from "@/components/mobile/scan-input";
import { buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { ProductByCode, SerialInfo, StockList } from "@/lib/backend-types";
import { count, date, money } from "@/lib/format";
import { SERIAL_STATUS } from "@/lib/labels";

type Result =
  | { kind: "serial"; unit: SerialInfo; stock: StockList["items"][number] | null }
  | { kind: "product"; product: ProductByCode; stock: StockList["items"][number] | null }
  | { kind: "none"; code: string };

/**
 * One scan answers "what is this?": a serial number shows that unit (where it is, who
 * bought it, warranty), a barcode or SKU shows the product; both with this warehouse's stock.
 */
export function Lookup({ warehouseId, warehouseName }: { warehouseId: string; warehouseName: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockHere = async (productId: string) =>
    (await api<StockList>(`/stock?productId=${productId}&warehouseId=${warehouseId}&limit=1`)).items[0] ?? null;

  async function find(code: string) {
    setBusy(true);
    setError(null);
    try {
      const unit = await api<SerialInfo>(`/serials/${encodeURIComponent(code)}`).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      });
      if (unit) {
        setResult({ kind: "serial", unit, stock: await stockHere(unit.product.id) });
        return;
      }
      const product = await api<ProductByCode>(`/admin/products/by-barcode/${encodeURIComponent(code)}`).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      });
      setResult(product ? { kind: "product", product, stock: await stockHere(product.id) } : { kind: "none", code });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  }

  const productId = result?.kind === "serial" ? result.unit.product.id : result?.kind === "product" ? result.product.id : null;
  const stock = result && result.kind !== "none" ? result.stock : null;

  return (
    <div className="flex flex-col gap-4">
      <ScanInput onScan={find} busy={busy} label="Bar-kod, šifra ili serijski broj" />
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </p>
      )}
      {result?.kind === "none" && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive">
          Kod „{result.code}“ nije pronađen ni kao proizvod ni kao serijski broj.
        </p>
      )}
      {result && result.kind !== "none" && (
        <section className="flex flex-col gap-3 rounded-2xl border p-4" aria-label="Rezultat skeniranja">
          <h2 className="text-lg font-semibold">
            {result.kind === "serial" ? result.unit.product.name : result.product.name}
          </h2>
          {result.kind === "serial" ? (
            <Facts
              rows={[
                ["Serijski broj", result.unit.serialNumber],
                ["Status", SERIAL_STATUS[result.unit.status]],
                result.unit.warehouse && ["Skladište", result.unit.warehouse.name],
                result.unit.order && ["Kupac", `${result.unit.order.customerName} (narudžba ${result.unit.order.number})`],
                result.unit.soldAt && ["Prodato", date(result.unit.soldAt)],
                result.unit.warrantyUntil && [
                  "Garancija",
                  `${result.unit.warrantyActive ? "važi do" : "istekla"} ${date(result.unit.warrantyUntil)}`,
                ],
              ]}
            />
          ) : (
            <Facts
              rows={[
                ["Šifra", result.product.sku],
                result.product.barcode && ["Bar-kod", result.product.barcode],
                ["Cijena", money(result.product.discountPrice ?? result.product.sellingPrice)],
                ["Ukupno dostupno", count(result.product.stock.available)],
              ]}
            />
          )}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
            <p className="col-span-3 text-xs text-muted-foreground">{warehouseName}</p>
            <Figure label="Na stanju" value={stock?.quantity ?? 0} />
            <Figure label="Rezervisano" value={stock?.reserved ?? 0} />
            <Figure label="Dostupno" value={stock?.available ?? 0} />
          </div>
          {productId && (
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/admin/proizvodi/${productId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Kartica
              </Link>
              <Link href={`/admin/prijem/novi?w=${warehouseId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                Prijem
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{count(value)}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
