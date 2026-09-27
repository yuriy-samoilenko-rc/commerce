import { expect, test, type Page } from "@playwright/test";
import { ADMIN, apiAsAdmin, createUser, expectPath, login, orderInPicking, serialOrderInPicking } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

/** Logs in on the phone and picks the warehouse the phone works in. */
async function openApp(page: Page, email: string, password: string, warehouseName: string) {
  await login(page, email, password);
  await page.waitForURL((u) => u.pathname !== "/prijava");
  await page.goto("/m");
  await expectPath(page, "/m/skladiste");
  await page.getByRole("button", { name: warehouseName }).click();
  await expectPath(page, "/m");
}

async function scan(page: Page, code: string) {
  await page.getByLabel(/Skenirajte ili upišite kod|Bar-kod, šifra ili serijski broj/).fill(code);
  await page.getByRole("button", { name: "OK" }).click();
}

const answer = (page: Page) => page.locator("main").getByRole("status").or(page.locator("main").getByRole("alert"));

test.describe("warehouse phone app", () => {
  test("a storekeeper picks an order by scanning", async ({ page }) => {
    const o = await orderInPicking();
    const storekeeper = await createUser("WAREHOUSE");
    await openApp(page, storekeeper.email, storekeeper.password, o.warehouse.name);

    await expect(page.getByRole("heading", { name: /^Dobr(o jutro|ar dan|o veče), E2E$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sklapanje: 1" })).toBeVisible();
    await page.getByRole("link", { name: "Sklapanje: 1" }).click();
    await page.getByRole("link", { name: new RegExp(`Narudžba ${o.number}`) }).click();
    await expect(page.getByRole("heading", { name: `Narudžba ${o.number}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ostalo: 2 kom." })).toBeDisabled();

    await scan(page, "NEPOSTOJECI-KOD");
    await expect(answer(page)).toHaveText(/Nepoznat kod „NEPOSTOJECI-KOD“/);

    await scan(page, o.product.sku);
    await expect(answer(page)).toHaveText(`✓ ${o.product.name} — 1/2`);
    // A scan too many is undone on the line.
    await page.getByRole("button", { name: `Vrati jedan: ${o.product.name}` }).click();
    await expect(answer(page)).toHaveText(`Vraćen 1 kom. na policu: ${o.product.name}`);
    await scan(page, o.product.sku);
    await scan(page, o.product.sku);
    await expect(answer(page)).toHaveText(`✓ ${o.product.name} — 2/2`);
    await scan(page, o.product.sku);
    await expect(answer(page)).toHaveText(`„${o.product.name}“: ostalo je još samo 0 kom. za sklapanje.`);

    await page.getByRole("button", { name: "Završi sklapanje" }).click();
    await expectPath(page, "/m/sklapanje");
    await expect(page.getByText(`Narudžba ${o.number} je spremna za slanje.`)).toBeVisible();
    const order = await apiAsAdmin("GET", `/admin/orders/${o.id}`);
    expect(order.body?.status).toBe("READY_TO_SHIP");
  });

  test("serial goods are picked by serial number, not barcode", async ({ page }) => {
    const s = await serialOrderInPicking();
    await openApp(page, ADMIN.email, ADMIN.password, s.warehouse.name);
    await page.goto(`/m/sklapanje/${s.order.id}`);

    await scan(page, s.product.sku);
    await expect(answer(page)).toHaveText(
      `„${s.product.name}“ se vodi po serijskim brojevima: skenirajte serijski broj, ne bar-kod.`,
    );
    await scan(page, s.serial);
    await expect(answer(page)).toHaveText(`✓ ${s.product.name} — 1/1`);
    await page.getByRole("button", { name: `Poništi ${s.serial}` }).click();
    await expect(answer(page)).toHaveText(`Vraćeno na policu: ${s.serial}`);
    await expect(page.getByRole("button", { name: "Ostalo: 1 kom." })).toBeVisible();
  });

  test("scanning tells what a code is and how much of it is here", async ({ page }) => {
    const s = await serialOrderInPicking();
    await openApp(page, ADMIN.email, ADMIN.password, s.warehouse.name);
    await page.getByRole("link", { name: "Skeniraj" }).click();

    await scan(page, s.serial);
    const card = page.getByRole("region", { name: "Rezultat skeniranja" });
    await expect(card).toContainText(s.product.name);
    await expect(card).toContainText("Na stanju");
    // One unit on the shelf, reserved for the order being picked.
    await expect(card).toContainText(/1\s*Na stanju/);
    await expect(card).toContainText(/1\s*Rezervisano/);

    await scan(page, s.product.sku);
    await expect(card).toContainText(s.product.sku);

    await scan(page, "NISTA-OVAKO");
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Kod „NISTA-OVAKO“ nije pronađen ni kao proizvod ni kao serijski broj.",
    );
  });

  test("the app can be installed: manifest and icons", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const body = await manifest.json();
    expect([body.start_url, body.display, body.lang]).toEqual(["/m", "standalone", "sr-Latn-ME"]);
    for (const size of [192, 512]) {
      const icon = await request.get(`/icon/${size}`);
      expect(icon.headers()["content-type"]).toContain("image/png");
    }
  });
});
