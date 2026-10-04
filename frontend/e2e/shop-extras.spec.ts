import { expect, test } from "@playwright/test";
import { ADMIN, API, expectPath, login, receiveStock, seedProduct, seedReceivingSetup } from "./helpers";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

async function mailTo(to: string) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length) return (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Subject: string; Text: string };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No email to ${to}`);
}

test.describe("shop extras", () => {
  test("search suggests products, categories and brands while typing", async ({ page }) => {
    const { product, run } = await seedProduct(2);
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Pretraga" }).first();
    await search.fill(run);
    const list = page.getByRole("listbox", { name: "Prijedlozi" });
    await expect(list.getByRole("option", { name: new RegExp(product.name) })).toBeVisible();
    await expect(list.getByRole("option", { name: /49,90 €/ })).toBeVisible();

    // Keyboard: the first suggestion, Enter opens the product.
    await search.press("ArrowDown");
    await expect(search).toHaveAttribute("aria-activedescendant", /.+/);
    await search.press("Enter");
    await expect(page).toHaveURL(/\/proizvod\/e2e-slusalice-/);
    await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();

    // Nothing chosen: Enter searches the catalog.
    const again = page.getByRole("combobox", { name: "Pretraga" }).first();
    await again.fill("nepostojeciproizvodxyz");
    await again.press("Enter");
    await expectPath(page, "/katalog");
    await expect(page.getByText("Nema proizvoda koji odgovaraju filterima.")).toBeVisible();
  });

  test("a visitor is told by email when an out-of-stock product arrives", async ({ page, browser }) => {
    const setup = await seedReceivingSetup();
    const email = `cekam.${Date.now()}@example.me`;
    const detail = (await (await fetch(`${API}/products/${setup.product.id}`)).json()) as { slug: string };

    await page.goto(`/proizvod/${detail.slug}`);
    await expect(page.getByText("Proizvod trenutno nije na stanju")).toBeVisible();
    await page.getByLabel("Email za obavještenje").fill(email);
    await page.getByRole("button", { name: "Obavijesti me kada stigne" }).click();
    await expect(page.getByText(`Javićemo vam na ${email}`)).toBeVisible();

    // Purchasing sees who is waiting.
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, ADMIN.email, ADMIN.password);
    await expectPath(admin, "/admin");
    await admin.goto(`/admin/proizvodi/${setup.product.id}`);
    await expect(admin.getByText("Kupaca čeka obavještenje")).toBeVisible();
    await adminContext.close();

    await receiveStock(setup, 2);
    const mail = await mailTo(email);
    expect(mail.Subject).toBe(`„${setup.product.name}“ je ponovo na stanju`);
    expect(mail.Text).toContain(`/proizvod/${detail.slug}`);

    // In stock now: no more sign-ups.
    const res = await fetch(`${API}/products/${setup.product.id}/stock-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(((await res.json()) as { code: string }).code).toBe("PRODUCT_IN_STOCK");
  });
});
