import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Count } from "@/lib/backend-types";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

export const loadCount = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<Count>(`/inventory-counts/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Count failed with status ${status}`);
  return data;
});

/** Who counts goods; reviewing, approving and cancelling is the administrator's (ТЗ п.14). */
export const canCount = (role: string) => role === "ADMIN" || role === "MANAGER" || role === "WAREHOUSE";
