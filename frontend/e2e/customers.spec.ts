import { expect, test } from "@playwright/test";
import { ADMIN, API, apiAsAdmin, createUser, customerToken, expectPath, login, receivedOrder, seedProduct } from "./helpers";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

/** The newest email to the address with this subject (the order emails go to it too). */
async function mailWithSubject(to: string, subject: string) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to} subject:"${subject}"`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      return (await msg.json()) as { Subject: string; Text: string };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No email "${subject}" to ${to}`);
}

test.describe("customers", () => {
  test("a manager opens an account for a phone customer, who sets a password from the email", async ({ page, browser }) => {
    const email = `telefon.${Date.now()}@kupac.me`;
    // An earlier phone order under the same email joins the new account.
    const { product } = await seedProduct(3);
    await apiAsAdmin("POST", "/admin/orders", {
      items: [{ productId: product.id, quantity: 1 }],
      customerName: "Milena Vujović",
      customerPhone: "+382 69 555 444",
      customerEmail: email.toUpperCase(),
      deliveryMethod: "PICKUP",
      paymentMethod: "CASH_ON_DELIVERY",
    });

    const manager = await createUser("MANAGER");
    await login(page, manager.email, manager.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Kupci" }).click();
    await page.getByRole("button", { name: "Novi kupac" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Ime i prezime").fill("Milena Vujović");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Telefon").fill("+382 69 555 444");
    await dialog.getByLabel("Napomena (vidi je samo osoblje)").fill("Zvati poslije 17h.");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Nalog je otvoren i povezan sa 1 ranijih narudžbi.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Milena Vujović", level: 1 })).toBeVisible();
    await expect(page.getByText("Zvati poslije 17h.")).toBeVisible();
    await expect(page.getByText("nikad")).toBeVisible();
    await expect(page.getByRole("row", { name: /Lično preuzimanje/ })).toHaveCount(1);

    // The same email again is refused in words.
    await page.goto("/admin/kupci");
    await page.getByRole("button", { name: "Novi kupac" }).click();
    await page.getByRole("dialog").getByLabel("Ime i prezime").fill("Duplikat");
    await page.getByRole("dialog").getByLabel("Email").fill(email);
    await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByRole("dialog").getByText("Nalog sa ovom email adresom već postoji.")).toBeVisible();

    const mail = await mailWithSubject(email, "Vaš nalog u internet prodavnici");
    expect(mail.Text).toContain("Link važi 7 dana");
    const token = /nova-lozinka\?token=([\w-]+)/.exec(mail.Text)?.[1];
    const shop = await (await browser.newContext()).newPage();
    await shop.goto(`/nalog/nova-lozinka?token=${token}`);
    await shop.getByLabel("Nova lozinka").fill("milena2026");
    await shop.getByLabel("Ponovite lozinku").fill("milena2026");
    await shop.getByRole("button", { name: "Sačuvaj novu lozinku" }).click();
    await expect(shop.getByText("Lozinka je promijenjena.")).toBeVisible();
    await shop.goto("/nalog/prijava");
    await shop.getByLabel("Email").fill(email);
    await shop.getByLabel("Lozinka", { exact: true }).fill("milena2026");
    await shop.getByRole("button", { name: "Prijavi se" }).click();
    await expectPath(shop, "/nalog");
  });

  test("the card adds up what the customer bought and starts an order for them", async ({ page }) => {
    const customer = await createUser("CUSTOMER");
    const { product } = await receivedOrder(customer);

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    // Found by the phone from their order.
    await page.goto(`/admin/kupci?q=${encodeURIComponent(customer.email)}`);
    const row = page.getByRole("row", { name: new RegExp(customer.email) });
    await expect(row).toContainText("+382 67 111 222");
    await expect(row).toContainText("49,90 €");
    await row.getByRole("link", { name: customer.name }).click();

    const tile = (label: string) => page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd");
    await expect(tile("Ukupno potrošeno")).toHaveText("49,90 €");
    await expect(tile("Narudžbi")).toHaveText("1");
    await expect(tile("Prosječna kupovina")).toHaveText("49,90 €");
    await expect(page.getByRole("row", { name: new RegExp(product.name) })).toContainText("49,90 €");

    await page.getByRole("button", { name: "Izmijeni" }).click();
    await page.getByRole("dialog").getByLabel("Napomena (vidi je samo osoblje)").fill("Veleprodajni kupac.");
    await page.getByRole("dialog").getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByRole("main").getByText("Veleprodajni kupac.")).toBeVisible();

    await page.getByRole("link", { name: "Nova narudžba" }).click();
    await expect(page.getByLabel("Ime i prezime")).toHaveValue(customer.name);
    await expect(page.getByLabel("Telefon")).toHaveValue("+382 67 111 222");
    await expect(page.getByRole("button", { name: "Ukloni vezu sa nalogom" })).toBeVisible();
  });

  test("the warehouse has no customer screens", async ({ page }) => {
    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");
    await expect(page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Kupci" })).toHaveCount(0);
    await page.goto("/admin/kupci");
    await expectPath(page, "/admin");
    // customerToken just signs in, whatever the role.
    const token = await customerToken(storekeeper.email, storekeeper.password);
    const refused = await fetch(`${API}/admin/customers`, { headers: { Authorization: `Bearer ${token}` } });
    expect(refused.status).toBe(403);
  });
});
