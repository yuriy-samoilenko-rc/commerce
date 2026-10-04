import { expect, test } from "@playwright/test";
import { ADMIN, expectPath, login } from "./helpers";

test.describe("employees", () => {
  test("the admin adds a storekeeper, resets the password and deactivates the account", async ({ page, browser }) => {
    const email = `magacin.${Date.now()}@techstore.test`;
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Zaposleni" }).click();
    await expect(page.getByRole("heading", { name: "Zaposleni", level: 1 })).toBeVisible();
    // Customers are not employees.
    await expect(page.getByRole("cell", { name: "Kupac", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Novi zaposleni" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Ime i prezime").fill("Marko Vuković");
    await dialog.getByLabel("E-pošta").fill(email);
    await dialog.getByLabel("Uloga").selectOption("WAREHOUSE");
    await dialog.getByLabel("Lozinka").fill("magacin123");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Zaposleni je dodat.")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(email.replace(/\./g, "\\.")) });
    await expect(row).toContainText("Magacioner");
    await expect(row).toContainText("nikad");

    // The same e-mail twice is refused in words.
    await page.getByRole("button", { name: "Novi zaposleni" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Ime i prezime").fill("Duplikat");
    await dialog.getByLabel("E-pošta").fill(email);
    await dialog.getByLabel("Lozinka").fill("magacin123");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(dialog.getByText("Nalog sa ovom e-poštom već postoji.")).toBeVisible();
    await dialog.getByRole("button", { name: "Nazad" }).click();

    // The storekeeper signs in; a new password from the admin ends that session.
    const other = await browser.newContext();
    const storekeeper = await other.newPage();
    await login(storekeeper, email, "magacin123");
    await expectPath(storekeeper, "/admin");

    await row.getByRole("button", { name: "Izmijeni" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nova lozinka").fill("novaLozinka9");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Izmjene su sačuvane.")).toBeVisible();
    await storekeeper.reload();
    await expect(storekeeper).toHaveURL(/\/prijava/);
    await login(storekeeper, email, "novaLozinka9");
    await expectPath(storekeeper, "/admin");

    // Deactivated: out at once, and cannot sign in again.
    await row.getByRole("button", { name: "Izmijeni" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Aktivan nalog").uncheck();
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(row).toContainText("Deaktiviran");
    await storekeeper.reload();
    await expect(storekeeper).toHaveURL(/\/prijava/);
    await other.close();
  });

  test("the admin cannot lock their own account", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/zaposleni");
    const row = page.getByRole("row", { name: /\(vi\)/ });
    await row.getByRole("button", { name: "Izmijeni" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Uloga")).toBeDisabled();
    await expect(dialog.getByLabel("Aktivan nalog")).toBeDisabled();
    await expect(dialog.getByText("Svoju ulogu i status ne možete mijenjati.")).toBeVisible();
  });
});
