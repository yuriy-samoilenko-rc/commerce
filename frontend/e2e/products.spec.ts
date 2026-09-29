import { expect, test } from "@playwright/test";
import { ADMIN, adminToken, API, apiAsAdmin, createUser, expectPath, login, seedCatalog, seedProduct } from "./helpers";

test.describe("products in the back office", () => {
  test("an admin creates, edits, archives and restores a product", async ({ page }) => {
    const { category, brand, run } = await seedCatalog();
    const sku = `TV-${run}`;
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");

    await page.goto("/admin/proizvodi");
    await page.getByRole("link", { name: "Novi proizvod" }).click();
    await expectPath(page, "/admin/proizvodi/novi");

    // Required fields and local number format are checked before anything is sent.
    await page.getByRole("button", { name: "Kreiraj proizvod" }).click();
    await expect(page.getByText("Unesite naziv.")).toBeVisible();
    await expect(page.getByText("Izaberite kategoriju.")).toBeVisible();

    await page.getByLabel("Naziv", { exact: true }).fill(`Televizor Samsung 55" ${run}`);
    await page.getByLabel("Šifra (SKU)").fill(sku);
    await page.getByLabel("Kategorija").selectOption(category.id);
    await page.getByLabel("Brend").selectOption(brand.id);
    await page.getByLabel("Nabavna cijena").fill("450");
    await page.getByLabel("Prodajna cijena").fill("1.299,90");
    await page.getByLabel("Akcijska cijena").fill("1.400");
    await page.getByLabel("Garancija (mjeseci)").fill("24");
    await page.getByRole("button", { name: "Dodaj karakteristiku" }).click();
    await page.getByLabel("Naziv karakteristike 1").fill("Dijagonala");
    await page.getByLabel("Vrijednost karakteristike 1").fill("55 inča");

    await page.getByRole("button", { name: "Kreiraj proizvod" }).click();
    await expect(page.getByText("Akcijska cijena mora biti niža od prodajne.")).toBeVisible();
    await page.getByLabel("Akcijska cijena").fill("1.199,00");
    await page.getByRole("button", { name: "Kreiraj proizvod" }).click();

    await expect(page.getByRole("heading", { name: `Televizor Samsung 55" ${run}` })).toBeVisible();
    await expect(page.getByText("1.299,90 €")).toBeVisible();
    await expect(page.getByText("1.199,00 €")).toBeVisible();
    await expect(page.getByText("55 inča")).toBeVisible();
    await expect(page.getByText("24 mj.")).toBeVisible();
    // 1.199 / 1,21 = 990,91 net; (990,91 − 450) / 990,91 = 54,6 %
    await expect(page.getByText("54,6%")).toBeVisible();
    await expect(page.getByText("Proizvoda nema ni na jednom skladištu.")).toBeVisible();

    await page.getByRole("link", { name: "Izmijeni" }).click();
    await expect(page.getByLabel("Prodajna cijena")).toHaveValue("1299,90");
    await page.getByLabel("Akcijska cijena").fill("");
    await page.getByLabel("Prodajna cijena").fill("1249");
    await page.getByRole("button", { name: "Sačuvaj izmjene" }).click();
    await expect(page.getByText("Izmjene su sačuvane.")).toBeVisible();
    await expect(page.getByText("1.249,00 €")).toBeVisible();
    await expect(page.getByText("Akcijska", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Arhiviraj" }).click();
    await expect(page.getByText("Arhiviran", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Vrati u prodaju" }).click();
    await expect(page.getByRole("button", { name: "Arhiviraj" })).toBeVisible();
  });

  test("a duplicate SKU is pointed out on its field", async ({ page }) => {
    const { product } = await seedProduct(1);
    const { category } = await seedCatalog();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/proizvodi/novi");

    await page.getByLabel("Naziv", { exact: true }).fill("Duplikat");
    await page.getByLabel("Šifra (SKU)").fill(product.sku);
    await page.getByLabel("Kategorija").selectOption(category.id);
    await page.getByLabel("Nabavna cijena").fill("1");
    await page.getByLabel("Prodajna cijena").fill("2");
    await page.getByRole("button", { name: "Kreiraj proizvod" }).click();
    await expect(page.getByText("Proizvod sa ovom šifrom već postoji.")).toBeVisible();
    await expectPath(page, "/admin/proizvodi/novi");
  });

  test("serial tracking is locked while the product has stock", async ({ page }) => {
    const { product } = await seedProduct(3);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(`/admin/proizvodi/${product.id}/uredi`);
    await expect(page.getByLabel(/Praćenje po serijskom broju/)).toBeDisabled();
    await expect(page.getByText("Ne može se mijenjati dok proizvod ima zalihu.")).toBeVisible();

    // The backend refuses it too, whoever asks.
    const res = await apiAsAdmin("PATCH", `/admin/products/${product.id}`, { trackSerial: true });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("SERIAL_MODE_LOCKED");
  });

  test("the list searches by SKU and shows stock per product", async ({ page }) => {
    const { product } = await seedProduct(4);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("link", { name: "Proizvodi" }).first().click();
    await page.getByLabel("Pretraga").fill(product.sku);
    await page.getByRole("button", { name: "Primijeni" }).click();
    await expect(page.getByText("Ukupno: 1")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(product.name) });
    await expect(row).toContainText("49,90 €");
    await expect(row).toContainText("4");

    await row.getByRole("link", { name: product.name }).click();
    await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    await expect(page.getByRole("row", { name: /^E2E skladište/ })).toContainText("4");
    await expect(page.getByText("Prijem").first()).toBeVisible();
  });

  test("wide tables scroll inside their card on a phone, not the whole page", async ({ browser }) => {
    const { product } = await seedProduct(2);
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "sr-Latn-ME" });
    const page = await phone.newPage();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    for (const path of [`/admin/proizvodi/${product.id}`, "/admin/proizvodi", "/admin/narudzbe", "/admin/narudzbe/nova"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await phone.close();
  });

  test("a manager sees the catalog but neither edits it nor sees purchase prices", async ({ page }) => {
    const { product } = await seedProduct(1);
    const manager = await createUser("MANAGER");
    await login(page, manager.email, manager.password);
    await expectPath(page, "/admin");

    await page.goto("/admin/proizvodi");
    await expect(page.getByRole("link", { name: "Novi proizvod" })).toHaveCount(0);
    await page.goto(`/admin/proizvodi/${product.id}`);
    await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Izmijeni" })).toHaveCount(0);
    await expect(page.getByText("Nabavna")).toHaveCount(0);
    await page.goto(`/admin/proizvodi/${product.id}/uredi`);
    await expect(page.getByText("Katalog uređuje administrator.")).toBeVisible();
  });
});

// Two tiny valid PNGs (40×30, red and blue) and a text file posing as a PNG.
const RED = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVRIie3VwQkAMAwDse50+4/iXTpG+xDkHwiOdVZP5licU0+48k4pkKnMIBEWw2JYHBbDYljcVyxeF8rqXGR1GogAAAAASUVORK5CYII=",
  "base64",
);
const BLUE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAPUlEQVRIie3VQQ0AMAwCwHnCE2oRNRnb45L+mzSUO+mezLG4Th3hmneqAonKHCSKxWGxWAwWh8ViMV+xeAFhNonLul/1dAAAAABJRU5ErkJggg==",
  "base64",
);
const png = (name: string, buffer: Buffer) => ({ name, mimeType: "image/png", buffer });

test.describe("product photos", () => {
  test("an admin uploads, orders, describes and deletes photos", async ({ page }) => {
    const { product } = await seedProduct(1);
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.goto(`/admin/proizvodi/${product.id}`);
    const photos = page.getByRole("list", { name: "Slike proizvoda" });
    await expect(page.getByText("Proizvod još nema slika.", { exact: false })).toBeVisible();

    // The API decodes every file: a renamed text file is refused, and nothing is stored.
    await page.getByLabel("Izaberite slike").setInputFiles([
      png("crvena.png", RED),
      { name: "lazna.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
    ]);
    await expect(page.getByText("„lazna.png“ nije slika u formatu JPEG, PNG ili WebP.")).toBeVisible();
    await expect(page.getByText("0 od 10", { exact: false })).toBeVisible();

    await page.getByLabel("Izaberite slike").setInputFiles([png("crvena.png", RED), png("plava.png", BLUE)]);
    await expect(page.getByText("Dodato je 2 slika.")).toBeVisible();
    await expect(photos.getByRole("listitem")).toHaveCount(2);
    await expect(photos.getByRole("listitem").first().getByText("Glavna")).toBeVisible();
    const first = await photos.getByRole("img").first().getAttribute("src");
    expect(first).toMatch(/^\/media\/products\/.+-400\.webp$/);
    // Served from our own origin through the media route, as WebP.
    const served = await page.request.get(first!);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/webp");

    // The second photo becomes the main one.
    await photos.getByRole("listitem").nth(1).getByRole("button", { name: "Postavi kao glavnu" }).click();
    await expect(page.getByText("Glavna slika je promijenjena.")).toBeVisible();
    await expect(photos.getByRole("img").first()).not.toHaveAttribute("src", first!);
    await expect(photos.getByRole("img").nth(1)).toHaveAttribute("src", first!);

    await photos.getByRole("listitem").first().getByRole("button", { name: "Opis slike" }).click();
    await page.getByLabel("Opis", { exact: true }).fill("Prednja strana");
    await page.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Opis slike je sačuvan.")).toBeVisible();
    await expect(photos.getByRole("img", { name: "Prednja strana" })).toBeVisible();

    // The list shows the main photo next to the name.
    await page.goto(`/admin/proizvodi?search=${product.sku}`);
    await expect(page.getByRole("row", { name: new RegExp(product.sku) }).locator("img")).toHaveAttribute(
      "src",
      /-400\.webp$/,
    );

    await page.goto(`/admin/proizvodi/${product.id}`);
    await photos.getByRole("listitem").first().getByRole("button", { name: "Obriši sliku" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Obriši sliku" }).click();
    await expect(page.getByText("Slika je obrisana.")).toBeVisible();
    await expect(photos.getByRole("listitem")).toHaveCount(1);
    await expect(photos.getByRole("img").first()).toHaveAttribute("src", first!);
    await expect(photos.getByText("Glavna")).toBeVisible();

    // The shop sees the photos too, in the same order.
    const shop = await page.request.get(`${API}/products/${product.id}`);
    const body = (await shop.json()) as { images: { thumbUrl: string }[] };
    expect(body.images.map((i) => i.thumbUrl)).toEqual([first]);
  });

  test("other staff see the photos but cannot change them", async ({ page }) => {
    const { product } = await seedProduct(1);
    const token = await adminToken();
    const form = new FormData();
    form.append("files", new Blob([RED], { type: "image/png" }), "crvena.png");
    const upload = await fetch(`${API}/admin/products/${product.id}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(upload.status).toBe(201);

    const manager = await createUser("MANAGER");
    await login(page, manager.email, manager.password);
    await expectPath(page, "/admin");
    await page.goto(`/admin/proizvodi/${product.id}`);
    await expect(page.getByRole("list", { name: "Slike proizvoda" }).getByRole("img")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Dodaj slike" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Obriši sliku" })).toHaveCount(0);

    const images = (await (await fetch(`${API}/admin/products/${product.id}/images`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()) as { id: string }[];
    const managerToken = (await (await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: manager.email, password: manager.password }),
    })).json()) as { accessToken: string };
    const denied = await fetch(`${API}/admin/products/${product.id}/images/${images[0].id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${managerToken.accessToken}` },
    });
    expect(denied.status).toBe(403);
  });
});
