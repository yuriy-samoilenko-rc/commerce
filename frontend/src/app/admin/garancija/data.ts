import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { WarrantyCase } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

export const loadCase = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<WarrantyCase>(`/admin/warranty-cases/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Warranty case failed with status ${status}`);
  return data;
});

// Mirrors warranty.controller.ts.
/** Register a claim, take the unit in, send it to service, hand it back. */
export const canHandleWarranty = (role: string) => role === "ADMIN" || role === "MANAGER" || role === "WAREHOUSE";
/** Giving away a new unit or refusing a claim. */
export const canDecideWarranty = (role: string) => role === "ADMIN" || role === "MANAGER";
