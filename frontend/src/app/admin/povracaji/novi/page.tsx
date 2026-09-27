import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Order } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { ORDER_STATUS } from "@/lib/labels";
import { apiServer, requireUser } from "@/lib/session";
import { canHandleReturns, RETURNABLE_ORDER } from "../data";
import { ReturnForm } from "./return-form";

export const metadata: Metadata = { title: "Novi povraćaj" };

export default async function NewReturnPage({ searchParams }: PageProps<"/admin/povracaji/novi">) {
  const [{ narudzba }, user] = await Promise.all([searchParams, requireUser("/admin/povracaji/novi")]);
  if (typeof narudzba !== "string" || !isUuid(narudzba)) notFound();
  const { status, data: order } = await apiServer<Order>(`/admin/orders/${narudzba}`);
  if (status === 404 || !order) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/narudzbe/${order.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Narudžba br. {order.number}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Povraćaj za narudžbu br. {order.number}</h1>
        <p className="text-sm text-muted-foreground">
          {order.customerName} · {order.customerPhone}
        </p>
      </div>
      {!canHandleReturns(user.role) ? (
        <p className="text-muted-foreground">Povraćaje otvaraju magacioner, menadžer i administrator.</p>
      ) : !RETURNABLE_ORDER.includes(order.status) ? (
        <p className="text-muted-foreground">
          Povraćaj je moguć samo za isporučene narudžbe; ova je „{ORDER_STATUS[order.status]}“.
        </p>
      ) : (
        <ReturnForm order={order} />
      )}
    </div>
  );
}
