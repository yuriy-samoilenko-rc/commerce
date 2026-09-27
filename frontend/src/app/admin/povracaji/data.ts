import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { ReturnDetail } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

export const loadReturn = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<ReturnDetail>(`/admin/returns/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Return failed with status ${status}`);
  return data;
});

// Mirrors admin-returns.controller.ts.
/** Take goods back, record inspection, cancel a request. */
export const canHandleReturns = (role: string) => role === "ADMIN" || role === "MANAGER" || role === "WAREHOUSE";
/** Approving commits money and stock. */
export const canApproveReturns = (role: string) => role === "ADMIN" || role === "MANAGER";
/** Recording that the money went back. */
export const canRefund = (role: string) => role === "ADMIN" || role === "ACCOUNTANT";
/** Orders whose goods reached the customer can be returned. */
export const RETURNABLE_ORDER = ["DELIVERED", "COMPLETED", "PARTIALLY_RETURNED"];
