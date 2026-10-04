import { expect, test } from "@playwright/test";
import { ADMIN, createUser, expectPath, login, receiveStock, seedReceivingSetup } from "./helpers";

test.describe("suppliers", () => {
  test("the admin adds a supplier with a contract, deactivates it and deletes it while unused", async ({ page }) => {
    const name = `Tehno Uvoz ${Date.now()}`;
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Dobavljači" }).click();
    await expect(page.getByRole("heading", { name: "Dobavljači", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Novi dobavljač" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Naziv").fill(name);
    await dialog.getByLabel("PIB").fill("02456789");
    await dialog.getByLabel("Kontakt osoba").fill("Ana Petrović");
    await dialog.getByLabel("Telefon").fill("+382 20 123 456");
    await dialog.getByLabel("E-pošta").fill("nabavka@tehnouvoz.me");
    await dialog.getByLabel("Žiro račun").fill("510-12345-67");
    await dialog.getByLabel("Broj ugovora").fill("UG-12/2025");
    await dialog.getByLabel("Ugovor važi do").fill("2025-12-31");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();

    // A new supplier opens its card.
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("510-12345-67")).toBeVisible();
    await expect(page.getByText("br. UG-12/2025")).toBeVisible();
    await expect(page.getByText("31.12.2025. — istekao")).toBeVisible();
    await expect(page.getByText("Od ovog dobavljača još nije bilo prijema.")).toBeVisible();

    await page.getByRole("button", { name: "Izmijeni" }).click();
    await page.getByRole("dialog").getByLabel(/^Aktivan/).uncheck();
    await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Neaktivan", { exact: true })).toBeVisible();

    // The receiving form offers active suppliers only.
    await page.goto("/admin/prijem/novi");
    await expect(page.getByRole("option", { name })).toHaveCount(0);

    await page.goBack();
    await page.getByRole("button", { name: "Obriši" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Obriši" }).click();
    await expectPath(page, "/admin/dobavljaci");
    await expect(page.getByText("Dobavljač je obrisan.")).toBeVisible();
    await page.getByLabel("Pretraga dobavljača").fill(name);
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page.getByText("Nema dobavljača koji odgovaraju filterima.")).toBeVisible();
  });

  test("the card sums purchases from confirmed receivings; the warehouse has no access", async ({ page, browser }) => {
    const setup = await seedReceivingSetup();
    await receiveStock(setup, 3);
    await receiveStock(setup, 7);

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(`/admin/dobavljaci?q=${encodeURIComponent(setup.supplier.name)}`);
    const row = page.getByRole("row", { name: new RegExp(setup.supplier.name) });
    // 10 × 100,00 € in two deliveries
    await expect(row).toContainText("1.000,00 €");
    await row.getByRole("link", { name: setup.supplier.name }).click();

    const tile = (label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd");
    await expect(tile("Ukupno nabavljeno")).toHaveText("1.000,00 €");
    await expect(tile("Isporuka")).toHaveText("2");
    await expect(tile("Različitih proizvoda")).toHaveText("1");
    await expect(page.getByRole("row", { name: /RCV-/ })).toHaveCount(2);
    // Used suppliers are deactivated, not deleted.
    await expect(page.getByRole("button", { name: "Obriši" })).toHaveCount(0);

    const storekeeper = await createUser("WAREHOUSE");
    const context = await browser.newContext();
    const other = await context.newPage();
    await login(other, storekeeper.email, storekeeper.password);
    await expectPath(other, "/admin");
    await expect(other.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Dobavljači" })).toHaveCount(0);
    await other.goto("/admin/dobavljaci");
    await expectPath(other, "/admin");
    await context.close();
  });
});
