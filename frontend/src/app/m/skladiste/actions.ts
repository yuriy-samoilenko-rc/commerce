"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { WAREHOUSE_COOKIE } from "../warehouse-cookie";

/** Remembers the phone's warehouse; currentWarehouse() re-checks it against the API. */
export async function chooseWarehouse(formData: FormData) {
  const id = formData.get("warehouseId");
  if (typeof id !== "string" || !isUuid(id)) redirect("/m/skladiste");
  (await cookies()).set(WAREHOUSE_COOKIE, id, {
    path: "/",
    // A year: the phone usually stays in one warehouse.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/m");
}
