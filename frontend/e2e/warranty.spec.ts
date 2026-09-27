import { expect, test, type Page } from "@playwright/test";
import { ADMIN, apiAsAdmin, createUser, expectPath, login, sellSerialUnit } from "./helpers";

async function lookUp(page: Page, serial: string) {
  await page.goto("/admin/garancija/novi");
  await page.getByLabel("Serijski broj (IMEI)").fill(serial);
  await page.getByRole("button", { name: "Provjeri" }).click();
}

/** Opens a field dialog by its button, fills the given labels, submits. */
async function act(page: Page, label: string, fill: Record<string, string> = {}, select: Record<string, string> = {}) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [field, value] of Object.entries(select)) await dialog.getByLabel(field).selectOption(value);
  for (const [field, value] of Object.entries(fill)) await dialog.getByLabel(field).fill(value);
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

test.describe("warranty cases", () => {
  test("a unit goes to service, gets repaired and returns to its owner", async ({ page }) => {
    const s = await sellSerialUnit();
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");

    await lookUp(page, s.sold);
    await expect(page.getByText(s.product.name)).toBeVisible();
    await expect(page.getByText(`Garancija ${s.run}, +382 67 555 000`)).toBeVisible();
    await expect(page.getByText(/^važi do /)).toBeVisible();
    await page.getByLabel("Šta kupac prijavljuje").fill("Ekran se gasi nakon par minuta");
    await page.getByRole("button", { name: "Otvori zahtjev" }).click();

    await expect(page.getByRole("heading", { name: /^Garancija WAR-\d{5}$/ })).toBeVisible();
    await expect(page.getByText("Otvoreno", { exact: true })).toBeVisible();
    // Replacing a unit or refusing a claim is not the storekeeper's decision.
    await expect(page.getByRole("button", { name: "Odbij" })).toHaveCount(0);

    await page.getByRole("button", { name: "Uređaj primljen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Uređaj primljen" }).click();
    await expect(page.getByText("Uređaj primljen", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Zamijeni uređaj" })).toHaveCount(0);

    await act(page, "Pošalji u servis", { Servis: "Samsung servis Podgorica" });
    await expect(page.getByText("U servisu", { exact: true })).toBeVisible();
    await act(page, "Popravljeno", { "Šta je urađeno (nije obavezno)": "Zamijenjen displej" });
    await expect(page.getByText("Popravljeno", { exact: true }).first()).toBeVisible();
    await act(page, "Vrati kupcu");
    await expect(page.getByText("Zatvoreno", { exact: true })).toBeVisible();
    await expect(page.getByText(/Samsung servis Podgorica/)).toBeVisible();
    await expect(page.getByText("Ishod: Zamijenjen displej")).toBeVisible();

    const unit = await apiAsAdmin("GET", `/serials/${s.sold}`);
    expect(unit.body?.status).toBe("SOLD");
  });

  test("a faulty unit is replaced from stock", async ({ page }) => {
    const s = await sellSerialUnit();
    const created = await apiAsAdmin("POST", "/admin/warranty-cases", { serialNumber: s.sold, problem: "Ne puni bateriju" });
    const id = String(created.body?.id);
    await apiAsAdmin("POST", `/admin/warranty-cases/${id}/receive`, {});

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(`/admin/garancija/${id}`);

    await act(page, "Zamijeni uređaj", { "Serijski broj novog komada": "NEMA-TAKVOG" }, { Skladište: s.warehouse.id });
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
      `Serijski broj NEMA-TAKVOG nije slobodan komad proizvoda „${s.product.name}“ na polici izabranog skladišta.`,
    );
    await page.getByRole("dialog").getByLabel("Serijski broj novog komada").fill(s.spare);
    await page.getByRole("dialog").getByRole("button", { name: "Zamijeni uređaj" }).click();
    await expect(page.getByText("Zamijenjeno", { exact: true })).toBeVisible();
    await expect(page.getByText(s.spare)).toBeVisible();

    expect((await apiAsAdmin("GET", `/serials/${s.sold}`)).body?.status).toBe("WRITTEN_OFF");
    expect((await apiAsAdmin("GET", `/serials/${s.spare}`)).body?.status).toBe("SOLD");
  });

  test("only sold units with a running warranty, one open claim each", async ({ page }) => {
    const s = await sellSerialUnit();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");

    await lookUp(page, "NE-POSTOJI-123");
    await expect(page.locator("main").getByRole("alert")).toHaveText("Serijski broj „NE-POSTOJI-123“ nije pronađen.");

    // The spare unit is still on the shelf: not sold, not under warranty.
    await lookUp(page, s.spare);
    await page.getByLabel("Šta kupac prijavljuje").fill("Test");
    await page.getByRole("button", { name: "Otvori zahtjev" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Garancija važi samo za prodate komade; ovaj je „Na stanju“.",
    );

    await apiAsAdmin("POST", "/admin/warranty-cases", { serialNumber: s.sold, problem: "Prvi zahtjev" });
    await lookUp(page, s.sold);
    await page.getByLabel("Šta kupac prijavljuje").fill("Drugi zahtjev");
    await page.getByRole("button", { name: "Otvori zahtjev" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Za ovaj komad je već otvoren garantni zahtjev WAR-");
  });
});
