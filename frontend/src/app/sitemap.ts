import type { MetadataRoute } from "next";
import type { ShopCategory } from "@/lib/backend-types";
import { publicApi, shopCategories } from "@/lib/shop-api";
import { categoryHref, productHref } from "@/lib/shop-links";
import { siteUrl } from "@/lib/site";

// Built on request: the products and the public address are read at run time.
export const dynamic = "force-dynamic";

/** Every public shop page: the start, categories, products and the info pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [categories, products] = await Promise.all([
    shopCategories(),
    publicApi<{ slug: string; updatedAt: string }[]>("/products/sitemap"),
  ]);
  const flat = (nodes: ShopCategory[]): ShopCategory[] => nodes.flatMap((n) => [n, ...flat(n.children)]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/katalog`, changeFrequency: "daily", priority: 0.8 },
    ...flat(categories).map((c) => ({
      url: `${base}${categoryHref(c)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(products ?? []).map((p) => ({
      url: `${base}${productHref(p)}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${base}/kupovina`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/uslovi-koriscenja`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${base}/politika-privatnosti`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
