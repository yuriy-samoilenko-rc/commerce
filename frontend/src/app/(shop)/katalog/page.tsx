import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { findCategory, shopCategories } from "@/lib/shop-api";
import { categoryHref } from "@/lib/shop-links";
import { catalogMetadata, CatalogView } from "./catalog-view";

export async function generateMetadata({ searchParams }: PageProps<"/katalog">): Promise<Metadata> {
  return catalogMetadata(await searchParams);
}

/** All products; the old ?kategorija=<id> addresses move to /katalog/<slug>. */
export default async function CatalogPage({ searchParams }: PageProps<"/katalog">) {
  const sp = await searchParams;
  const old = typeof sp.kategorija === "string" && isUuid(sp.kategorija) ? sp.kategorija : null;
  if (old) {
    const category = findCategory(await shopCategories(), old);
    if (category) {
      const rest = new URLSearchParams(
        Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "kategorija" ? [[k, v]] : [])),
      ).toString();
      permanentRedirect(rest ? `${categoryHref(category)}?${rest}` : categoryHref(category));
    }
  }
  return <CatalogView sp={sp} />;
}
