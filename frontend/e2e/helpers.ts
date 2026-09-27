import { expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:3000";
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@techstore.local",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};

async function backend<T>(path: string, init: RequestInit & { token?: string; json?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.token && { Authorization: `Bearer ${init.token}` }),
    },
    body: init.json ? JSON.stringify(init.json) : undefined,
  });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function adminToken() {
  const { accessToken } = await backend<{ accessToken: string }>("/auth/login", {
    method: "POST",
    json: ADMIN,
  });
  return accessToken;
}

/** A fresh account for the test; staff roles are created by the admin. */
export async function createUser(role: "WAREHOUSE" | "MANAGER" | "ACCOUNTANT" | "CUSTOMER") {
  const email = `e2e.${role.toLowerCase()}.${Date.now()}@example.me`;
  const password = "lozinka123";
  const name = `E2E ${role}`;
  if (role === "CUSTOMER") {
    await backend("/auth/register", { method: "POST", json: { email, password, name } });
  } else {
    await backend("/users", { method: "POST", token: await adminToken(), json: { email, password, name, role } });
  }
  return { email, password, name };
}

/**
 * A product with `stock` units in its own warehouse, created straight through the API,
 * so every test starts from known data.
 */
export async function seedProduct(stock = 5) {
  const token = await adminToken();
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const post = <T>(path: string, json: unknown) => backend<T>(path, { method: "POST", token, json });

  const category = await post<{ id: string }>("/categories", { name: `E2E kategorija ${run}` });
  const product = await post<{ id: string; sku: string; name: string }>("/admin/products", {
    name: `E2E slušalice ${run}`,
    sku: `E2E-${run}`,
    purchasePrice: 20,
    sellingPrice: 49.9,
    categoryId: category.id,
  });
  const warehouse = await post<{ id: string; name: string }>("/warehouses", { name: `E2E skladište ${run}` });
  const supplier = await post<{ id: string }>("/suppliers", { name: `E2E dobavljač ${run}` });
  const receiving = await post<{ id: string }>("/receivings", {
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    items: [{ productId: product.id, quantity: stock, purchasePrice: 20 }],
  });
  await post(`/receivings/${receiving.id}/confirm`, {});
  return { product, warehouse, token, run };
}

/** A product, an empty warehouse and a supplier: everything a receiving needs. */
export async function seedReceivingSetup(opts: { trackSerial?: boolean; warrantyMonths?: number } = {}) {
  const token = await adminToken();
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const post = <T>(path: string, json: unknown) => backend<T>(path, { method: "POST", token, json });
  const category = await post<{ id: string }>("/categories", { name: `E2E prijem ${run}` });
  const product = await post<{ id: string; sku: string; name: string }>("/admin/products", {
    name: `E2E ${opts.trackSerial ? "telefon" : "kabl"} ${run}`,
    sku: `E2R-${run}`,
    purchasePrice: 100,
    sellingPrice: 199,
    trackSerial: opts.trackSerial ?? false,
    warrantyMonths: opts.warrantyMonths,
    categoryId: category.id,
  });
  const warehouse = await post<{ id: string; name: string }>("/warehouses", { name: `E2E magacin ${run}` });
  const supplier = await post<{ id: string; name: string }>("/suppliers", { name: `E2E dobavljač ${run}` });
  return { product, warehouse, supplier, run };
}

/** Takes a seeded order all the way to the customer (confirm, pay, pick, hand over). */
export async function deliverOrder(o: Awaited<ReturnType<typeof seedOrder>>) {
  const post = (path: string, json: unknown = {}) => backend(path, { method: "POST", token: o.token, json });
  await post(`/admin/orders/${o.id}/confirm`);
  await post(`/admin/orders/${o.id}/mark-paid`);
  await post(`/admin/orders/${o.id}/start-picking`);
  await pickAll(o);
  await post(`/admin/orders/${o.id}/ship`);
}

/**
 * A serial-tracked product with a 24-month warranty: two units received, the first one
 * sold and handed over to a customer. Returns both serial numbers.
 */
export async function sellSerialUnit() {
  const s = await seedReceivingSetup({ trackSerial: true, warrantyMonths: 24 });
  const sold = `W-${s.run}-1`;
  const spare = `W-${s.run}-2`;
  await receiveStock(s, 2, [sold, spare]);
  const token = await adminToken();
  const post = <T>(path: string, json: unknown = {}) => backend<T>(path, { method: "POST", token, json });
  const order = await post<{ id: string; number: number }>("/admin/orders", {
    items: [{ productId: s.product.id, quantity: 1 }],
    customerName: `Garancija ${s.run}`,
    customerPhone: "+382 67 555 000",
    deliveryMethod: "PICKUP",
    paymentMethod: "BANK_TRANSFER",
  });
  await post(`/admin/orders/${order.id}/confirm`);
  await post(`/admin/orders/${order.id}/mark-paid`);
  await post(`/admin/orders/${order.id}/start-picking`);
  await post(`/admin/orders/${order.id}/pick`, { code: sold, warehouseId: s.warehouse.id });
  await post(`/admin/orders/${order.id}/complete-picking`);
  await post(`/admin/orders/${order.id}/ship`);
  return { ...s, order, sold, spare };
}

/** A seeded order that the warehouse is picking right now (confirmed, paid, sent to picking). */
export async function orderInPicking() {
  const o = await seedOrder();
  const post = (path: string) => backend(path, { method: "POST", token: o.token, json: {} });
  await post(`/admin/orders/${o.id}/confirm`);
  await post(`/admin/orders/${o.id}/mark-paid`);
  await post(`/admin/orders/${o.id}/start-picking`);
  return o;
}

/** A serial-tracked unit on the shelf and an order picking it (not yet scanned). */
export async function serialOrderInPicking() {
  const s = await seedReceivingSetup({ trackSerial: true, warrantyMonths: 12 });
  const serial = `P-${s.run}-1`;
  await receiveStock(s, 1, [serial]);
  const token = await adminToken();
  const post = <T>(path: string, json: unknown = {}) => backend<T>(path, { method: "POST", token, json });
  const order = await post<{ id: string; number: number }>("/admin/orders", {
    items: [{ productId: s.product.id, quantity: 1 }],
    customerName: `Sklapanje ${s.run}`,
    customerPhone: "+382 67 555 111",
    deliveryMethod: "PICKUP",
    paymentMethod: "CASH_ON_DELIVERY",
  });
  await post(`/admin/orders/${order.id}/confirm`);
  await post(`/admin/orders/${order.id}/start-picking`);
  return { ...s, order, serial };
}

/** One more (empty) warehouse. */
export async function seedWarehouse(name: string) {
  const token = await adminToken();
  return backend<{ id: string; name: string }>("/warehouses", {
    method: "POST",
    token,
    json: { name: `${name} ${Date.now()}${Math.floor(Math.random() * 1000)}` },
  });
}

/** Puts goods of a seeded setup on its warehouse through a confirmed receiving. */
export async function receiveStock(s: Awaited<ReturnType<typeof seedReceivingSetup>>, quantity: number, serials?: string[]) {
  const token = await adminToken();
  const post = <T>(path: string, json: unknown) => backend<T>(path, { method: "POST", token, json });
  const r = await post<{ id: string }>("/receivings", {
    supplierId: s.supplier.id,
    warehouseId: s.warehouse.id,
    items: [{ productId: s.product.id, quantity, purchasePrice: 100, serialNumbers: serials }],
  });
  await post(`/receivings/${r.id}/confirm`, {});
}

/** An empty category and a brand to pick in the product form. */
export async function seedCatalog() {
  const token = await adminToken();
  const run = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const post = <T>(path: string, json: unknown) => backend<T>(path, { method: "POST", token, json });
  const category = await post<{ id: string; name: string }>("/categories", { name: `E2E televizori ${run}` });
  const brand = await post<{ id: string; name: string }>("/brands", { name: `E2E brend ${run}` });
  return { category, brand, run, token };
}

/** Straight API call as admin, for checks the UI deliberately does not offer. */
export async function apiAsAdmin(method: string, path: string, json?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await adminToken()}` },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

/** A seeded product and a phone order for two of it (status NEW). */
export async function seedOrder(
  order: { deliveryMethod?: "PICKUP" | "COURIER"; paymentMethod?: "BANK_TRANSFER" | "CASH_ON_DELIVERY" } = {},
) {
  const { product, warehouse, token, run } = await seedProduct();
  const post = <T>(path: string, json: unknown) => backend<T>(path, { method: "POST", token, json });
  const created = await post<{ id: string; number: number }>("/admin/orders", {
    items: [{ productId: product.id, quantity: 2 }],
    customerName: `Kupac ${run}`,
    customerPhone: "+382 67 123 456",
    deliveryMethod: order.deliveryMethod ?? "PICKUP",
    deliveryAddress: order.deliveryMethod === "COURIER" ? "Bulevar Svetog Petra Cetinjskog 1, Podgorica" : undefined,
    paymentMethod: order.paymentMethod ?? "BANK_TRANSFER",
  });
  return { ...created, product, warehouse, token };
}

/** Warehouse scanning (the mobile screen comes later): pick everything and finish picking. */
export async function pickAll(o: Awaited<ReturnType<typeof seedOrder>>) {
  const post = (path: string, json: unknown) => backend(path, { method: "POST", token: o.token, json });
  await post(`/admin/orders/${o.id}/pick`, { code: o.product.sku, warehouseId: o.warehouse.id, quantity: 2 });
  await post(`/admin/orders/${o.id}/complete-picking`, {});
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/prijava");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Lozinka").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
}

export async function expectPath(page: Page, path: string) {
  await expect(page).toHaveURL((url) => url.pathname === path);
}
