import { expect, test } from "@playwright/test";
import { ADMIN, API, apiAsAdmin, createUser, customerToken, expectPath, login, receivedOrder, seedProduct, shopLogin } from "./helpers";

const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

async function mailTo(to: string) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    if (messages.length) return messages[0];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No email to ${to}`);
}

test.describe("shop account and promotions", () => {
  test("a customer asks for a return from the account and can withdraw it", async ({ page }) => {
    const customer = await createUser("CUSTOMER");
    const { product, order } = await receivedOrder(customer);
    await shopLogin(page, customer.email, customer.password);

    await page.goto(`/nalog/narudzbe/${order.id}`);
    await page.getByRole("link", { name: "Vrati proizvod" }).click();
    await expect(page.getByRole("heading", { name: "Povraćaj robe" })).toBeVisible();
    const send = page.getByRole("button", { name: "Pošalji zahtjev za povraćaj" });
    await expect(send).toBeDisabled();
    await page.getByRole("checkbox", { name: new RegExp(product.name) }).check();
    await page.getByLabel("Razlog").selectOption("DEFECTIVE");
    await page.getByLabel("Opišite problem").fill("Ne pali se nakon punjenja.");
    await send.click();

    await expectPath(page, "/nalog/povracaji");
    const card = page.getByRole("article").filter({ hasText: product.name });
    await expect(card.getByText("Zahtjev primljen")).toBeVisible();
    await expect(card.getByText("Proizvod ne radi ispravno")).toBeVisible();
    await card.getByRole("button", { name: "Povuci zahtjev" }).click();
    await expect(card.getByText("Otkazan")).toBeVisible();
  });

  test("a promo code made in the admin lowers the order, once per customer", async ({ page, browser }) => {
    const { product } = await seedProduct(5);
    const code = `E2E${Date.now()}`.slice(0, 20);

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, ADMIN.email, ADMIN.password);
    await expectPath(admin, "/admin");
    await admin.goto("/admin/promo-kodovi");
    await admin.getByRole("button", { name: "Novi promo kod" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Kod", { exact: true }).fill(code.toLowerCase());
    await dialog.getByLabel("Opis (vidi ga kupac)").fill("10% za test");
    await dialog.getByLabel("Vrijednost").fill("10");
    await dialog.getByLabel("Ne važi za proizvode na akciji").uncheck();
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(admin.getByText("Promo kod je napravljen.")).toBeVisible();
    // Stored in capitals, whatever was typed.
    await expect(admin.getByRole("row", { name: new RegExp(code) })).toContainText("Aktivan");

    const customer = await createUser("CUSTOMER");
    await shopLogin(page, customer.email, customer.password);
    const detail = (await (await fetch(`${API}/products/${product.id}`)).json()) as { slug: string };
    await page.goto(`/proizvod/${detail.slug}`);
    await page.getByRole("button", { name: "Više" }).click();
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Idi u korpu" }).click();

    const summary = page.getByRole("complementary", { name: "Pregled narudžbe" });
    await summary.getByLabel("Promo kod").fill("NEPOSTOJI1");
    await summary.getByRole("button", { name: "Primijeni" }).click();
    await expect(summary.getByText("Promo kod „NEPOSTOJI1“ ne postoji ili više ne važi.")).toBeVisible();

    await summary.getByLabel("Promo kod").fill(code);
    await summary.getByRole("button", { name: "Primijeni" }).click();
    await expect(summary.getByText(`Popust (${code})`)).toBeVisible();
    await expect(summary.getByText("−9,98 €")).toBeVisible();
    await expect(summary.getByText("89,82 €")).toBeVisible();

    await page.getByLabel("Telefon", { exact: true }).fill("+382 67 222 333");
    await page.getByRole("radio", { name: /Dostava na adresu/ }).check();
    await page.getByLabel("Adresa").fill("Njegoševa 10");
    await page.getByLabel("Grad").fill("Nikšić");
    await page.getByRole("button", { name: "Potvrdi narudžbu" }).click();
    await expect(page.getByText("Hvala na narudžbi!")).toBeVisible();
    await expect(page.getByText(`od toga popust (${code})`)).toBeVisible();
    // 89,82 € goods + 10,00 € courier (no free-delivery threshold in the test settings)
    await expect(page.getByText("99,82 €")).toBeVisible();

    // Once per customer.
    const token = await customerToken(customer.email, customer.password);
    const again = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        customerName: customer.name,
        customerPhone: "+382 67 222 333",
        deliveryMethod: "PICKUP",
        paymentMethod: "CASH_ON_DELIVERY",
        promoCode: code,
      }),
    });
    expect(((await again.json()) as { code: string }).code).toBe("PROMO_ALREADY_USED");

    // Cancelling the order gives the use back.
    await page.getByRole("button", { name: "Otkaži narudžbu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Otkaži narudžbu" }).click();
    await expect(page.getByText("Narudžba je otkazana.").first()).toBeVisible();
    const list = await apiAsAdmin("GET", "/admin/promo-codes");
    const used = (list.body as unknown as { code: string; usedCount: number }[]).find((p) => p.code === code);
    expect(used?.usedCount).toBe(0);
    await adminContext.close();
  });

  test("customers ask about a product and the shop answers on the page", async ({ page, browser }) => {
    const { product } = await seedProduct(1);
    const detail = (await (await fetch(`${API}/products/${product.id}`)).json()) as { slug: string };

    await page.goto(`/proizvod/${detail.slug}`);
    const qa = page.getByRole("region", { name: "Pitanja i odgovori" });
    await expect(qa.getByText("Još nema pitanja o ovom proizvodu.")).toBeVisible();
    await expect(qa.getByRole("link", { name: "Prijavite se da postavite pitanje" })).toBeVisible();

    const customer = await createUser("CUSTOMER");
    await shopLogin(page, customer.email, customer.password);
    await page.goto(`/proizvod/${detail.slug}`);
    await qa.getByLabel("Vaše pitanje").fill("Da li su slušalice vodootporne?");
    await qa.getByRole("button", { name: "Pošalji pitanje" }).click();
    await expect(qa.getByText("Hvala! Pitanje je poslato")).toBeVisible();

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, ADMIN.email, ADMIN.password);
    await expectPath(admin, "/admin");
    await admin.goto("/admin/pitanja");
    const item = admin.getByRole("article").filter({ hasText: product.name });
    await item.getByLabel("Odgovor").fill("Da, imaju IPX4 zaštitu od prskanja.");
    await item.getByRole("button", { name: "Objavi odgovor" }).click();
    await expect(admin.getByText("Odgovor je objavljen i poslat kupcu.")).toBeVisible();
    await adminContext.close();

    await page.reload();
    await expect(qa.getByText("Da li su slušalice vodootporne?")).toBeVisible();
    await expect(qa.getByText("Da, imaju IPX4 zaštitu od prskanja.")).toBeVisible();
    const mail = await mailTo(customer.email);
    expect(mail.Subject).toBe(`Odgovor na vaše pitanje o „${product.name}“`);
  });
});
