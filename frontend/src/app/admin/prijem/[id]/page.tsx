import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DataTable } from "@/components/admin/data-table";
import { DocumentLinks } from "@/components/admin/document-links";
import { Facts } from "@/components/admin/facts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentList } from "@/lib/backend-types";
import { count, date, dateTime, money } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { canReceive, loadReceiving, loadReceivingOptions } from "../data";
import { ReceivingBadge } from "../receiving-badge";
import { ReceivingForm } from "../receiving-form";

export async function generateMetadata({ params }: PageProps<"/admin/prijem/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Prijem ${(await loadReceiving(id)).number}` };
}

export default async function ReceivingPage({ params }: PageProps<"/admin/prijem/[id]">) {
  const { id } = await params;
  const [receiving, user] = await Promise.all([loadReceiving(id), requireUser(`/admin/prijem/${id}`)]);
  const editable = receiving.status === "DRAFT" && canReceive(user.role);

  const header = (
    <div className="flex flex-col gap-3">
      <Link href="/admin/prijem" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi prijemi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Prijem {receiving.number}</h1>
          <ReceivingBadge status={receiving.status} />
        </div>
        {editable && (
          <ConfirmAction
            path={`/receivings/${receiving.id}/cancel`}
            label="Otkaži nacrt"
            title="Otkazati nacrt prijema?"
            description="Zaliha se ne mijenja. Otkazani nacrt ostaje u spisku radi evidencije."
            done="Nacrt prijema je otkazan."
            destructive
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Unos: {receiving.createdBy.name}, {dateTime(receiving.createdAt)}
      </p>
    </div>
  );

  if (editable) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <ReceivingForm receiving={receiving} {...await loadReceivingOptions()} />
      </div>
    );
  }

  const docs = receiving.status === "CONFIRMED" ? (await apiServer<DocumentList>(`/admin/documents?receivingId=${id}`)).data : null;

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Roba</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTable
              head={["Proizvod", "Količina", "Nabavna cijena", "Iznos"]}
              align={[1, 2, 3]}
              minWidth="32rem"
              empty="Prijem nema stavki."
              rows={receiving.items.map((i) => [
                <div key="p" className="flex flex-col gap-1">
                  <Link href={`/admin/proizvodi/${i.product.id}`} className="underline-offset-4 hover:underline">
                    {i.product.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">{i.product.sku}</span>
                  {i.serialNumbers.length > 0 && (
                    <span className="text-xs text-muted-foreground">Serijski br.: {i.serialNumbers.join(", ")}</span>
                  )}
                </div>,
                count(i.quantity),
                money(i.purchasePrice),
                money(Number(i.purchasePrice) * i.quantity),
              ])}
            />
            <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Komada</dt>
              <dd className="text-right tabular-nums">{count(receiving.totalQuantity)}</dd>
              <dt className="font-medium">Nabavna vrijednost</dt>
              <dd className="text-right font-medium tabular-nums">{money(receiving.totalAmount)}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Podaci</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Dobavljač", receiving.supplier.name],
                  ["Skladište", receiving.warehouse.name],
                  receiving.supplierDocNumber && ["Račun dobavljača", receiving.supplierDocNumber],
                  receiving.supplierDocDate && ["Datum računa", date(receiving.supplierDocDate)],
                  receiving.confirmedBy && ["Potvrda", `${receiving.confirmedBy.name}, ${dateTime(receiving.confirmedAt)}`],
                  receiving.notes && ["Napomena", receiving.notes],
                ]}
              />
            </CardContent>
          </Card>
          {docs && (
            <Card>
              <CardHeader>
                <CardTitle>Dokumenti</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentLinks documents={docs.items} empty="Prijemnica još nije izdata." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
