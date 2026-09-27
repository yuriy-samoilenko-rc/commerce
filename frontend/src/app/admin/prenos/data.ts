import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Transfer, WarehouseList } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

export const loadTransfer = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<Transfer>(`/transfers/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Transfer failed with status ${status}`);
  return data;
});

/** Goods may leave any warehouse (emptying a closed one) but only go to an active one. */
export async function loadTransferOptions() {
  const { data } = await apiServer<WarehouseList>("/warehouses");
  const all = (data ?? []).map((w) => ({ id: w.id, name: w.isActive ? w.name : `${w.name} (neaktivno)`, isActive: w.isActive }));
  return { sources: all, destinations: all.filter((w) => w.isActive) };
}

/** Warehouse staff, managers and the admin move goods; the accountant only reads. */
export const canTransfer = (role: string) => role === "ADMIN" || role === "MANAGER" || role === "WAREHOUSE";
