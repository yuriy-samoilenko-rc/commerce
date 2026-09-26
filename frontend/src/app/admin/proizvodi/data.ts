import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { BrandList, CategoryTree, ProductDetail } from "@/lib/backend-types";
import { flattenCategories } from "@/lib/categories";
import { isUuid } from "@/lib/ids";
import { apiServer } from "@/lib/session";

/** One product per request, shared by generateMetadata and the page. */
export const loadProduct = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { status, data } = await apiServer<ProductDetail>(`/admin/products/${id}`);
  if (status === 404) notFound();
  if (!data) throw new Error(`Product failed with status ${status}`);
  return data;
});

/** What the product form chooses from. */
export async function loadFormOptions() {
  const [categories, brands] = await Promise.all([
    apiServer<CategoryTree>("/categories"),
    apiServer<BrandList>("/brands"),
  ]);
  return {
    categories: flattenCategories(categories.data ?? []),
    brands: (brands.data ?? []).map((b) => ({ id: b.id, name: b.name })),
  };
}
