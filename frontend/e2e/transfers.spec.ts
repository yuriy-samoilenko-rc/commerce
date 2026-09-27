import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  apiAsAdmin,
  createUser,
  expectPath,
  login,
  receiveStock,
  seedProduct,
  seedReceivingSetup,
  seedWarehouse,
} from "./helpers";

async function openNewTransfer(page: Page) {
  await page.goto("/admin/prenos/novi");
  await expect(page.getByRole("heading", { name: "Novi prenos robe" })).toBeVisible();
}

async function addProduct(page: Page, sku: string, name: string) {
  await page.getByLabel("Pretraga proizvoda").fill(sku);
  await page.getByRole("button", { name: `Dodaj: ${name}` }).click();
}

const stockRow = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(name) });

test.describe("moving goods between warehouses", () => {
  test("serial-tracked goods are sent, travel and are received", async ({ page }) => {
    const s = await seedReceivingSetup({ trackSerial: true });
    await receiveStock(s, 2, [`TR-${s.run}-1`, `TR-${s.run}-2`]);
    const shop = await seedWarehouse("E2E prodavnica");
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");

    // Started from the warehouse screen: the source is already chosen.
    await page.goto(`/admin/skladiste?w=${s.warehouse.id}`);
    await page.getByRole("link", { name: "Prenos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Novi prenos robe" })).toBeVisible();
    await expect(page.getByLabel("Iz skladišta")).toHaveValue(s.warehouse.id);
    await page.getByLabel("U skladište").selectOption(shop.id);
    await addProduct(page, s.product.sku, s.product.name);
    await page.getByLabel(`Količina: ${s.product.name}`).fill("2");
    await page.getByLabel(`Serijski brojevi: ${s.product.name}`).fill(`TR-${s.run}-1`);
    await page.getByRole("button", { name: "Pošalji robu" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("potrebno je 2 serijskih brojeva, uneseno 1");

    await page.getByLabel(`Serijski brojevi: ${s.product.name}`).fill(`TR-${s.run}-1\nTR-${s.run}-2`);
    await page.getByRole("button", { name: "Pošalji robu" }).click();
    await expect(page.getByText(/je poslat, roba je u prenosu/)).toBeVisible();
    await expect(page.getByText("U prenosu", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Prenosnica / })).toBeVisible();

    // In transit: gone from the source, announced at the destination.
    await page.goto(`/admin/skladiste?w=${s.warehouse.id}`);
    await expect(page.getByText("Skladište je prazno.")).toBeVisible();
    await page.goto(`/admin/skladiste?w=${shop.id}`);
    await expect(page.getByText("Stiže (u prenosu)").locator("..")).toContainText("2");

    await page.goto("/admin/prenos");
    await page.getByLabel("U skladište").selectOption(shop.id);
    await page.getByRole("button", { name: "Primijeni" }).click();
    await page.getByRole("link", { name: /^TR-\d{5}$/ }).first().click();
    await page.getByRole("button", { name: "Primi robu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Primi robu" }).click();
    await expect(page.getByText("Roba je primljena na skladište.")).toBeVisible();
    await expect(page.getByText("Primljen", { exact: true })).toBeVisible();

    await page.goto(`/admin/skladiste?w=${shop.id}`);
    await expect(stockRow(page, s.product.name)).toContainText("2");
  });

  test("sending more than is available keeps the draft and names the product", async ({ page }) => {
    const { product, warehouse } = await seedProduct(1);
    const shop = await seedWarehouse("E2E prodavnica");
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openNewTransfer(page);

    await page.getByLabel("Iz skladišta").selectOption(warehouse.id);
    await page.getByLabel("U skladište").selectOption(shop.id);
    await addProduct(page, product.sku, product.name);
    await page.getByLabel(`Količina: ${product.name}`).fill("3");
    await page.getByRole("button", { name: "Pošalji robu" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      `Nema dovoljno robe: „${product.name}“ — traženo 3, dostupno 1.`,
    );
    await expect(page).toHaveURL(/\/admin\/prenos\/[0-9a-f-]{36}$/);

    // Fixing the quantity sends the same draft, not a new one.
    await page.getByLabel(`Količina: ${product.name}`).fill("1");
    await page.getByRole("button", { name: "Pošalji robu" }).click();
    await expect(page.getByText(/je poslat, roba je u prenosu/)).toBeVisible();
    await page.goto(`/admin/prenos?fromWarehouseId=${warehouse.id}`);
    await expect(page.getByText("Ukupno: 1")).toBeVisible();
  });

  test("a warehouse cannot send to itself", async ({ page }) => {
    const { warehouse } = await seedProduct(1);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openNewTransfer(page);
    await page.getByLabel("Iz skladišta").selectOption(warehouse.id);
    // The destination list does not offer the source...
    await expect(page.getByLabel("U skladište").locator(`option[value="${warehouse.id}"]`)).toBeDisabled();
    // ...and the form says so if nothing else was chosen.
    await page.getByRole("button", { name: "Sačuvaj nacrt" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Izaberite skladište u koje roba ide.");
  });

  test("the accountant follows transfers but does not move goods", async ({ page }) => {
    const s = await seedReceivingSetup();
    await receiveStock(s, 1);
    const shop = await seedWarehouse("E2E prodavnica");
    const accountant = await createUser("ACCOUNTANT");
    const created = await apiAsAdmin("POST", "/transfers", {
      fromWarehouseId: s.warehouse.id,
      toWarehouseId: shop.id,
      items: [{ productId: s.product.id, quantity: 1 }],
    });
    const t = { id: String(created.body?.id) };
    await apiAsAdmin("POST", `/transfers/${t.id}/send`, {});

    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/prenos");
    await expect(page.getByRole("link", { name: "Novi prenos" })).toHaveCount(0);
    await page.goto(`/admin/prenos/${t.id}`);
    await expect(page.getByText("U prenosu", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Primi robu" })).toHaveCount(0);
  });
});
