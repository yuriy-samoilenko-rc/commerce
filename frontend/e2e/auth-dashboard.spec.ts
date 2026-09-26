import { expect, test } from "@playwright/test";
import { ADMIN, createUser, expectPath, login } from "./helpers";

test.describe("login and the admin dashboard", () => {
  test("a guest is sent to the login page and comes back after logging in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/prijava\?next=%2Fadmin$/);

    await login(page, ADMIN.email, "pogresna-lozinka");
    // Next.js has its own (empty) route announcer with role=alert; look inside the form.
    await expect(page.locator("form").getByRole("alert")).toHaveText("Pogrešan email ili lozinka.");

    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await expect(page.getByRole("heading", { name: "Kontrolna tabla" })).toBeVisible();
    await expect(page.getByText("Prodaja danas")).toBeVisible();
    await expect(page.getByText("Prodaja u posljednjih 30 dana")).toBeVisible();
  });

  test("the token lives in an httpOnly cookie that page scripts cannot read", async ({ page, context }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    const session = (await context.cookies()).find((c) => c.name === "ts_session");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("ts_session");
  });

  test("notification bell and logout", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.getByRole("button", { name: /^Obavještenja/ }).click();
    await expect(page.getByRole("menu").getByText("Obavještenja", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Administrator/ }).click();
    await page.getByRole("menuitem", { name: "Odjava" }).click();
    await expectPath(page, "/prijava");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/prijava/);
  });

  test("a customer never reaches the back office", async ({ page }) => {
    const customer = await createUser("CUSTOMER");
    await login(page, customer.email, customer.password);
    await expectPath(page, "/");
    await page.goto("/admin");
    await expectPath(page, "/");
  });

  test("warehouse staff get the back office without financial figures", async ({ page }) => {
    const user = await createUser("WAREHOUSE");
    await login(page, user.email, user.password);
    await expectPath(page, "/admin");
    await expect(page.getByText(/dostupna je administratoru, menadžeru i računovođi/)).toBeVisible();
    await expect(page.getByText("Prodaja danas")).toHaveCount(0);
  });

  test("the API proxy refuses cross-site writes and path tricks", async ({ page, request }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    const cookies = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

    const csrf = await request.post("/api/backend/notifications/read-all", {
      headers: { Origin: "https://evil.example", Cookie: cookies },
    });
    expect(csrf.status()).toBe(403);

    // An encoded ".." is resolved by URL normalisation before routing (the route handler also
    // rejects it); either way the request must not escape the proxy and reach the backend.
    const traversal = await request.get("/api/backend/%2E%2E/auth/me", { headers: { Cookie: cookies } });
    expect([400, 404]).toContain(traversal.status());
    expect(await traversal.text()).not.toContain(ADMIN.email);

    const me = await request.get("/api/backend/auth/me", { headers: { Cookie: cookies } });
    expect((await me.json()).email).toBe(ADMIN.email);
  });

  test("dashboard on a phone", async ({ browser }) => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "sr-Latn-ME" });
    const page = await phone.newPage();
    await login(page, ADMIN.email, ADMIN.password);
    await expectPath(page, "/admin");
    await expect(page.getByText("Prodaja danas")).toBeVisible();
    // The page itself must not scroll sideways; wide tables scroll inside their own box.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // The sidebar is hidden on a phone; the menu opens as a drawer instead.
    await page.getByRole("button", { name: "Otvori meni" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("link", { name: "Kontrolna tabla" })).toBeVisible();
    await drawer.getByRole("link", { name: "Kontrolna tabla" }).click();
    await expect(drawer).toBeHidden();
    await phone.close();
  });
});
