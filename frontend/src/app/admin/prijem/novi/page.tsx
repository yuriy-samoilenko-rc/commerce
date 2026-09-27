import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canReceive, loadReceivingOptions } from "../data";
import { ReceivingForm } from "../receiving-form";

export const metadata: Metadata = { title: "Novi prijem" };

export default async function NewReceivingPage({ searchParams }: PageProps<"/admin/prijem/novi">) {
  const [{ w }, user] = await Promise.all([searchParams, requireUser("/admin/prijem/novi")]);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/prijem" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi prijemi
      </Link>
      <h1 className="text-2xl font-semibold">Novi prijem robe</h1>
      {canReceive(user.role) ? (
        <ReceivingForm {...await loadReceivingOptions()} defaultWarehouseId={typeof w === "string" ? w : undefined} />
      ) : (
        <p className="text-muted-foreground">Robu primaju magacioner, menadžer i administrator.</p>
      )}
    </div>
  );
}
