import { expect, test } from "@playwright/test";
import { API, createUser, expectPath, seedProduct } from "./helpers";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

/** The newest email to the address (the mail worker sends within seconds). */
async function latestMail(to: string) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const msg = await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
      return (await msg.json()) as { Subject: string; Text: string };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No email to ${to}`);
}

test.describe("shop basics", () => {
  test("a forgotten password is reset through the emailed link", async ({ page, browser }) => {
    const customer = await createUser("CUSTOMER");

    // A session from before the reset; it must stop working afterwards.
    const old = await browser.newContext();
    const oldPage = await old.newPage();
    await oldPage.goto("/nalog/prijava");
    await oldPage.getByLabel("Email").fill(customer.email);
    await oldPage.getByLabel("Lozinka", { exact: true }).fill(customer.password);
    await oldPage.getByRole("button", { name: "Prijavi se" }).click();
    await expectPath(oldPage, "/nalog");

    await page.goto("/nalog/prijava");
    await page.getByRole("link", { name: "Zaboravili ste lozinku?" }).click();
    await expectPath(page, "/nalog/zaboravljena-lozinka");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByRole("button", { name: "Pošalji link" }).click();
    await expect(page.getByText("poslali smo link za novu lozinku")).toBeVisible();

    const mail = await latestMail(customer.email);
    expect(mail.Subject).toBe("Nova lozinka za vaš nalog");
    const token = /nova-lozinka\?token=([\w-]+)/.exec(mail.Text)?.[1];
    expect(token).toBeTruthy();

    await page.goto(`/nalog/nova-lozinka?token=${token}`);
    await page.getByLabel("Nova lozinka").fill("sasvimnova1");
    await page.getByLabel("Ponovite lozinku").fill("sasvimnova1");
    await page.getByRole("button", { name: "Sačuvaj novu lozinku" }).click();
    await expect(page.getByText("Lozinka je promijenjena.")).toBeVisible();

    // The link works once only.
    await page.goto(`/nalog/nova-lozinka?token=${token}`);
    await page.getByLabel("Nova lozinka").fill("josjednanova1");
    await page.getByLabel("Ponovite lozinku").fill("josjednanova1");
    await page.getByRole("button", { name: "Sačuvaj novu lozinku" }).click();
    await expect(page.getByText("Ovaj link za novu lozinku je već iskorišćen ili je istekao.")).toBeVisible();

    // The old password no longer works, the new one does.
    const wrong = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customer.email, password: customer.password }),
    });
    expect(wrong.status).toBe(401);
    await page.goto("/nalog/prijava");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Lozinka", { exact: true }).fill("sasvimnova1");
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expectPath(page, "/nalog");

    // The session opened before the reset is over.
    await oldPage.goto("/nalog");
    await expectPath(oldPage, "/nalog/prijava");
    await old.close();
  });

  test("an unknown email gets the same answer and no mail", async ({ page }) => {
    const email = `nepostoji.${Date.now()}@example.me`;
    await page.goto("/nalog/zaboravljena-lozinka");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Pošalji link" }).click();
    await expect(page.getByText("poslali smo link za novu lozinku")).toBeVisible();
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    expect(((await res.json()) as { messages: unknown[] }).messages).toHaveLength(0);
  });

  test("products and categories have readable addresses; old ones redirect", async ({ page, request }) => {
    const { product } = await seedProduct(1);
    const detail = await (await fetch(`${API}/products/${product.id}`)).json();
    expect(detail.slug).toMatch(/^e2e-slusalice-\d+$/);

    // The old id address moves to the slug one.
    await page.goto(`/proizvod/${product.id}`);
    await expectPath(page, `/proizvod/${detail.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toMatch(new RegExp(`/proizvod/${detail.slug}$`));

    await page.goto(`/katalog?kategorija=${detail.category.id}`);
    await expectPath(page, `/katalog/${detail.category.slug}`);
    await expect(page.getByRole("link", { name: product.name })).toBeVisible();

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/proizvod/${detail.slug}</loc>`);
    expect(sitemap).toContain(`/katalog/${detail.category.slug}</loc>`);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Sitemap:");
  });

  test("unknown addresses show the shop's 404", async ({ page }) => {
    const res = await page.goto("/ovo-ne-postoji");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Stranica nije pronađena" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Na početnu" })).toBeVisible();

    const missing = await page.goto("/proizvod/nema-ovog-proizvoda");
    expect(missing?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Stranica nije pronađena" })).toBeVisible();
  });

  test("a wrong password keeps the email typed, and the right one signs in", async ({ page }) => {
    const customer = await createUser("CUSTOMER");
    await page.goto("/nalog/prijava");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Lozinka", { exact: true }).fill("pogresna-lozinka");
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /lozink/i })).toBeVisible();
    // Only the password needs typing again.
    await expect(page.getByLabel("Email")).toHaveValue(customer.email);
    await page.getByLabel("Lozinka", { exact: true }).fill(customer.password);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expectPath(page, "/nalog");
  });

  test("legal pages and the cookie notice", async ({ page }) => {
    await page.goto("/");
    const notice = page.getByRole("region", { name: "Obavještenje o kolačićima" });
    await expect(notice).toBeVisible();
    await notice.getByRole("link", { name: "Politici privatnosti" }).click();
    await expect(page.getByRole("heading", { name: "Politika privatnosti" })).toBeVisible();
    await expect(page.getByText("ts_session")).toBeVisible();
    await notice.getByRole("button", { name: "U redu" }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Politika privatnosti" })).toBeVisible();
    await expect(notice).toHaveCount(0);

    await page.getByRole("link", { name: "Uslovi korišćenja" }).click();
    await expect(page.getByRole("heading", { name: "Uslovi korišćenja i kupovine" })).toBeVisible();
    await expect(page.getByText(/odustati u roku od \d+ dana/)).toBeVisible();
  });
});
