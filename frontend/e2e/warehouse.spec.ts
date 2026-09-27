import { expect, test, type Page } from "@playwright/test";
import { ADMIN, createUser, expectPath, login, seedProduct, seedReceivingSetup } from "./helpers";

async function fillHeader(page: Page, s: Awaited<ReturnType<typeof seedReceivingSetup>>) {
  await page.getByLabel("Dobavljač").selectOption(s.supplier.id);
  await page.getByLabel("Skladište").selectOption(s.warehouse.id);
  await page.getByLabel("Broj računa").fill(`R-${s.run}`);
}

async function addProduct(page: Page, sku: string, name: string) {
  await page.getByLabel("Pretraga proizvoda").fill(sku);
  await page.getByRole("button", { name: `Dodaj: ${name}` }).click();
}

test.describe("warehouse and receiving goods", () => {
  test("a storekeeper receives serial-tracked goods: draft, then confirm", async ({ page }) => {
    const s = await seedReceivingSetup({ trackSerial: true });
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");

    await page.getByRole("link", { name: "Prijem robe" }).first().click();
    await page.getByRole("link", { name: "Novi prijem" }).click();
    // The list has filters with the same labels: wait for the form itself.
    await expect(page.getByRole("heading", { name: "Novi prijem robe" })).toBeVisible();
    await fillHeader(page, s);
    await addProduct(page, s.product.sku, s.product.name);
    await page.getByLabel(`Količina: ${s.product.name}`).fill("2");
    await page.getByLabel(`Nabavna cijena: ${s.product.name}`).fill("120,50");
    await page.getByLabel(`Serijski brojevi: ${s.product.name}`).fill(`SN-${s.run}-1\n`);
    await expect(page.getByText("241,00 €")).toBeVisible();

    // One serial number short: the draft can be saved, but not confirmed.
    await page.getByRole("button", { name: "Potvrdi prijem" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "potrebno je 2 serijskih brojeva" })).toBeVisible();
    await page.getByRole("button", { name: "Sačuvaj nacrt" }).click();
    await expect(page.getByRole("heading", { name: /^Prijem RCV-\d{5}$/ })).toBeVisible();
    await expect(page.getByText("Nacrt", { exact: true })).toBeVisible();

    // Back on the draft later: finish the serial numbers and confirm.
    await page.reload();
    await page.getByLabel(`Serijski brojevi: ${s.product.name}`).fill(`SN-${s.run}-1\nSN-${s.run}-2`);
    await page.getByRole("button", { name: "Potvrdi prijem" }).click();
    await expect(page.getByText(/je potvrđen, roba je na stanju/)).toBeVisible();
    await expect(page.getByText("Potvrđen", { exact: true })).toBeVisible();
    await expect(page.getByText(`SN-${s.run}-1, SN-${s.run}-2`)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Prijemnica / })).toBeVisible();

    await page.goto(`/admin/skladiste?w=${s.warehouse.id}`);
    const row = page.getByRole("row", { name: new RegExp(s.product.name) });
    await expect(row).toContainText("2");
  });

  test("a serial number cannot be received twice", async ({ page }) => {
    const s = await seedReceivingSetup({ trackSerial: true });
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    for (const attempt of [1, 2]) {
      await page.goto("/admin/prijem/novi");
      await fillHeader(page, s);
      await addProduct(page, s.product.sku, s.product.name);
      await page.getByLabel(`Nabavna cijena: ${s.product.name}`).fill("100");
      await page.getByLabel(`Serijski brojevi: ${s.product.name}`).fill(`DUP-${s.run}`);
      await page.getByRole("button", { name: "Potvrdi prijem" }).click();
      if (attempt === 1) {
        await expect(page.getByText(/je potvrđen, roba je na stanju/)).toBeVisible();
      } else {
        await expect(page.locator("main").getByRole("alert")).toHaveText(`Serijski brojevi su već evidentirani: DUP-${s.run}.`);
        // The draft was kept so the number can be corrected.
        await expect(page).toHaveURL(/\/admin\/prijem\/[0-9a-f-]{36}$/);
      }
    }
  });

  test("a draft can be cancelled and leaves stock untouched", async ({ page }) => {
    const s = await seedReceivingSetup();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/prijem/novi");
    await fillHeader(page, s);
    await addProduct(page, s.product.sku, s.product.name);
    await page.getByLabel(`Količina: ${s.product.name}`).fill("5");
    await page.getByLabel(`Nabavna cijena: ${s.product.name}`).fill("1.250");
    await expect(page.getByText("6.250,00 €")).toBeVisible();
    await page.getByRole("button", { name: "Sačuvaj nacrt" }).click();
    await page.getByRole("button", { name: "Otkaži nacrt" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Otkaži nacrt" }).click();
    await expect(page.getByText("Otkazan", { exact: true })).toBeVisible();
    await page.goto(`/admin/skladiste?w=${s.warehouse.id}`);
    await expect(page.getByText("Skladište je prazno.")).toBeVisible();
  });

  test("an admin corrects stock with a reason", async ({ page }) => {
    const { product, warehouse } = await seedProduct(5);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("link", { name: "Skladište" }).first().click();
    await page.getByLabel("Skladište").selectOption(warehouse.id);
    await page.getByRole("button", { name: "Prikaži" }).click();
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("5");

    await page.getByRole("button", { name: `Korekcija: ${product.name}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Promjena količine").fill("-7");
    await dialog.getByLabel("Razlog").fill("oštećeno pri istovaru");
    await dialog.getByRole("button", { name: "Evidentiraj" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(`Nema dovoljno robe: „${product.name}“ — traženo 7, dostupno 5.`);

    await dialog.getByLabel("Promjena količine").fill("-2");
    await dialog.getByRole("button", { name: "Evidentiraj" }).click();
    await expect(page.getByText("Korekcija je evidentirana.")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("3");

    await page.goto(`/admin/proizvodi/${product.id}`);
    await expect(page.getByRole("row", { name: /Korekcija/ })).toContainText("-2");
  });

  test("the accountant reads receivings but neither receives nor corrects", async ({ page }) => {
    const { warehouse } = await seedProduct(1);
    const accountant = await createUser("ACCOUNTANT");
    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/prijem");
    await expect(page.getByRole("heading", { name: "Prijem robe" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novi prijem" })).toHaveCount(0);
    await page.goto(`/admin/skladiste?w=${warehouse.id}`);
    await expect(page.getByRole("button", { name: /Korekcija/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Novi prijem" })).toHaveCount(0);
  });
});
