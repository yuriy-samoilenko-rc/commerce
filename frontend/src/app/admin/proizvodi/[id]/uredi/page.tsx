import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { loadFormOptions, loadProduct } from "../../data";
import { ProductForm } from "../../product-form";

export async function generateMetadata({ params }: PageProps<"/admin/proizvodi/[id]/uredi">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Izmjena: ${(await loadProduct(id)).name}` };
}

export default async function EditProductPage({ params }: PageProps<"/admin/proizvodi/[id]/uredi">) {
  const { id } = await params;
  const [product, user] = await Promise.all([loadProduct(id), requireUser(`/admin/proizvodi/${id}/uredi`)]);
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/proizvodi/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {product.name}
      </Link>
      <h1 className="text-2xl font-semibold">Izmjena proizvoda</h1>
      {user.role === "ADMIN" ? (
        <ProductForm product={product} {...await loadFormOptions()} />
      ) : (
        <p className="text-muted-foreground">Katalog uređuje administrator.</p>
      )}
    </div>
  );
}
