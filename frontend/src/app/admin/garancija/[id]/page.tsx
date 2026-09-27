import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Facts } from "@/components/admin/facts";
import { FieldDialog } from "@/components/admin/field-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WarehouseList } from "@/lib/backend-types";
import { date, dateTime } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { canDecideWarranty, canHandleWarranty, loadCase } from "../data";
import { WarrantyBadge } from "../warranty-badge";

export async function generateMetadata({ params }: PageProps<"/admin/garancija/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Garancija ${(await loadCase(id)).number}` };
}

const note = (label: string, required = false) =>
  ({ name: "note", label, kind: "textarea", required, minLength: required ? 3 : undefined, maxLength: 2000 }) as const;

export default async function WarrantyCasePage({ params }: PageProps<"/admin/garancija/[id]">) {
  const { id } = await params;
  const [c, user] = await Promise.all([loadCase(id), requireUser(`/admin/garancija/${id}`)]);
  const handler = canHandleWarranty(user.role);
  const decider = canDecideWarranty(user.role);
  const path = (action: string) => `/admin/warranty-cases/${id}/${action}`;
  // Replacement is possible once the unit is with us, until the case is closed.
  const replaceable = decider && ["RECEIVED", "IN_SERVICE", "REPAIRED"].includes(c.status);
  const warehouses = replaceable ? (await apiServer<WarehouseList>("/warehouses")).data : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/garancija" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi zahtjevi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Garancija {c.number}</h1>
          <WarrantyBadge status={c.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {handler && c.status === "OPEN" && (
            <ConfirmAction
              path={path("receive")}
              label="Uređaj primljen"
              title="Kupac je donio uređaj?"
              description="Uređaj je od sada kod nas (status „u servisu“) dok se zahtjev ne riješi."
              done="Uređaj je primljen."
            />
          )}
          {handler && c.status === "RECEIVED" && (
            <FieldDialog
              path={path("send-to-service")}
              label="Pošalji u servis"
              title="Poslati uređaj u servis?"
              description="Upišite ovlašćeni servis kojem se uređaj šalje."
              done="Uređaj je poslat u servis."
              fields={[{ name: "serviceCenter", label: "Servis", kind: "text", required: true, minLength: 2, maxLength: 200 }]}
            />
          )}
          {handler && c.status === "IN_SERVICE" && (
            <FieldDialog
              path={path("repair-completed")}
              label="Popravljeno"
              title="Servis je završio popravku?"
              description="Uređaj se zatim vraća kupcu."
              done="Popravka je evidentirana."
              fields={[note("Šta je urađeno (nije obavezno)")]}
            />
          )}
          {handler && (c.status === "RECEIVED" || c.status === "REPAIRED") && (
            <FieldDialog
              path={path("return-to-customer")}
              label="Vrati kupcu"
              title="Vratiti uređaj kupcu?"
              description={
                c.status === "REPAIRED"
                  ? "Popravljeni uređaj se predaje kupcu i zahtjev se zatvara."
                  : "Uređaj je pregledan i ispravan; predaje se kupcu i zahtjev se zatvara."
              }
              done="Uređaj je vraćen kupcu, zahtjev je zatvoren."
              fields={[note("Napomena (nije obavezna)")]}
              variant="outline"
            />
          )}
          {replaceable && (
            <FieldDialog
              path={path("replace")}
              label="Zamijeni uređaj"
              title="Dati kupcu novi uređaj?"
              description={`Neispravan komad se otpisuje, a kupac dobija novi komad proizvoda „${c.unit.product.name}“ sa izabranog skladišta.`}
              done="Uređaj je zamijenjen."
              fields={[
                {
                  name: "warehouseId",
                  label: "Skladište",
                  kind: "select",
                  options: (warehouses ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, name: w.name })),
                },
                { name: "serialNumber", label: "Serijski broj novog komada", kind: "text", required: true, maxLength: 100 },
                note("Napomena (nije obavezna)"),
              ]}
              variant="outline"
            />
          )}
          {decider && (c.status === "OPEN" || c.status === "RECEIVED") && (
            <FieldDialog
              path={path("reject")}
              label="Odbij"
              title="Odbiti garantni zahtjev?"
              description="Npr. mehaničko oštećenje ili kvar koji garancija ne pokriva. Uređaj se vraća kupcu takav kakav je."
              done="Zahtjev je odbijen."
              fields={[note("Razlog odbijanja", true)]}
              variant="destructive"
            />
          )}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Prijava kupca</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="whitespace-pre-line">{c.problem}</p>
              {c.resolutionNote && (
                <p className="rounded-md bg-muted px-3 py-2">
                  <span className="font-medium">Ishod: </span>
                  {c.resolutionNote}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Uređaj</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  [
                    "Proizvod",
                    <Link key="p" href={`/admin/proizvodi/${c.unit.product.id}`} className="underline-offset-4 hover:underline">
                      {c.unit.product.name}
                    </Link>,
                  ],
                  ["Serijski broj", c.unit.serialNumber],
                  ["Prodato", date(c.unit.soldAt)],
                  ["Garancija do", date(c.unit.warrantyUntil)],
                  c.order && [
                    "Narudžba",
                    <Link key="o" href={`/admin/narudzbe/${c.order.id}`} className="underline-offset-4 hover:underline">
                      br. {c.order.number}
                    </Link>,
                  ],
                  c.order && ["Kupac", `${c.order.customerName}, ${c.order.customerPhone}`],
                  c.replacementUnit && ["Zamjenski komad", c.replacementUnit.serialNumber],
                  c.warehouse && ["Zamjena sa skladišta", c.warehouse.name],
                ]}
              />
            </CardContent>
          </Card>
        </div>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Tok</CardTitle>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                ["Otvoren", `${c.createdBy.name}, ${dateTime(c.createdAt)}`],
                c.receivedAt && ["Uređaj primljen", dateTime(c.receivedAt)],
                c.sentToServiceAt && ["Poslat u servis", `${c.serviceCenter}, ${dateTime(c.sentToServiceAt)}`],
                c.repairedAt && ["Popravljen", dateTime(c.repairedAt)],
                c.closedAt && ["Zatvoren", dateTime(c.closedAt)],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
