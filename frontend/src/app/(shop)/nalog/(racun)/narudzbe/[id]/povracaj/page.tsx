import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CustomerOrder } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { RETURNABLE_ORDER } from "@/lib/labels";
import { shopInfo } from "@/lib/shop-api";
import { apiServer } from "@/lib/session";
import { ReturnForm } from "./return-form";

export const metadata: Metadata = { title: "Povraćaj robe" };

export default async function NewReturnPage({ params }: PageProps<"/nalog/narudzbe/[id]/povracaj">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ data: order }, info] = await Promise.all([apiServer<CustomerOrder>(`/orders/${id}`), shopInfo()]);
  if (!order) notFound();
  return (
    <>
      <Link href={`/nalog/narudzbe/${order.id}`} className="text-sm text-shop-muted hover:text-shop-ink">
        ← Narudžba br. {order.number}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Povraćaj robe</h1>
        <p className="text-[15px] text-shop-muted">
          Bez navođenja razloga možete vratiti robu u roku od {info?.returnWindowDays ?? 14} dana od preuzimanja; neispravan
          proizvod prijavite i kasnije. Nakon prijave donesite robu u prodavnicu; novac vraćamo kada pregledamo robu.
        </p>
      </div>
      {RETURNABLE_ORDER.includes(order.status) ? (
        <ReturnForm order={order} />
      ) : (
        <p className="rounded-3xl border border-shop-line bg-white p-6 text-shop-muted">
          Povraćaj je moguć tek kada preuzmete narudžbu.
        </p>
      )}
    </>
  );
}
