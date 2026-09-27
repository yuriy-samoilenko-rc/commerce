import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Receiving, SupplierList, WarehouseList } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

export const loadReceiving = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<Receiving>(`/receivings/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Receiving failed with status ${status}`);
  return data;
});

/** Active suppliers and warehouses: the only ones a receiving can use. */
export async function loadReceivingOptions() {
  const [suppliers, warehouses] = await Promise.all([
    apiServer<SupplierList>("/suppliers"),
    apiServer<WarehouseList>("/warehouses"),
  ]);
  const active = <T extends { id: string; name: string; isActive: boolean }>(rows: T[] | null) =>
    (rows ?? []).filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name }));
  return { suppliers: active(suppliers.data), warehouses: active(warehouses.data) };
}

/** Warehouse staff, managers and the admin receive goods; the accountant only reads. */
export const canReceive = (role: string) => role === "ADMIN" || role === "MANAGER" || role === "WAREHOUSE";
