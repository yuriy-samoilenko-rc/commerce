import { expect, test, type Page } from "@playwright/test";
import { ADMIN, apiAsAdmin, createUser, deliverOrder, expectPath, login, seedOrder } from "./helpers";

async function openReturn(page: Page, orderId: string, productName: string, qty: string, reason: string) {
  await page.goto(`/admin/narudzbe/${orderId}`);
  await page.getByRole("link", { name: "Povraćaj robe" }).click();
  await expect(page.getByRole("heading", { name: /^Povraćaj za narudžbu br\./ })).toBeVisible();
  await page.getByLabel(`Vraća se: ${productName}`).check();
  await page.getByLabel(`Količina za povraćaj: ${productName}`).fill(qty);
  await page.getByLabel(`Razlog: ${productName}`).selectOption(reason);
  await page.getByRole("button", { name: "Otvori povraćaj" }).click();
}

test.describe("returns", () => {
  test("taken back, inspected, approved and refunded", async ({ page }) => {
    const order = await seedOrder();
    await deliverOrder(order);
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");

    await openReturn(page, order.id, order.product.name, "1", "CHANGED_MIND");
    await expect(page.getByRole("heading", { name: /^Povraćaj RET-\d{5}$/ })).toBeVisible();
    await expect(page.getByText("Zahtjev primljen", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Roba primljena" }).click();
    await page.getByRole("dialog").getByLabel("Skladište").selectOption(order.warehouse.id);
    await page.getByRole("dialog").getByRole("button", { name: "Roba primljena" }).click();
    await expect(page.getByText("Roba vraćena", { exact: true })).toBeVisible();

    await page.getByLabel(`Odluka: ${order.product.name}`).selectOption("RESTOCK");
    await page.getByLabel(`Nalaz: ${order.product.name}`).fill("neotpakovano, ispravno");
    await page.getByRole("button", { name: "Sačuvaj odluke" }).click();
    await expect(page.getByText("Odluke su sačuvane.")).toBeVisible();
    // Approving commits money and stock: not the storekeeper's call.
    await expect(page.getByRole("button", { name: "Odobri povraćaj" })).toHaveCount(0);
    const url = page.url();

    await page.context().clearCookies();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(url);
    await page.getByRole("button", { name: "Odobri povraćaj" }).click();
    await expect(page.getByRole("dialog")).toContainText("Kupcu se duguje 49,90 €");
    await page.getByRole("dialog").getByRole("button", { name: "Odobri povraćaj" }).click();
    await expect(page.getByText("Odobren", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Povratnica / })).toBeVisible();

    await page.getByRole("button", { name: "Evidentiraj povraćaj novca" }).click();
    await page.getByRole("dialog").getByLabel(/Referenca uplate/).fill("NALOG-4711");
    await page.getByRole("dialog").getByRole("button", { name: "Evidentiraj povraćaj novca" }).click();
    await expect(page.getByText("Novac vraćen", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("NALOG-4711")).toBeVisible();

    // The unit is sellable again (5 received, 2 sold, 1 back) and the order shows the return.
    await page.goto(`/admin/skladiste?w=${order.warehouse.id}`);
    await expect(page.getByRole("row", { name: new RegExp(order.product.name) })).toContainText("4");
    await page.goto(`/admin/narudzbe/${order.id}`);
    await expect(page.getByText("Djelimično vraćena").first()).toBeVisible();
  });

  test("goods already being returned cannot be returned twice", async ({ page }) => {
    const order = await seedOrder();
    await deliverOrder(order);
    const lines = (await apiAsAdmin("GET", `/admin/orders/${order.id}`)).body as { items: { id: string }[] };
    await apiAsAdmin("POST", "/admin/returns", {
      orderId: order.id,
      items: [{ orderItemId: lines.items[0].id, quantity: 2, reason: "DEFECTIVE" }],
    });

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openReturn(page, order.id, order.product.name, "1", "DEFECTIVE");
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      `Od „${order.product.name}“ se može vratiti još najviše 0 kom.`,
    );
  });

  test("a return with every line rejected goes back to the customer", async ({ page }) => {
    const order = await seedOrder();
    await deliverOrder(order);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openReturn(page, order.id, order.product.name, "2", "DEFECTIVE");
    await expect(page.getByRole("heading", { name: /^Povraćaj RET-\d{5}$/ })).toBeVisible();

    await page.getByRole("button", { name: "Roba primljena" }).click();
    await page.getByRole("dialog").getByLabel("Skladište").selectOption(order.warehouse.id);
    await page.getByRole("dialog").getByRole("button", { name: "Roba primljena" }).click();
    await page.getByLabel(`Odluka: ${order.product.name}`).selectOption("REJECT");
    await page.getByLabel(`Nalaz: ${order.product.name}`).fill("oštećenje nastalo kod kupca");
    await page.getByRole("button", { name: "Sačuvaj odluke" }).click();
    await expect(page.getByText("Odluke su sačuvane.")).toBeVisible();

    await page.getByRole("button", { name: "Odobri povraćaj" }).click();
    await expect(page.getByRole("dialog")).toContainText("Nijedna stavka nije prihvaćena");
    await page.getByRole("dialog").getByRole("button", { name: "Odobri povraćaj" }).click();
    await expect(page.getByText("Odbijen", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Evidentiraj povraćaj novca" })).toHaveCount(0);
  });

  test("the returns list is open to the accountant", async ({ page }) => {
    const accountant = await createUser("ACCOUNTANT");
    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await page.getByRole("link", { name: "Povraćaji" }).first().click();
    await expect(page.getByRole("heading", { name: "Povraćaji" })).toBeVisible();
    await page.getByLabel("Status").selectOption("APPROVED");
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page).toHaveURL(/status=APPROVED/);
  });
});
