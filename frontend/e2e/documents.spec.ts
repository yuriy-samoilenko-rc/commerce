import { expect, test } from "@playwright/test";
import { ADMIN, createUser, deliverOrder, expectPath, login, receiveStock, seedOrder, seedReceivingSetup } from "./helpers";

test.describe("documents", () => {
  test("all documents in one list, filtered and sorted", async ({ page }) => {
    // A delivered order issues an invoice and a delivery note; a receiving a receiving note.
    const order = await seedOrder();
    await deliverOrder(order);
    const setup = await seedReceivingSetup();
    await receiveStock(setup, 3);
    const customer = `Kupac ${order.product.sku.slice(4)}`;

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Dokumenti" }).click();
    await expectPath(page, "/admin/dokumenti");
    await expect(page.getByRole("heading", { name: "Dokumenti" })).toBeVisible();

    // Clicking a partner shows all of their documents: the order's invoice and delivery note.
    await page.getByLabel("Pretraga").fill(customer);
    await page.getByRole("button", { name: "Primijeni" }).click();
    await page.getByRole("link", { name: customer }).first().click();
    await expect(page.getByText(`Partner:`)).toBeVisible();
    const rows = page.getByRole("row").filter({ hasText: customer });
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: "Račun" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Otpremnica" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Račun" }).getByRole("link", { name: "Narudžba" })).toHaveAttribute(
      "href",
      `/admin/narudzbe/${order.id}`,
    );
    // The number opens the PDF.
    const pdfHref = await rows.filter({ hasText: "Račun" }).getByRole("link", { name: /^INV-/ }).getAttribute("href");
    const pdf = await page.request.get(pdfHref!);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // Sorting by type puts the invoice (first type) first, then reverses.
    await page.getByRole("link", { name: /^Vrsta: sortiraj rastuće/ }).click();
    await expect(page).toHaveURL(/sort=type&dir=asc/);
    await expect(rows.first()).toContainText("Račun");
    await page.getByRole("link", { name: /^Vrsta: sortiraj opadajuće/ }).click();
    await expect(rows.first()).toContainText("Otpremnica");

    // The partner filter goes away with its chip; the type filter narrows to receiving notes.
    await page.getByRole("link", { name: "Ukloni filter partnera" }).click();
    await expect(page.getByText("Partner:")).toHaveCount(0);
    await page.getByLabel("Pretraga").fill("");
    await page.getByLabel("Vrsta", { exact: true }).selectOption("RECEIVING_NOTE");
    await page.getByLabel("Skladište", { exact: true }).selectOption(setup.warehouse.id);
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page).toHaveURL(/type=RECEIVING_NOTE/);
    await expect(page).toHaveURL(/sort=type/);
    const receiving = page.getByRole("row").filter({ hasText: "Prijemnica" });
    await expect(receiving).toHaveCount(1);
    await expect(receiving).toContainText(setup.warehouse.name);
    await expect(page.getByText("Pronađeno dokumenata: 1")).toBeVisible();

    // A date range in the past finds nothing.
    await page.getByLabel("Od datuma").fill("2020-01-01");
    await page.getByLabel("Do datuma").fill("2020-01-31");
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page.getByText("Nema dokumenata koji odgovaraju filterima.")).toBeVisible();
    await page.getByRole("link", { name: "Poništi filtere" }).click();
    await expect(page).toHaveURL(/\/admin\/dokumenti\?sort=type&dir=desc$/);
  });

  test("the accountant reads the documents list", async ({ page }) => {
    const accountant = await createUser("ACCOUNTANT");
    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/dokumenti");
    await expect(page.getByText(/Pronađeno dokumenata: \d/)).toBeVisible();
  });
});
