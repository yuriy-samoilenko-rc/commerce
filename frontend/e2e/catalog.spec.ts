import { expect, test } from "@playwright/test";
import { ADMIN, apiAsAdmin, expectPath, login } from "./helpers";

type Managed = { id: string; name: string; children: Managed[] };
const find = (tree: Managed[], name: string): Managed | undefined =>
  tree.map((n) => (n.name === name ? n : find(n.children, name))).find(Boolean);

async function product(run: string, json: Record<string, unknown>) {
  const { body } = await apiAsAdmin("POST", "/admin/products", {
    name: `E2E katalog ${run}`,
    sku: `E2K-${run}`,
    purchasePrice: 10,
    sellingPrice: 20,
    ...json,
  });
  return body as { id: string };
}

test.describe("categories and brands", () => {
  test("the admin builds the tree and deletes a used category by moving its products", async ({ page }) => {
    const run = `${Date.now()}`;
    const root = `E2E Audio ${run}`;
    const sub = `E2E Slušalice ${run}`;
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Kategorije i brendovi" }).click();

    await page.getByRole("button", { name: "Nova kategorija" }).click();
    await page.getByRole("dialog").getByLabel("Naziv").fill(root);
    await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Kategorija je dodata.")).toBeVisible();

    const tree = page.getByRole("list", { name: "Stablo kategorija" });
    await tree.getByRole("listitem", { name: root }).getByRole("button", { name: "Podkategorija" }).click();
    await page.getByRole("dialog").getByLabel("Naziv").fill(sub);
    await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj" }).click();
    await expect(tree.getByRole("listitem", { name: sub })).toBeVisible();

    const managed = (await apiAsAdmin("GET", "/categories/manage")).body as unknown as Managed[];
    const subId = find(managed, sub)!.id;
    const rootId = find(managed, root)!.id;
    const p = await product(run, { categoryId: subId });
    await page.reload();
    await expect(tree.getByRole("listitem", { name: sub })).toContainText("1 proizvod");
    await expect(tree.getByRole("listitem", { name: root })).toContainText("1 proizvod ukupno");

    // A category cannot go inside itself: its own subtree is not offered as a parent.
    await tree.getByRole("listitem", { name: root }).getByRole("button", { name: "Izmijeni" }).click();
    await expect(page.getByRole("dialog").getByRole("option", { name: sub })).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: "Nazad" }).click();

    await tree.getByRole("listitem", { name: sub }).getByRole("button", { name: "Obriši" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Još se koristi: 1 proizvod.")).toBeVisible();
    await dialog.getByLabel("Premjesti proizvode i podkategorije u").selectOption(rootId);
    await dialog.getByRole("button", { name: "Premjesti i obriši" }).click();
    await expect(page.getByText("Kategorija je obrisana.")).toBeVisible();
    await expect(tree.getByRole("listitem", { name: sub })).toHaveCount(0);

    const moved = (await apiAsAdmin("GET", `/admin/products/${p.id}`)).body as { category: { id: string } };
    expect(moved.category.id).toBe(rootId);
  });

  test("deleting a brand with products merges it into another", async ({ page }) => {
    const run = `${Date.now()}`;
    const typo = (await apiAsAdmin("POST", "/brands", { name: `Samsnug ${run}` })).body as { id: string };
    const right = (await apiAsAdmin("POST", "/brands", { name: `Samsung ${run}` })).body as { id: string; name: string };
    const managed = (await apiAsAdmin("GET", "/categories/manage")).body as unknown as Managed[];
    const p = await product(run, { categoryId: managed[0].id, brandId: typo.id });

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/katalog?tab=brendovi");
    const row = page.getByRole("row", { name: new RegExp(`Samsnug ${run}`) });
    await expect(row).toContainText("1");
    await row.getByRole("button", { name: "Obriši" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Prebaci proizvode na brend").selectOption(right.id);
    await dialog.getByRole("button", { name: "Premjesti i obriši" }).click();
    await expect(page.getByText("Brend je obrisan.")).toBeVisible();
    await expect(row).toHaveCount(0);

    const merged = (await apiAsAdmin("GET", `/admin/products/${p.id}`)).body as { brand: { id: string } };
    expect(merged.brand.id).toBe(right.id);
  });

  test("a used category needs a target outside itself; an empty one just goes", async () => {
    const run = Date.now();
    const parent = (await apiAsAdmin("POST", "/categories", { name: `E2E roditelj ${run}` })).body as { id: string };
    const child = (await apiAsAdmin("POST", "/categories", { name: `E2E dijete ${run}`, parentId: parent.id })).body as { id: string };
    const refused = await apiAsAdmin("DELETE", `/categories/${parent.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body?.code).toBe("CATEGORY_NOT_EMPTY");
    const intoItself = await apiAsAdmin("DELETE", `/categories/${parent.id}?moveTo=${child.id}`);
    expect(intoItself.body?.code).toBe("MOVE_TO_INVALID");
    expect((await apiAsAdmin("DELETE", `/categories/${child.id}`)).status).toBe(204);
    expect((await apiAsAdmin("DELETE", `/categories/${parent.id}`)).status).toBe(204);
  });
});
