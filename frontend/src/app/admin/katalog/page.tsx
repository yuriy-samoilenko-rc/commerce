import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ManagedBrands, ManagedCategories } from "@/lib/backend-types";
import { apiServer, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { BrandTable, CategoryTree } from "./catalog-lists";

export const metadata: Metadata = { title: "Kategorije i brendovi" };

const TABS = { kategorije: "Kategorije", brendovi: "Brendovi" } as const;

export default async function CatalogPage({ searchParams }: PageProps<"/admin/katalog">) {
  const user = await requireUser("/admin/katalog");
  if (user.role !== "ADMIN") redirect("/admin");
  const sp = await searchParams;
  const tab = sp.tab === "brendovi" ? "brendovi" : "kategorije";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Kategorije i brendovi</h1>
      <nav aria-label="Katalog" className="flex gap-1 border-b">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => (
          <Link
            key={t}
            href={`/admin/katalog?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {tab === "kategorije" ? <Categories /> : <Brands />}
    </div>
  );
}

async function Categories() {
  const { status, data } = await apiServer<ManagedCategories>("/categories/manage");
  if (!data) throw new Error(`Categories failed with status ${status}`);
  return <CategoryTree tree={data} />;
}

async function Brands() {
  const { status, data } = await apiServer<ManagedBrands>("/brands/manage");
  if (!data) throw new Error(`Brands failed with status ${status}`);
  return <BrandTable brands={data} />;
}
