import { expect, test, type Page } from "@playwright/test";
import { ADMIN, createUser, expectPath, login, pickAll, seedOrder } from "./helpers";

async function openOrder(page: Page, id: string) {
  await page.goto(`/admin/narudzbe/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Narudžba br.");
}

/** Clicks and waits for the success toast (the page refreshes itself afterwards). */
async function act(page: Page, button: string, toast: string | RegExp) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByText(toast)).toBeVisible();
}

test.describe("orders in the back office", () => {
  test("the list finds an order by number and opens it", async ({ page }) => {
    const order = await seedOrder();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");

    await page.getByRole("link", { name: "Narudžbe" }).first().click();
    await expectPath(page, "/admin/narudzbe");
    await page.getByLabel("Pretraga").fill(String(order.number));
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page).toHaveURL(new RegExp(`search=${order.number}`));
    await expect(page.getByText("Ukupno: 1")).toBeVisible();

    await page.getByRole("link", { name: String(order.number), exact: true }).click();
    await expectPath(page, `/admin/narudzbe/${order.id}`);
    await expect(page.getByRole("heading", { name: `Narudžba br. ${order.number}` })).toBeVisible();
    await expect(page.getByText("Lično preuzimanje")).toBeVisible();
    await expect(page.getByText("rezervisano 2")).toBeVisible();
  });

  test("a pickup order goes from new to completed", async ({ page }) => {
    const order = await seedOrder();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openOrder(page, order.id);

    // Bank transfer: picking waits for the money.
    await act(page, "Potvrdi narudžbu", "Narudžba je potvrđena, račun je izdat.");
    await expect(page.getByRole("button", { name: "Pošalji u pripremu" })).toBeDisabled();
    await expect(page.getByRole("link", { name: /^Račun / })).toBeVisible();

    await page.getByRole("button", { name: "Evidentiraj uplatu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Evidentiraj uplatu" }).click();
    await expect(page.getByText("Uplata je evidentirana.")).toBeVisible();

    await act(page, "Pošalji u pripremu", "Narudžba je poslata u pripremu.");
    await expect(page.getByText("spakovano 0")).toBeVisible();

    await pickAll(order);
    await page.reload();
    await page.getByRole("button", { name: "Predaj kupcu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Predaj kupcu" }).click();
    await expect(page.getByText("Narudžba je predata kupcu.")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Otpremnica / })).toBeVisible();
    // A warranty card lists serial numbers; these headphones are not serial-tracked.
    await expect(page.getByRole("link", { name: /^Garantni list / })).toHaveCount(0);

    await act(page, "Završi narudžbu", "Narudžba je završena.");
    await expect(page.getByText("Završena", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Otkaži" })).toHaveCount(0);

    // The invoice PDF opens through the proxy.
    const href = await page.getByRole("link", { name: /^Račun / }).getAttribute("href");
    const pdf = await page.request.get(href!);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("cancelling needs a reason and voids the invoice", async ({ page }) => {
    const order = await seedOrder();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await openOrder(page, order.id);
    await act(page, "Potvrdi narudžbu", "Narudžba je potvrđena, račun je izdat.");

    await page.getByRole("button", { name: "Otkaži" }).click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: "Otkaži narudžbu" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Razlog otkazivanja").fill("Kupac je odustao telefonom");
    await confirm.click();

    await expect(page.getByText("Narudžba je otkazana.")).toBeVisible();
    await expect(page.getByText("Razlog otkazivanja: Kupac je odustao telefonom")).toBeVisible();
    await expect(page.getByText("STORNIRANO")).toBeVisible();
    await expect(page.getByText("rezervisano 2")).toHaveCount(0);
  });

  test("an accountant can record payment but not confirm or cancel", async ({ page }) => {
    const order = await seedOrder();
    const accountant = await createUser("ACCOUNTANT");
    await login(page, accountant.email, accountant.password);
    await expectPath(page, "/admin");
    await openOrder(page, order.id);

    await expect(page.getByRole("button", { name: "Evidentiraj uplatu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Potvrdi narudžbu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Otkaži" })).toHaveCount(0);
  });

  test("an unknown order is a 404 page", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    const res = await page.goto("/admin/narudzbe/00000000-0000-4000-8000-000000000000");
    expect(res?.status()).toBe(404);
    const bad = await page.goto("/admin/narudzbe/nije-uuid");
    expect(bad?.status()).toBe(404);
  });
});
