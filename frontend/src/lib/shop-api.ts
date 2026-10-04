import "server-only";
import { cache } from "react";
import type { ShopCategory, ShopInfo, User } from "./backend-types";
import { apiServer, backendUrl } from "./session";

/**
 * Public shop data, without the visitor's session. `revalidate` (seconds) lets slow-changing
 * data (contacts, categories) be shared between visitors; anything with stock or prices
 * passes 0 and is always fresh.
 */
export async function publicApi<T>(path: string, revalidate = 0): Promise<T | null> {
  const res = await fetch(`${backendUrl()}${path}`, revalidate ? { next: { revalidate } } : { cache: "no-store" }).catch(
    () => null,
  );
  if (!res?.ok) return null;
  return (await res.json()) as T;
}

// Not cached between requests: delivery prices must match what checkout charges.
export const shopInfo = cache(() => publicApi<ShopInfo>("/shop"));

export const shopCategories = cache(async () => (await publicApi<ShopCategory[]>("/shop/categories")) ?? []);

/** The logged-in user, whatever the role (null for guests). */
export const currentUser = cache(async () => {
  const { data } = await apiServer<User>("/auth/me");
  return data;
});

/** The logged-in customer; staff browsing the shop count as guests. */
export const currentCustomer = cache(async () => {
  const user = await currentUser();
  return user?.role === "CUSTOMER" ? user : null;
});

/** Every category of the tree, flattened, to look one up by id. */
export function findCategory(tree: ShopCategory[], id: string): ShopCategory | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategory(node.children, id);
    if (found) return found;
  }
}

export function findCategoryBySlug(tree: ShopCategory[], slug: string): ShopCategory | undefined {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findCategoryBySlug(node.children, slug);
    if (found) return found;
  }
}

/** The path from a root to the category, for breadcrumbs. */
export function categoryPath(tree: ShopCategory[], id: string): ShopCategory[] {
  for (const node of tree) {
    if (node.id === id) return [node];
    const below = categoryPath(node.children, id);
    if (below.length) return [node, ...below];
  }
  return [];
}
