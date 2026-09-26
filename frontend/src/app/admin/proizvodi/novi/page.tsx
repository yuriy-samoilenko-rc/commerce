import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { loadFormOptions } from "../data";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Novi proizvod" };

export default async function NewProductPage() {
  const user = await requireUser("/admin/proizvodi/novi");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/proizvodi" className="text-sm text-muted-foreground hover:text-foreground">
        ← Svi proizvodi
      </Link>
      <h1 className="text-2xl font-semibold">Novi proizvod</h1>
      {user.role === "ADMIN" ? (
        <ProductForm {...await loadFormOptions()} />
      ) : (
        <p className="text-muted-foreground">Katalog uređuje administrator.</p>
      )}
    </div>
  );
}
