import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PickSheet } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { DELIVERY_METHOD, ORDER_STATUS } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { currentWarehouse } from "../../data";
import { PickWorkspace } from "./pick-workspace";

export const metadata: Metadata = { title: "Sklapanje narudžbe" };

export default async function PickPage({ params }: PageProps<"/m/sklapanje/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const warehouse = await currentWarehouse();
  const { status, data: sheet } = await apiServer<PickSheet>(`/admin/orders/${id}/pick-sheet?warehouseId=${warehouse.id}`);
  if (status === 404 || !sheet) notFound();

  return (
    <>
      <div>
        <Link href="/m/sklapanje" className="text-sm text-muted-foreground">
          ← Sve narudžbe
        </Link>
        <h1 className="text-xl font-semibold">Narudžba {sheet.order.number}</h1>
        <p className="text-sm text-muted-foreground">
          {sheet.order.customerName} · {DELIVERY_METHOD[sheet.order.deliveryMethod]}
        </p>
        {sheet.order.comment && <p className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">{sheet.order.comment}</p>}
      </div>
      {sheet.order.status !== "PICKING" ? (
        <p className="text-muted-foreground">Narudžba nije u pripremi (sada: „{ORDER_STATUS[sheet.order.status]}“).</p>
      ) : !sheet.lines.length ? (
        <p className="text-muted-foreground">Sa skladišta „{warehouse.name}“ se za ovu narudžbu ništa ne uzima.</p>
      ) : (
        <PickWorkspace initial={sheet} warehouseId={warehouse.id} />
      )}
    </>
  );
}
