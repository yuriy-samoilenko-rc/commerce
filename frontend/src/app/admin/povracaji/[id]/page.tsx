import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DataTable } from "@/components/admin/data-table";
import { DocumentLinks } from "@/components/admin/document-links";
import { Facts } from "@/components/admin/facts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentList, WarehouseList } from "@/lib/backend-types";
import { dateTime, money } from "@/lib/format";
import { RETURN_DECISION, RETURN_REASON } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canApproveReturns, canHandleReturns, canRefund, loadReturn } from "../data";
import { ReturnBadge } from "../return-badge";
import { Decisions, ReceiveReturn, RefundReturn } from "./return-actions";

export async function generateMetadata({ params }: PageProps<"/admin/povracaji/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Povraćaj ${(await loadReturn(id)).number}` };
}

export default async function ReturnPage({ params }: PageProps<"/admin/povracaji/[id]">) {
  const { id } = await params;
  const [ret, user] = await Promise.all([loadReturn(id), requireUser(`/admin/povracaji/${id}`)]);
  const handler = canHandleReturns(user.role);
  const decided = ret.items.every((i) => i.decision);
  // What approval would refund: accepted lines at the price paid.
  const preview = ret.items
    .filter((i) => i.decision && i.decision !== "REJECT")
    .reduce((s, i) => s + Number(i.orderItem.unitPrice) * i.quantity, 0);

  const [warehouses, docs] = await Promise.all([
    ret.status === "REQUESTED" && handler ? apiServer<WarehouseList>("/warehouses") : null,
    ret.decidedAt ? apiServer<DocumentList>(`/admin/documents?returnId=${id}`) : null,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/povracaji" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi povraćaji
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Povraćaj {ret.number}</h1>
          <ReturnBadge status={ret.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {ret.status === "REQUESTED" && handler && (
            <>
              <ReceiveReturn
                id={ret.id}
                warehouses={(warehouses?.data ?? []).filter((w) => w.isActive).map((w) => ({ id: w.id, name: w.name }))}
              />
              <ConfirmAction
                path={`/admin/returns/${ret.id}/cancel`}
                label="Otkaži zahtjev"
                title="Otkazati zahtjev za povraćaj?"
                description="Roba ostaje kod kupca; zahtjev ostaje u spisku kao otkazan."
                done="Zahtjev za povraćaj je otkazan."
                destructive
              />
            </>
          )}
          {ret.status === "RECEIVED" && canApproveReturns(user.role) && decided && (
            <ConfirmAction
              path={`/admin/returns/${ret.id}/approve`}
              label="Odobri povraćaj"
              title="Odobriti povraćaj?"
              description={
                preview > 0
                  ? `Ispravna roba se vraća na stanje, neispravna se otpisuje. Kupcu se duguje ${money(preview)}; izdaje se povratnica i šalje email.`
                  : "Nijedna stavka nije prihvaćena: roba se vraća kupcu, a on dobija obavještenje."
              }
              done="Povraćaj je obrađen."
            />
          )}
          {ret.status === "APPROVED" && canRefund(user.role) && ret.order.paymentStatus === "PAID" && ret.refundAmount && (
            <RefundReturn id={ret.id} amount={money(ret.refundAmount)} />
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Narudžba{" "}
        <Link href={`/admin/narudzbe/${ret.order.id}`} className="underline-offset-4 hover:underline">
          br. {ret.order.number}
        </Link>{" "}
        · {ret.order.customerName} · {ret.order.customerPhone}
      </p>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          {ret.status === "RECEIVED" && handler ? (
            <Decisions ret={ret} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Stavke</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  head={["Proizvod", "Kol.", "Razlog", "Odluka"]}
                  align={[1]}
                  minWidth="36rem"
                  empty="Povraćaj nema stavki."
                  rows={ret.items.map((i) => [
                    <div key="p" className="flex flex-col gap-1">
                      <span>{i.orderItem.productName}</span>
                      <span className="text-xs text-muted-foreground">{i.orderItem.sku}</span>
                      {i.serialNumbers.length > 0 && (
                        <span className="text-xs text-muted-foreground">Serijski br.: {i.serialNumbers.join(", ")}</span>
                      )}
                    </div>,
                    i.quantity,
                    <div key="r" className="flex flex-col">
                      <span>{RETURN_REASON[i.reason]}</span>
                      {i.reasonNote && <span className="text-xs text-muted-foreground">{i.reasonNote}</span>}
                    </div>,
                    i.decision ? (
                      <div key="d" className="flex flex-col">
                        <span>{RETURN_DECISION[i.decision]}</span>
                        {i.inspectionNote && <span className="text-xs text-muted-foreground">{i.inspectionNote}</span>}
                      </div>
                    ) : (
                      "—"
                    ),
                  ])}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Tok</CardTitle>
            </CardHeader>
            <CardContent>
              <Facts
                rows={[
                  ["Otvoren", `${ret.createdBy.name}, ${dateTime(ret.createdAt)}`],
                  ret.receivedBy && ["Roba primljena", `${ret.receivedBy.name}, ${dateTime(ret.receivedAt)}`],
                  ret.warehouse && ["Skladište", ret.warehouse.name],
                  ret.decidedBy && ["Odluka", `${ret.decidedBy.name}, ${dateTime(ret.decidedAt)}`],
                  ret.refundAmount && ["Za povraćaj", money(ret.refundAmount)],
                  ret.refundedBy && ["Novac vraćen", `${ret.refundedBy.name}, ${dateTime(ret.refundedAt)}`],
                  ret.refundReference && ["Referenca", ret.refundReference],
                  ret.order.paymentStatus !== "PAID" && ["Plaćanje", "Narudžba nije bila plaćena: nema povraćaja novca."],
                  ret.note && ["Napomena", ret.note],
                ]}
              />
            </CardContent>
          </Card>
          {docs?.data && (
            <Card>
              <CardHeader>
                <CardTitle>Dokumenti</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentLinks documents={docs.data.items} empty="Povratnica se izdaje samo za prihvaćenu robu." />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
