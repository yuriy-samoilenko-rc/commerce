// Online-shop settings for the demo database (after demo-data.mjs and demo-content.mjs):
// pickup points with contacts, the free-delivery threshold, end dates for the current
// sales, and a few reviews by demo customers who received their goods (approved by the
// administrator). Idempotent. With the API running:
//
//   npm run demo:shop

const API = process.env.API_URL ?? 'http://localhost:3000';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(`${method} ${path} → ${res.status}: ${json?.message ?? text}`), { status: res.status, code: json?.code });
  return json;
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).accessToken;

const STORES = {
  'Glavno skladište Podgorica': { phone: '+382 20 234 567', openingHours: 'Pon–Pet 09–20, Sub 09–15' },
  'Prodavnica Budva': { phone: '+382 33 451 220', openingHours: 'Pon–Sub 09–21, Ned 10–14' },
};

const CUSTOMERS = [
  'milica.jovanovic@example.me',
  'nikola.djurovic@example.me',
  'stefan.vujovic@example.me',
  'ivana.kovacevic@example.me',
  'luka.radulovic@example.me',
  'sara.bulatovic@example.me',
];

// Demo reviews, one picked per product by rating.
const REVIEWS = [
  { rating: 5, title: 'Odličan izbor', text: 'Koristim ga svaki dan već nekoliko sedmica i radi besprijekorno. Preuzimanje u prodavnici je bilo brzo, a osoblje ljubazno.' },
  { rating: 5, title: 'Preporuka', text: 'Kvalitet je iznad očekivanja za ovu cijenu. Isporuka je stigla na vrijeme, sve uredno upakovano uz račun i garantni list.' },
  { rating: 4, title: 'Vrlo dobro', text: 'Zadovoljan sam, radi sve što mi treba. Jedina zamjerka je uputstvo, moglo bi biti detaljnije, ali sve se brzo nauči.' },
];

async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  const admin = await login(email, password);

  // Delivery: courier as before, free from 100 €.
  await call('PATCH', '/admin/settings/company', { courierFee: 10, freeShippingFrom: 100 }, admin);

  const warehouses = await call('GET', '/warehouses', undefined, admin);
  let points = 0;
  for (const w of warehouses) {
    const store = STORES[w.name];
    if (!store) continue;
    await call('PATCH', `/warehouses/${w.id}`, { isPickupPoint: true, ...store }, admin);
    points += 1;
  }

  // Sales end within the next days, so the shop shows its countdowns.
  const sale = await call('GET', '/products?onSale=true&limit=50&sort=name', undefined, admin);
  const day = 86_400_000;
  for (const [i, p] of sale.items.entries()) {
    if (p.discountEndsAt) continue;
    const ends = new Date(Date.now() + (3 + (i % 6)) * day);
    ends.setMinutes(0, 0, 0);
    await call('PATCH', `/admin/products/${p.id}`, { discountEndsAt: ends.toISOString() }, admin);
  }

  // Reviews by customers who received their orders.
  let reviews = 0;
  for (const [n, customerEmail] of CUSTOMERS.entries()) {
    const token = await login(customerEmail, DEMO_PASSWORD).catch(() => null);
    if (!token) continue;
    const orders = await call('GET', '/orders?limit=50', undefined, token);
    const received = orders.items.filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status));
    for (const item of received.flatMap((o) => o.items)) {
      const { canReview } = await call('GET', `/products/${item.productId}/reviews/eligibility`, undefined, token);
      if (!canReview) continue;
      const review = await call('POST', `/products/${item.productId}/reviews`, REVIEWS[(n + reviews) % REVIEWS.length], token);
      await call('POST', `/admin/reviews/${review.id}/approve`, undefined, admin);
      reviews += 1;
    }
  }

  console.log(`✓ ${points} pickup points, free delivery from 100 €, ${sale.items.length} sales with an end date, ${reviews} approved reviews`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
