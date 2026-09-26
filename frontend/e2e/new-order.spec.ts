import { expect, test } from "@playwright/test";
import { ADMIN, createUser, expectPath, login, seedProduct } from "./helpers";

test.describe("a phone order taken by a manager", () => {
  test("search a product, link a customer account, deliver by courier", async ({ page }) => {
    const { product } = await seedProduct(5);
    const customer = await createUser("CUSTOMER");
    const manager = await createUser("MANAGER");

    await login(page, manager.email, manager.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/narudzbe");
    await page.getByRole("link", { name: "Nova narudžba" }).click();
    await expectPath(page, "/admin/narudzbe/nova");

    // Nothing in the cart yet: the form says so instead of calling the API.
    await page.getByRole("button", { name: "Kreiraj narudžbu" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Dodajte bar jedan proizvod.");

    await page.getByLabel("Pretraga proizvoda").fill(product.sku);
    await page.getByRole("button", { name: `Dodaj: ${product.name}` }).click();
    await page.getByRole("button", { name: "Više" }).click();
    await expect(page.getByLabel(`Količina: ${product.name}`)).toHaveValue("2");

    await page.getByLabel("Pretraga kupaca").fill(customer.email);
    await page.getByRole("button", { name: new RegExp(customer.email) }).click();
    await expect(page.getByLabel("Ime i prezime")).toHaveValue(customer.name);
    await expect(page.getByLabel("Email (nije obavezan)")).toHaveValue(customer.email);

    await page.getByLabel("Telefon").fill("+382 69 555 111");
    await page.getByLabel(/Kurirska dostava/).check();
    await page.getByRole("button", { name: "Kreiraj narudžbu" }).click();
    await expect(page.getByText("Unesite adresu za dostavu.")).toBeVisible();
    await page.getByLabel("Adresa za dostavu").fill("Slobode 5, Podgorica");

    // 2 × 49,90 + 10,00 courier
    await expect(page.getByText("109,80 €")).toBeVisible();
    await page.getByRole("button", { name: "Kreiraj narudžbu" }).click();

    await expect(page.getByRole("heading", { name: /^Narudžba br\. \d+$/ })).toBeVisible();
    await expect(page.getByText("Telefon / prodavnica")).toBeVisible();
    await expect(page.getByText(`${customer.name} (${customer.email})`)).toBeVisible();
    await expect(page.getByText("Slobode 5, Podgorica")).toBeVisible();
    await expect(page.getByText(/rezervisano 2/)).toBeVisible();
    await expect(page.getByText("109,80 €")).toBeVisible();
  });

  test("more than is in stock is refused with a clear message", async ({ page }) => {
    const { product } = await seedProduct(1);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/narudzbe/nova");

    await page.getByLabel("Pretraga proizvoda").fill(product.sku);
    await page.getByRole("button", { name: `Dodaj: ${product.name}` }).click();
    await page.getByLabel(`Količina: ${product.name}`).fill("3");
    await expect(page.getByText("Tražena količina je veća od dostupne.")).toBeVisible();

    await page.getByLabel("Ime i prezime").fill("Petar Petrović");
    await page.getByLabel("Telefon").fill("+382 67 111 222");
    await page.getByRole("button", { name: "Kreiraj narudžbu" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      `Nema dovoljno robe: „${product.name}“ — traženo 3, dostupno 1.`,
    );
    await expectPath(page, "/admin/narudzbe/nova");
  });

  test("warehouse staff and accountants cannot take orders", async ({ page }) => {
    const accountant = await createUser("ACCOUNTANT");
    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/narudzbe");
    await expect(page.getByRole("link", { name: "Nova narudžba" })).toHaveCount(0);
    await page.goto("/admin/narudzbe/nova");
    await expect(page.getByText("Narudžbe unose administrator i menadžer.")).toBeVisible();
  });
});
