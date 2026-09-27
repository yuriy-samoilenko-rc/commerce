import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canHandleWarranty } from "../data";
import { NewCaseForm } from "./new-case-form";

export const metadata: Metadata = { title: "Novi garantni zahtjev" };

export default async function NewCasePage() {
  const user = await requireUser("/admin/garancija/novi");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/garancija" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi zahtjevi
      </Link>
      <h1 className="text-2xl font-semibold">Novi garantni zahtjev</h1>
      {canHandleWarranty(user.role) ? (
        <NewCaseForm />
      ) : (
        <p className="text-muted-foreground">Garantne zahtjeve otvaraju magacioner, menadžer i administrator.</p>
      )}
    </div>
  );
}
