"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Facts } from "@/components/admin/facts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { SerialInfo, WarrantyCase } from "@/lib/backend-types";
import { date } from "@/lib/format";
import { SERIAL_STATUS } from "@/lib/labels";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Došlo je do greške. Pokušajte ponovo.");

/**
 * A warranty claim starts from the unit's serial number: look it up first (product,
 * buyer, sale date, warranty end), then record what the customer reports.
 */
export function NewCaseForm() {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const [unit, setUnit] = useState<SerialInfo | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookUp() {
    const sn = serial.trim();
    if (!sn) return;
    setBusy(true);
    setError(null);
    setUnit(null);
    try {
      setUnit(await api<SerialInfo>(`/serials/${encodeURIComponent(sn)}`));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? `Serijski broj „${sn}“ nije pronađen.` : message(e));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const c = await api<WarrantyCase>("/admin/warranty-cases", {
        method: "POST",
        json: { serialNumber: unit!.serialNumber, problem: problem.trim() },
      });
      toast.success(`Garantni zahtjev ${c.number} je otvoren.`);
      router.push(`/admin/garancija/${c.id}`);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const order = unit?.order;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Uređaj</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            lookUp();
          }}
        >
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="serial">Serijski broj (IMEI)</Label>
            <Input id="serial" autoFocus autoComplete="off" value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={busy || !serial.trim()}>
            Provjeri
          </Button>
        </form>

        {unit && (
          <>
            <Facts
              rows={[
                ["Proizvod", unit.product.name],
                ["Status", SERIAL_STATUS[unit.status]],
                ["Prodato", date(unit.soldAt)],
                order && ["Kupac", `${order.customerName}, ${order.customerPhone}`],
                order && ["Narudžba", `br. ${order.number}`],
                [
                  "Garancija",
                  unit.warrantyUntil ? (
                    <span key="g" className={unit.warrantyActive ? undefined : "text-destructive"}>
                      {unit.warrantyActive ? "važi do" : "istekla"} {date(unit.warrantyUntil)}
                    </span>
                  ) : (
                    "nema"
                  ),
                ],
              ]}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="problem">Šta kupac prijavljuje</Label>
              <Textarea
                id="problem"
                rows={4}
                maxLength={2000}
                placeholder="npr. ekran se gasi nakon nekoliko minuta"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {unit && (
          <Button className="self-start" disabled={busy || problem.trim().length < 3} onClick={create}>
            Otvori zahtjev
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
