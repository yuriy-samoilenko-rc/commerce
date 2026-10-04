import { expect, test } from "@playwright/test";
import { ADMIN, createUser, deliverOrder, expectPath, login, seedOrder } from "./helpers";

test.describe("reports", () => {
  test("sales by product, periods, stock and exports", async ({ page }) => {
    // A delivered order today, so the sales report has a row for it.
    const order = await seedOrder();
    await deliverOrder(order);

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Izvještaji" }).click();
    await expect(page.getByText("Izvještaj o prodaji po danima")).toBeVisible();

    await page.getByRole("link", { name: "Danas" }).click();
    await page.getByLabel("Grupisanje").selectOption("product");
    await page.getByRole("button", { name: "Prikaži" }).click();
    await expect(page.getByText("Izvještaj o prodaji po proizvodima")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(order.product.name) });
    await expect(row).toContainText(order.product.sku);
    // 2 × 49,90 €
    await expect(row).toContainText("99,80 €");
    await expect(page.getByRole("row", { name: /^Ukupno/ })).toBeVisible();

    // Exports come as files.
    const xlsx = await page.request.get(await page.getByRole("link", { name: "Excel" }).getAttribute("href") as string);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    expect(xlsx.headers()["content-disposition"]).toContain("attachment");
    const csv = await page.request.get(await page.getByRole("link", { name: "CSV" }).getAttribute("href") as string);
    expect(await csv.text()).toContain(order.product.name);

    await page.getByRole("link", { name: "Zalihe" }).click();
    await expect(page.getByText("Izvještaj o stanju zaliha")).toBeVisible();
    await page.getByLabel("Skladište").selectOption(order.warehouse.id);
    await page.getByRole("button", { name: "Prikaži" }).click();
    await expect(page.getByRole("row", { name: new RegExp(order.product.name) })).toBeVisible();
  });

  test("the warehouse sees stock and movements, not money", async ({ page }) => {
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/izvjestaji");
    const tabs = page.getByRole("navigation", { name: "Vrsta izvještaja" });
    await expect(tabs.getByRole("link", { name: "Zalihe" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Kretanje robe" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Prodaja" })).toHaveCount(0);
    await expect(page.getByText("Izvještaj o stanju zaliha")).toBeVisible();

    // Asking for sales directly falls back to what the role may see.
    await page.goto("/admin/izvjestaji?vrsta=prodaja");
    await expect(page.getByText("Izvještaj o stanju zaliha")).toBeVisible();
  });
});
