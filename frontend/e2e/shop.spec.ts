import { expect, test } from "@playwright/test";
import { ADMIN, API, apiAsAdmin, createUser, expectPath, login, seedProduct, receivedOrder, shopLogin } from "./helpers";

test.describe("online shop", () => {
  test("a guest fills the cart, keeps a wishlist and compares products", async ({ page }) => {
    const a = await seedProduct(3);
    const b = await seedProduct(3);

    await page.goto(`/proizvod/${a.product.id}`);
    await expect(page.getByRole("heading", { level: 1, name: a.product.name })).toBeVisible();
    await expect(page.getByText("Na stanju").first()).toBeVisible();

    await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    const mini = page.getByRole("dialog");
    await expect(mini.getByText("Dodato u korpu")).toBeVisible();
    await expect(mini.getByText(a.product.name)).toBeVisible();
    await mini.getByRole("button", { name: "Nastavi kupovinu" }).click();
    await expect(page.getByRole("link", { name: "Korpa, 1 kom." })).toBeVisible();

    await page.getByRole("button", { name: "Dodaj na listu želja" }).click();
    await expect(page.getByRole("link", { name: "Lista želja, 1" })).toBeVisible();
    await page.getByRole("button", { name: "Uporedi", exact: true }).click();

    await page.goto(`/proizvod/${b.product.id}`);
    await page.getByRole("button", { name: "Uporedi", exact: true }).click();
    await page.goto("/uporedi");
    const table = page.getByRole("table", { name: "Poređenje proizvoda" });
    await expect(table.getByRole("link", { name: a.product.name })).toBeVisible();
    await expect(table.getByRole("link", { name: b.product.name })).toBeVisible();

    // The guest's wishlist lives in the browser.
    await page.goto("/lista-zelja");
    await expect(page.getByRole("link", { name: a.product.name }).first()).toBeVisible();

    await page.goto("/korpa");
    const line = page.getByRole("region", { name: "Proizvodi u korpi" });
    await expect(line.getByRole("link", { name: a.product.name }).last()).toBeVisible();
    await line.getByRole("button", { name: "Više" }).click();
    await expect(line.getByText("99,80 €")).toBeVisible();
    await expect(page.getByRole("button", { name: "Potvrdi narudžbu" })).toBeDisabled();
  });

  test("a guest registers at checkout and orders for pickup", async ({ page }) => {
    const { product, warehouse } = await seedProduct(3);
    await apiAsAdmin("PATCH", `/warehouses/${warehouse.id}`, {
      isPickupPoint: true,
      address: "Njegoševa 1, 81000 Podgorica",
      openingHours: "Pon–Sub 09–20",
    });
    const email = `e2e.kupac.${Date.now()}@example.me`;

    await page.goto(`/proizvod/${product.id}`);
    await page.getByRole("button", { name: "Dodaj na listu želja" }).click();
    await page.getByRole("button", { name: "Dodaj u korpu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Idi u korpu" }).click();
    await expectPath(page, "/korpa");

    await page.getByRole("tab", { name: "Novi nalog" }).click();
    await page.getByLabel("Ime i prezime").fill("Marko Petrović");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Lozinka", { exact: true }).fill("lozinka123");
    await page.getByRole("button", { name: "Napravi nalog" }).click();

    // Logged in: the form now asks for the order details, the name is already there.
    await expect(page.getByLabel("Ime i prezime")).toHaveValue("Marko Petrović");
    await page.getByLabel("Telefon", { exact: true }).fill("+382 67 123 456");
    await page.getByRole("radio", { name: /Preuzimanje u prodavnici/ }).check();
    const store = page.getByLabel("Prodavnica");
    if (await store.isVisible()) await store.selectOption(warehouse.id);
    await expect(page.getByRole("complementary", { name: "Pregled narudžbe" }).getByText("Besplatno")).toBeVisible();
    await page.getByRole("button", { name: "Potvrdi narudžbu" }).click();

    await expect(page.getByText("Hvala na narudžbi!")).toBeVisible();
    await expect(page).toHaveURL(/\/nalog\/narudzbe\/[0-9a-f-]+\?nova=1$/);
    await expect(page.getByRole("heading", { name: /Narudžba br\. \d+/ })).toBeVisible();
    await expect(page.getByRole("main").getByText(warehouse.name, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Korpa, 0 kom." })).toBeVisible();

    // The heart given as a guest came along into the account.
    await page.goto("/nalog/lista-zelja");
    await expect(page.getByRole("link", { name: product.name }).first()).toBeVisible();

    // The customer can still cancel a new order.
    await page.goto("/nalog/narudzbe");
    await page.getByRole("link", { name: /Narudžba br\./ }).first().click();
    await page.getByRole("button", { name: "Otkaži narudžbu" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Otkaži narudžbu" }).click();
    await expect(page.getByText("Narudžba je otkazana.").first()).toBeVisible();
  });

  test("courier delivery becomes free from the threshold", async ({ page }) => {
    const { product } = await seedProduct(5);
    const customer = await createUser("CUSTOMER");
    await apiAsAdmin("PATCH", "/admin/settings/company", { courierFee: 10, freeShippingFrom: 100 });
    try {
      await shopLogin(page, customer.email, customer.password);
      await page.goto(`/proizvod/${product.id}`);
      await page.getByRole("button", { name: "Dodaj u korpu" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Idi u korpu" }).click();

      await page.getByRole("radio", { name: /Dostava na adresu/ }).check();
      const summary = page.getByRole("complementary", { name: "Pregled narudžbe" });
      await expect(summary.getByText("Još 50,10 € do besplatne dostave")).toBeVisible();
      await expect(summary.getByText("59,90 €")).toBeVisible();

      await page.getByRole("region", { name: "Proizvodi u korpi" }).getByRole("button", { name: "Više" }).click();
      await page.getByRole("region", { name: "Proizvodi u korpi" }).getByRole("button", { name: "Više" }).click();
      await expect(summary.getByText("Ostvarili ste besplatnu dostavu")).toBeVisible();
      await expect(summary.getByText("149,70 €")).toHaveCount(2);

      await page.getByLabel("Telefon", { exact: true }).fill("+382 68 555 444");
      await page.getByLabel("Adresa").fill("Bulevar Svetog Petra Cetinjskog 1");
      await page.getByLabel("Grad").fill("Podgorica");
      await page.getByRole("button", { name: "Potvrdi narudžbu" }).click();
      await expect(page.getByText("Hvala na narudžbi!")).toBeVisible();
      // The server charged no delivery either.
      await expect(page.getByText("Besplatno", { exact: true })).toBeVisible();
      await expect(page.getByText("Bulevar Svetog Petra Cetinjskog 1, Podgorica")).toBeVisible();
    } finally {
      await apiAsAdmin("PATCH", "/admin/settings/company", { freeShippingFrom: null });
    }
  });

  test("a sale shows its end, and the catalog filters sales", async ({ page }) => {
    const { product } = await seedProduct(2);
    const ends = new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString();
    const res = await apiAsAdmin("PATCH", `/admin/products/${product.id}`, { discountPrice: 39.9, discountEndsAt: ends });
    expect(res.status).toBe(200);
    // An end in the past is refused.
    const past = await apiAsAdmin("PATCH", `/admin/products/${product.id}`, { discountEndsAt: "2020-01-01T00:00:00.000Z" });
    expect(past.body?.code).toBe("SALE_END_PAST");

    await page.goto(`/katalog?akcija=1&q=${encodeURIComponent(product.name)}`);
    await expect(page.getByRole("link", { name: product.name })).toBeVisible();
    await expect(page.getByText("−20%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ukloni filter Samo akcije" })).toBeVisible();

    await page.goto(`/proizvod/${product.id}`);
    await expect(page.getByText("Ušteda 10,00 €")).toBeVisible();
    await expect(page.getByRole("timer")).toContainText("Akcijska cijena važi još 2 d");
  });

  test("a customer reviews a received product and the administrator publishes it", async ({ page, browser }) => {
    const customer = await createUser("CUSTOMER");
    const { product } = await receivedOrder(customer);

    // Only buyers can write: a guest request is refused.
    const guest = await fetch(`${API}/products/${product.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, text: "Nisam kupio, ali pišem." }),
    });
    expect(guest.status).toBe(401);

    await shopLogin(page, customer.email, customer.password);
    await page.goto(`/proizvod/${product.id}`);
    await page.getByRole("button", { name: "Napišite ocjenu" }).click();
    await page.getByRole("button", { name: "4 od 5" }).click();
    await page.getByLabel("Naslov (nije obavezno)").fill("Dobra kupovina");
    await page.getByLabel("Vaše iskustvo").fill("Radi odlično već dvije sedmice, preuzimanje je bilo brzo.");
    await page.getByRole("button", { name: "Pošalji ocjenu" }).click();
    await expect(page.getByText("Hvala! Vaša ocjena će biti objavljena nakon provjere.")).toBeVisible();

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, ADMIN.email, ADMIN.password);
    await expectPath(admin, "/admin");
    await admin.goto("/admin/ocjene");
    const card = admin.getByRole("article").filter({ hasText: product.name });
    await expect(card.getByText("Dobra kupovina")).toBeVisible();
    await card.getByRole("button", { name: "Objavi" }).click();
    await expect(admin.getByText("Ocjena je objavljena.")).toBeVisible();
    await adminContext.close();

    await page.reload();
    const reviews = page.getByRole("region", { name: "Ocjene kupaca" });
    await expect(reviews.getByText("Radi odlično već dvije sedmice")).toBeVisible();
    await expect(reviews.getByText("Potvrđena kupovina")).toBeVisible();
    await expect(reviews.getByText("Hvala, vaša ocjena je objavljena.")).toBeVisible();
    await expect(page.getByRole("link", { name: /1 ocjena/ })).toBeVisible();
  });

  test("a customer updates the profile and sees orders in the account", async ({ page }) => {
    const customer = await createUser("CUSTOMER");
    await receivedOrder(customer);
    await shopLogin(page, customer.email, customer.password);

    await expect(page.getByRole("heading", { name: /Zdravo/ })).toBeVisible();
    await page.getByRole("link", { name: "Moje narudžbe" }).first().click();
    await expect(page.getByText("Preuzeta").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Račun/ }).first()).toBeVisible();

    await page.getByRole("link", { name: "Lični podaci i adresa" }).click();
    await page.getByLabel("Telefon", { exact: true }).fill("+382 69 000 111");
    await page.getByLabel("Adresa za dostavu").fill("Slobode 5, 81000 Podgorica");
    await page.getByRole("button", { name: "Sačuvaj izmjene" }).click();
    await expect(page.getByText("Podaci su sačuvani.")).toBeVisible();

    await page.getByLabel("Trenutna lozinka").fill("pogresna-lozinka");
    await page.getByLabel("Nova lozinka", { exact: true }).fill("novalozinka1");
    await page.getByLabel("Ponovite novu lozinku").fill("novalozinka1");
    await page.getByRole("button", { name: "Promijeni lozinku" }).click();
    await expect(page.getByText("Trenutna lozinka nije ispravna.")).toBeVisible();

    await page.getByRole("button", { name: "Odjava" }).click();
    await expectPath(page, "/");
    await expect(page.getByRole("link", { name: "Prijava" }).first()).toBeVisible();
  });
});
