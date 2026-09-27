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
} from "./helpers";

async function startCount(page: Page, warehouseId: string) {
  await page.goto("/admin/popis");
  await page.getByRole("button", { name: "Novi popis" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Skladište").selectOption(warehouseId);
  await dialog.getByRole("button", { name: "Počni popis" }).click();
  return dialog;
}

async function scan(page: Page, code: string, qty?: number) {
  await page.getByLabel("Bar-kod, šifra ili serijski broj").fill(code);
  if (qty) await page.getByLabel("Komada").fill(String(qty));
  await page.getByRole("button", { name: "Izbroji" }).click();
}

const result = (page: Page) => page.locator("main").getByRole("status").or(page.locator("main").getByRole("alert"));

async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("dialog").getByRole("button", { name: label }).click();
}

test.describe("stock counts", () => {
  test("counted by a storekeeper, approved by the admin", async ({ page }) => {
    const { product, warehouse } = await seedProduct(5);
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");

    await startCount(page, warehouse.id);
    await expect(page.getByRole("heading", { name: /^Popis CNT-\d{5}$/ })).toBeVisible();
    await expect(page.getByText("Brojanje u toku", { exact: true })).toBeVisible();

    await scan(page, product.sku, 3);
    await expect(result(page)).toHaveText(`${product.name}: izbrojano 3, u evidenciji 5.`);
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("-2");

    // A mis-scan is corrected by hand.
    await page.getByRole("button", { name: `Ispravi: ${product.name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Izbrojano komada")).toHaveValue("3");
    await dialog.getByLabel("Izbrojano komada").fill("4");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("-1");

    // While the count is open, this stock does not move.
    const blocked = await apiAsAdmin("POST", "/stock/adjustments", {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: -1,
      reason: "test",
    });
    expect(blocked.body?.code).toBe("STOCK_BEING_COUNTED");

    await confirm(page, "Završi brojanje");
    await expect(page.getByText("Izbrojano", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Odobri razlike" })).toHaveCount(0);
    const url = page.url();

    await page.context().clearCookies();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(url);
    await confirm(page, "Odobri razlike");
    await expect(page.getByText("Popis je odobren, zaliha je usklađena.")).toBeVisible();
    await expect(page.getByText("Odobren", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Popisna lista / })).toBeVisible();

    await page.goto(`/admin/skladiste?w=${warehouse.id}`);
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("4");
  });

  test("serial goods: missing and unknown units become shortage and surplus", async ({ page }) => {
    const s = await seedReceivingSetup({ trackSerial: true });
    await receiveStock(s, 2, [`CNT-${s.run}-A`, `CNT-${s.run}-B`]);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await startCount(page, s.warehouse.id);
    await expect(page.getByRole("heading", { name: /^Popis CNT-\d{5}$/ })).toBeVisible();

    await scan(page, `CNT-${s.run}-A`);
    await expect(result(page)).toHaveText(`${s.product.name}: izbrojano 1, u evidenciji 2.`);
    await scan(page, `CNT-${s.run}-A`);
    await expect(result(page)).toHaveText(`Serijski broj CNT-${s.run}-A je već izbrojan.`);
    await scan(page, s.product.sku);
    await expect(result(page)).toHaveText(
      `„${s.product.name}“ se vodi po serijskim brojevima: skenirajte serijski broj, ne bar-kod.`,
    );
    await scan(page, `NEPOZNAT-${s.run}`);
    await expect(result(page)).toContainText(`Nepoznat kod „NEPOZNAT-${s.run}“`);

    // A unit with a label nobody registered: entered by hand on the product line.
    await page.getByRole("button", { name: `Ispravi: ${s.product.name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(/Serijski brojevi/)).toHaveValue(`CNT-${s.run}-A`);
    await dialog.getByLabel(/Serijski brojevi/).fill(`CNT-${s.run}-A\nNOVI-${s.run}`);
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();

    const row = page.getByRole("row", { name: new RegExp(s.product.name) });
    await expect(row).toContainText(`Nedostaje: CNT-${s.run}-B`);
    await expect(row).toContainText(`Višak: NOVI-${s.run}`);

    await confirm(page, "Završi brojanje");
    await confirm(page, "Odobri razlike");
    await expect(page.getByText("Odobren", { exact: true })).toBeVisible();
    // Quantities balance out (2 and 2), yet the approved count still shows which units differed.
    const approvedRow = page.getByRole("row", { name: new RegExp(s.product.name) });
    await expect(approvedRow).toContainText(`Nedostaje: CNT-${s.run}-B`);
    await expect(approvedRow).toContainText(`Višak: NOVI-${s.run}`);
    await expect(page.getByText("Sa razlikom").locator("..")).toContainText("1");

    // The shelf now holds A and the newly registered unit; B is written off.
    const shelf = await apiAsAdmin("GET", `/serials/NOVI-${s.run}`);
    expect(shelf.body?.status).toBe("IN_STOCK");
    const gone = await apiAsAdmin("GET", `/serials/CNT-${s.run}-B`);
    expect(gone.body?.status).toBe("WRITTEN_OFF");
  });

  test("one open count per warehouse", async ({ page }) => {
    const { warehouse } = await seedProduct(1);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await startCount(page, warehouse.id);
    await expect(page.getByRole("heading", { name: /^Popis CNT-\d{5}$/ })).toBeVisible();
    const number = (await page.getByRole("heading", { level: 1 }).textContent())?.replace("Popis ", "");

    const dialog = await startCount(page, warehouse.id);
    await expect(dialog.getByRole("alert")).toHaveText(`Za ovo skladište je već otvoren popis ${number}.`);

    // Cancelling frees the warehouse again.
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: number! }).click();
    await confirm(page, "Otkaži popis");
    await expect(page.getByText("Otkazan", { exact: true })).toBeVisible();
  });
});
