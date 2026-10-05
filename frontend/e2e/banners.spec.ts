import { expect, test } from "@playwright/test";
import { ADMIN, API, apiAsAdmin, createUser, expectPath, login } from "./helpers";

// A 40×30 red PNG.
const RED = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAIAAADRv8uKAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAO0lEQVRIie3VwQkAMAwDse50+4/iXTpG+xDkHwiOdVZP5licU0+48k4pkKnMIBEWw2JYHBbDYljcVyxeF8rqXGR1GogAAAAASUVORK5CYII=",
  "base64",
);

test.describe("home page banners", () => {
  test.beforeEach(async () => {
    // Banners are global; only this file makes them, so it starts from none.
    const { body } = await apiAsAdmin("GET", "/admin/banners");
    for (const b of body as unknown as { id: string }[]) await apiAsAdmin("DELETE", `/admin/banners/${b.id}`);
  });

  test("an admin publishes a banner with a picture and it leads the shop slider", async ({ page }) => {
    const title = `Jesenja rasprodaja ${Date.now()}`;
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await page.getByRole("navigation", { name: "Glavni meni" }).getByRole("link", { name: "Baneri" }).click();
    await expect(page.getByText("Još nema banera.")).toBeVisible();

    await page.getByRole("button", { name: "Novi baner" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Naslov", { exact: true }).fill(title);
    await dialog.getByLabel("Tekst ispod naslova").fill("Do −30% na televizore i laptopove.");
    await dialog.getByLabel("Oznaka iznad naslova").fill("AKCIJA");
    await dialog.getByLabel("Tekst dugmeta").fill("Pogledaj akcije");
    await dialog.getByLabel("Link", { exact: true }).fill("//evil.example");
    await dialog.getByText("Plava", { exact: true }).click();
    await dialog.getByLabel("Slika", { exact: true }).setInputFiles({ name: "baner.png", mimeType: "image/png", buffer: RED });
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(dialog.getByText("Link je putanja u prodavnici")).toBeVisible();
    await dialog.getByLabel("Link", { exact: true }).fill("/katalog?akcija=1");
    await dialog.getByRole("button", { name: "Sačuvaj" }).click();
    await expect(page.getByText("Baner je dodat.")).toBeVisible();

    const item = page.getByRole("listitem", { name: title });
    await expect(item.getByText("Prikazuje se")).toBeVisible();
    await expect(item.getByText("/katalog?akcija=1 · bez roka")).toBeVisible();

    // A second one shown only from tomorrow: scheduled, not in the shop yet.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    await apiAsAdmin("POST", "/admin/banners", { title: "Sutrašnja ponuda", link: "/katalog", startsAt: tomorrow });
    await page.reload();
    await expect(page.getByRole("listitem", { name: "Sutrašnja ponuda" }).getByText("Zakazan")).toBeVisible();

    // Moving it up changes the order.
    await page.getByRole("button", { name: "Pomjeri „Sutrašnja ponuda“ gore" }).click();
    await expect(page.getByRole("list", { name: "Redoslijed banera" }).getByRole("listitem").first()).toHaveAccessibleName(
      "Sutrašnja ponuda",
    );

    await page.goto("/");
    const slider = page.locator('[aria-roledescription="carousel"]');
    await expect(slider.getByRole("heading", { name: title })).toBeVisible();
    await expect(slider.getByText("Do −30% na televizore i laptopove.")).toBeVisible();
    await expect(slider.getByText("Sutrašnja ponuda")).toHaveCount(0);
    // Only one live banner: no slider controls.
    await expect(slider.getByRole("button", { name: "Sljedeća ponuda" })).toHaveCount(0);
    const picture = slider.locator("img");
    await expect(picture).toHaveAttribute("src", /^\/media\/banners\/.+\.webp$/);
    expect((await page.request.get((await picture.getAttribute("src")) as string)).headers()["content-type"]).toContain("webp");
    await slider.getByRole("link", { name: "Pogledaj akcije" }).click();
    await expect(page).toHaveURL(/\/katalog\?akcija=1$/);
  });

  test("switched off or expired banners leave the shop; the warehouse cannot manage them", async ({ page }) => {
    const { body } = await apiAsAdmin("POST", "/admin/banners", { title: "Isključeni baner", link: "/", isActive: false });
    const id = (body as { id: string }).id;
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const refused = await apiAsAdmin("PATCH", `/admin/banners/${id}`, { startsAt: new Date().toISOString(), endsAt: yesterday });
    expect(refused.body?.code).toBe("BANNER_DATES");
    await apiAsAdmin("POST", "/admin/banners", {
      title: "Istekli baner",
      link: "/",
      startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endsAt: yesterday,
    });
    const live = await (await fetch(`${API}/shop/banners`)).json();
    expect(live).toEqual([]);

    const storekeeper = await createUser("WAREHOUSE");
    await login(page, storekeeper.email, storekeeper.password);
    await expectPath(page, "/admin");
    await page.goto("/admin/baneri");
    await expectPath(page, "/admin");
  });
});
