import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCategoryBySlug, shopCategories } from "@/lib/shop-api";
import { catalogMetadata, CatalogView } from "../catalog-view";

async function load(slug: string) {
  const category = findCategoryBySlug(await shopCategories(), slug);
  if (!category) notFound();
  return category;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/katalog/[slug]">): Promise<Metadata> {
  return catalogMetadata(await searchParams, await load((await params).slug));
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/katalog/[slug]">) {
  const category = await load((await params).slug);
  return <CatalogView sp={await searchParams} category={category} />;
}
