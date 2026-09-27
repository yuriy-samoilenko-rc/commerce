import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { WarehouseList } from "@/lib/backend-types";
import { apiServer } from "@/lib/session";
import { WAREHOUSE_COOKIE } from "./warehouse-cookie";

/** The warehouse this phone works in (chosen once, kept in a cookie); else the chooser. */
export async function currentWarehouse() {
  const id = (await cookies()).get(WAREHOUSE_COOKIE)?.value;
  const { data } = await apiServer<WarehouseList>("/warehouses");
  const warehouse = (data ?? []).find((w) => w.id === id && w.isActive);
  if (!warehouse) redirect("/m/skladiste");
  return warehouse;
}

/** How many of a list there are, without loading it (list endpoints report `total`). */
export async function total(path: string) {
  const { data } = await apiServer<{ total: number }>(path);
  return data?.total ?? 0;
}
