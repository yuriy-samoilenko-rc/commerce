import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canTransfer, loadTransferOptions } from "../data";
import { TransferForm } from "../transfer-form";

export const metadata: Metadata = { title: "Novi prenos" };

export default async function NewTransferPage({ searchParams }: PageProps<"/admin/prenos/novi">) {
  const [{ w }, user] = await Promise.all([searchParams, requireUser("/admin/prenos/novi")]);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/prenos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi prenosi
      </Link>
      <h1 className="text-2xl font-semibold">Novi prenos robe</h1>
      {canTransfer(user.role) ? (
        <TransferForm {...await loadTransferOptions()} defaultFromId={typeof w === "string" ? w : undefined} />
      ) : (
        <p className="text-muted-foreground">Robu prenose magacioner, menadžer i administrator.</p>
      )}
    </div>
  );
}
