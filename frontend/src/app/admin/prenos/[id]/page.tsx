import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DataTable } from "@/components/admin/data-table";
import { DocumentLinks } from "@/components/admin/document-links";
import { Facts } from "@/components/admin/facts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentList } from "@/lib/backend-types";
import { count, dateTime } from "@/lib/format";
import { apiServer, requireUser } from "@/lib/session";
import { canTransfer, loadTransfer, loadTransferOptions } from "../data";
import { TransferBadge } from "../transfer-badge";
import { TransferForm } from "../transfer-form";

export async function generateMetadata({ params }: PageProps<"/admin/prenos/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Prenos ${(await loadTransfer(id)).number}` };
}

export default async function TransferPage({ params }: PageProps<"/admin/prenos/[id]">) {
  const { id } = await params;
  const [transfer, user] = await Promise.all([loadTransfer(id), requireUser(`/admin/prenos/${id}`)]);
  const operator = canTransfer(user.role);
  const editable = transfer.status === "DRAFT" && operator;

  const header = (
    <div className="flex flex-col gap-3">
      <Link href="/admin/prenos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi prenosi
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Prenos {transfer.number}</h1>
          <TransferBadge status={transfer.status} />
        </div>
        {editable && (
          <ConfirmAction
            path={`/transfers/${transfer.id}/cancel`}
            label="Otkaži nacrt"
            title="Otkazati nacrt prenosa?"
            description="Zaliha se ne mijenja. Otkazani nacrt ostaje u spisku radi evidencije."
            done="Nacrt prenosa je otkazan."
            destructive
          />
        )}
        {transfer.status === "IN_TRANSIT" && operator && (
          <ConfirmAction
            path={`/transfers/${transfer.id}/receive`}
            label="Primi robu"
            title={`Primiti robu u „${transfer.toWarehouse.name}“?`}
            description={`Potvrdite da je stiglo svih ${transfer.totalQuantity} kom. Roba tada ulazi u zalihu odredišnog skladišta.`}
            done="Roba je primljena na skladište."
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {transfer.fromWarehouse.name} → {transfer.toWarehouse.name} · unos: {transfer.createdBy.name},{" "}
        {dateTime(transfer.createdAt)}
      </p>
    </div>
  );

  if (editable) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <TransferForm transfer={transfer} {...await loadTransferOptions()} />
      </div>
    );
  }

  const docs = transfer.sentAt ? (await apiServer<DocumentList>(`/admin/documents?transferId=${id}`)).data : null;

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Roba</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              head={["Proizvod", "Količina"]}
              align={[1]}
              empty="Prenos nema stavki."
              rows={transfer.items.map((i) => [
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
              ])}
            />
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Tok</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Iz skladišta", transfer.fromWarehouse.name],
                  ["U skladište", transfer.toWarehouse.name],
                  ["Komada", count(transfer.totalQuantity)],
                  transfer.sentBy && ["Poslato", `${transfer.sentBy.name}, ${dateTime(transfer.sentAt)}`],
                  transfer.receivedBy && ["Primljeno", `${transfer.receivedBy.name}, ${dateTime(transfer.receivedAt)}`],
                  transfer.notes && ["Napomena", transfer.notes],
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
                <DocumentLinks documents={docs.items} empty="Prenosnica još nije izdata." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
