import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewOrderForm } from "./new-order-form";

export const metadata: Metadata = { title: "Nova narudžba" };

export default async function NewOrderPage() {
  const user = await requireUser("/admin/narudzbe/nova");
  const allowed = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/narudzbe" className="text-sm text-muted-foreground hover:text-foreground">
        ← Sve narudžbe
      </Link>
      <h1 className="text-2xl font-semibold">Nova narudžba</h1>
      {allowed ? (
        <NewOrderForm />
      ) : (
        <p className="text-muted-foreground">Narudžbe unose administrator i menadžer.</p>
      )}
    </div>
  );
}
