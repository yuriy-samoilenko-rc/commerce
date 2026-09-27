import type { Metadata } from "next";
import Link from "next/link";
import type { PickingTasks } from "@/lib/backend-types";
import { DELIVERY_METHOD } from "@/lib/labels";
import { apiServer } from "@/lib/session";
import { currentWarehouse } from "../data";

export const metadata: Metadata = { title: "Sklapanje" };

/** Orders waiting for goods from this warehouse, oldest first. */
export default async function PickingTasksPage() {
  const warehouse = await currentWarehouse();
  const { data } = await apiServer<PickingTasks>(`/admin/picking?warehouseId=${warehouse.id}`);
  const tasks = data ?? [];

  return (
    <>
      <div>
        <Link href="/m" className="text-sm text-muted-foreground">
          ← Početna
        </Link>
        <h1 className="text-xl font-semibold">Sklapanje · {warehouse.name}</h1>
      </div>
      {tasks.length ? (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link href={`/m/sklapanje/${t.id}`} className="flex flex-col gap-1 rounded-2xl border p-4 active:bg-muted">
                <span className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Narudžba {t.number}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {t.picked}/{t.units} kom.
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {t.customerName} · {DELIVERY_METHOD[t.deliveryMethod]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Nema narudžbi za sklapanje na ovom skladištu.</p>
      )}
    </>
  );
}
