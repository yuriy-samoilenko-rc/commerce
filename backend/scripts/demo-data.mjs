// Demo data for a fresh database: two warehouses, 50 products, staff, customers and a
// realistic mix of receivings, orders in every state, transfers, a return, a warranty
// case and an approved count. Everything goes through the HTTP API, so stock, reservations,
// serial units, documents and the audit trail are exactly what real work would produce.
//
//   npx prisma migrate reset --force && npx prisma db seed   (empty database + admin)
//   npm run start:dev                                        (API on API_URL)
//   npm run demo:data
//
// Staff and customer accounts get the password in DEMO_PASSWORD (default "demo1234").

const API = process.env.API_URL ?? 'http://localhost:3000';
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${json?.message ?? text}`);
  }
  return json;
}
const login = async (email, password) =>
  (await call('POST', '/auth/login', { email, password })).accessToken;

// ---------- catalog ----------

const CATEGORIES = [
  ['Televizori'],
  ['Mobilni telefoni'],
  ['Laptopovi'],
  ['Bijela tehnika'],
  ['Frižideri', 'Bijela tehnika'],
  ['Veš mašine', 'Bijela tehnika'],
  ['Mali kućni aparati'],
  ['Audio'],
  ['Oprema'],
];

const BRANDS = [
  'Samsung', 'LG', 'Sony', 'Philips', 'Apple', 'Xiaomi', 'Lenovo', 'HP', 'Gorenje',
  'Bosch', "De'Longhi", 'Tefal', 'JBL', 'Anker', 'Ugreen', 'Logitech', 'SanDisk',
];

// [sku, name, brand, category, selling €, discount € | null, purchase €, serial?, warranty months, model, attributes]
const PRODUCTS = [
  ['TV-SAM-55DU7172', 'Samsung 55" Crystal UHD 4K televizor', 'Samsung', 'Televizori', 599, 549, 390, true, 24, 'UE55DU7172', { Dijagonala: '55" (139 cm)', Rezolucija: '4K UHD', 'Smart TV': 'Tizen' }],
  ['TV-SAM-65Q60D', 'Samsung 65" QLED 4K televizor', 'Samsung', 'Televizori', 1049, null, 700, true, 24, 'QE65Q60D', { Dijagonala: '65" (163 cm)', Panel: 'QLED' }],
  ['TV-LG-55C4', 'LG 55" OLED evo C4 televizor', 'LG', 'Televizori', 1399, 1299, 950, true, 24, 'OLED55C41', { Dijagonala: '55" (139 cm)', Panel: 'OLED', Osvježavanje: '144 Hz' }],
  ['TV-LG-43UT73', 'LG 43" 4K UHD televizor', 'LG', 'Televizori', 379, null, 245, true, 24, '43UT73003', { Dijagonala: '43" (109 cm)', 'Smart TV': 'webOS' }],
  ['TV-SNY-50X75', 'Sony Bravia 50" 4K Google TV', 'Sony', 'Televizori', 699, null, 460, true, 24, 'KD-50X75WL', { Dijagonala: '50" (126 cm)', 'Smart TV': 'Google TV' }],
  ['TV-PHI-43PUS8', 'Philips 43" Ambilight 4K televizor', 'Philips', 'Televizori', 449, null, 300, true, 24, '43PUS8309', { Dijagonala: '43" (108 cm)', Ambilight: 'trostrani' }],

  ['MOB-APL-IP15-128', 'Apple iPhone 15 128GB crni', 'Apple', 'Mobilni telefoni', 899, null, 640, true, 24, 'MTP03', { Memorija: '128 GB', Ekran: '6,1"' }],
  ['MOB-APL-IP15P-256', 'Apple iPhone 15 Pro 256GB Natural Titanium', 'Apple', 'Mobilni telefoni', 1349, null, 980, true, 24, 'MTV53', { Memorija: '256 GB', Ekran: '6,1"' }],
  ['MOB-SAM-S24-256', 'Samsung Galaxy S24 256GB Onyx Black', 'Samsung', 'Mobilni telefoni', 999, 899, 650, true, 24, 'SM-S921B', { Memorija: '256 GB', RAM: '8 GB' }],
  ['MOB-SAM-A55-128', 'Samsung Galaxy A55 5G 128GB', 'Samsung', 'Mobilni telefoni', 449, null, 300, true, 24, 'SM-A556B', { Memorija: '128 GB', RAM: '8 GB' }],
  ['MOB-SAM-A15-128', 'Samsung Galaxy A15 128GB', 'Samsung', 'Mobilni telefoni', 199, null, 130, true, 24, 'SM-A155F', { Memorija: '128 GB', RAM: '4 GB' }],
  ['MOB-XIA-RN13P-256', 'Xiaomi Redmi Note 13 Pro 256GB', 'Xiaomi', 'Mobilni telefoni', 379, null, 250, true, 24, '23117RA68G', { Memorija: '256 GB', RAM: '8 GB' }],
  ['MOB-XIA-14-512', 'Xiaomi 14 512GB', 'Xiaomi', 'Mobilni telefoni', 999, null, 690, true, 24, '23127PN0CG', { Memorija: '512 GB', RAM: '12 GB' }],

  ['LAP-LEN-IPS3-15', 'Lenovo IdeaPad Slim 3 15" i5 / 16GB / 512GB', 'Lenovo', 'Laptopovi', 649, null, 440, true, 24, '83ER0045SC', { Procesor: 'Intel Core i5-12450H', RAM: '16 GB', Disk: '512 GB SSD' }],
  ['LAP-HP-250G10', 'HP 250 G10 15,6" i3 / 8GB / 256GB', 'HP', 'Laptopovi', 449, null, 305, true, 24, '8A5D2EA', { Procesor: 'Intel Core i3-1315U', RAM: '8 GB', Disk: '256 GB SSD' }],
  ['LAP-APL-MBA13-M3', 'Apple MacBook Air 13" M3 8GB / 256GB', 'Apple', 'Laptopovi', 1349, null, 990, true, 24, 'MRXN3', { Procesor: 'Apple M3', RAM: '8 GB', Disk: '256 GB SSD' }],
  ['LAP-LEN-LEG5-16', 'Lenovo Legion 5 16" Ryzen 7 / 16GB / 1TB / RTX 4060', 'Lenovo', 'Laptopovi', 1499, 1399, 1050, true, 24, '83DG0040SC', { Procesor: 'AMD Ryzen 7 7840HS', Grafika: 'RTX 4060 8 GB' }],
  ['LAP-HP-PAV15', 'HP Pavilion 15 Ryzen 5 / 16GB / 512GB', 'HP', 'Laptopovi', 749, null, 510, true, 24, '8C7N5EA', { Procesor: 'AMD Ryzen 5 7530U', RAM: '16 GB' }],

  ['FRZ-GOR-NRK6192', 'Gorenje kombinovani frižider 185 cm', 'Gorenje', 'Frižideri', 499, null, 330, true, 36, 'NRK6192AW4', { Visina: '185 cm', 'Energetski razred': 'E', NoFrost: 'da' }],
  ['FRZ-BSH-KGN39', 'Bosch kombinovani frižider NoFrost 203 cm', 'Bosch', 'Frižideri', 749, null, 500, true, 36, 'KGN39VLEB', { Visina: '203 cm', 'Energetski razred': 'E' }],
  ['FRZ-SAM-RB34', 'Samsung kombinovani frižider 185 cm inox', 'Samsung', 'Frižideri', 649, null, 430, true, 36, 'RB34T602ESA', { Visina: '185 cm', Boja: 'inox' }],
  ['VES-BSH-WAN28', 'Bosch veš mašina 8 kg 1400 obrtaja', 'Bosch', 'Veš mašine', 529, null, 350, true, 36, 'WAN28262BY', { Kapacitet: '8 kg', Centrifuga: '1400 o/min' }],
  ['VES-GOR-WNEI84', 'Gorenje veš mašina 8 kg parna', 'Gorenje', 'Veš mašine', 449, 419, 295, true, 36, 'WNEI84APS', { Kapacitet: '8 kg', 'Program na paru': 'da' }],
  ['VES-LG-F4WV508', 'LG veš mašina 8 kg Steam AI DD', 'LG', 'Veš mašine', 599, null, 400, true, 36, 'F4WV508S1E', { Kapacitet: '8 kg', Motor: 'inverter direct drive' }],

  ['MKA-DEL-ECAM22', "De'Longhi Magnifica S aparat za espresso", "De'Longhi", 'Mali kućni aparati', 399, 349, 250, false, 24, 'ECAM22.110.B', { Pritisak: '15 bar', Mlin: 'ugrađeni' }],
  ['MKA-PHI-EP2221', 'Philips 2200 aparat za espresso', 'Philips', 'Mali kućni aparati', 349, null, 225, false, 24, 'EP2221/40', { Pritisak: '15 bar' }],
  ['MKA-TEF-EY801D', 'Tefal Easy Fry XXL friteza na vrući vazduh', 'Tefal', 'Mali kućni aparati', 149, null, 90, false, 24, 'EY801D', { Zapremina: '5,6 l' }],
  ['MKA-PHI-HD9252', 'Philips Airfryer 4,1 l', 'Philips', 'Mali kućni aparati', 119, null, 72, false, 24, 'HD9252/90', { Zapremina: '4,1 l' }],
  ['MKA-BSH-MUM5', 'Bosch MUM5 kuhinjski robot 1000 W', 'Bosch', 'Mali kućni aparati', 299, null, 190, false, 24, 'MUM58231', { Snaga: '1000 W', Posuda: '3,9 l' }],
  ['MKA-PHI-XC5043', 'Philips Series 5000 bežični usisivač', 'Philips', 'Mali kućni aparati', 299, null, 190, false, 24, 'XC5043/01', { Autonomija: 'do 70 min' }],
  ['MKA-TEF-FV2837', 'Tefal pegla na paru 2400 W', 'Tefal', 'Mali kućni aparati', 49.9, null, 28, false, 24, 'FV2837', { Snaga: '2400 W' }],
  ['MKA-PHI-HD9350', 'Philips kuvalo za vodu 1,7 l', 'Philips', 'Mali kućni aparati', 39.9, null, 22, false, 24, 'HD9350/90', { Zapremina: '1,7 l' }],
  ['MKA-GOR-MO20A4', 'Gorenje mikrotalasna rerna 20 l', 'Gorenje', 'Mali kućni aparati', 99, null, 62, false, 24, 'MO20A4X', { Zapremina: '20 l', Snaga: '800 W' }],

  ['AUD-JBL-FLIP6', 'JBL Flip 6 bluetooth zvučnik', 'JBL', 'Audio', 129, null, 80, false, 24, 'JBLFLIP6BLK', { Autonomija: '12 h', Zaštita: 'IP67' }],
  ['AUD-JBL-CHARGE5', 'JBL Charge 5 bluetooth zvučnik', 'JBL', 'Audio', 179, null, 112, false, 24, 'JBLCHARGE5BLK', { Autonomija: '20 h', Zaštita: 'IP67' }],
  ['AUD-SNY-WH1000XM5', 'Sony WH-1000XM5 bežične slušalice', 'Sony', 'Audio', 399, 349, 250, false, 24, 'WH1000XM5B', { 'Poništavanje buke': 'da', Autonomija: '30 h' }],
  ['AUD-APL-APP2', 'Apple AirPods Pro (2. generacija)', 'Apple', 'Audio', 279, null, 190, false, 12, 'MTJV3', { 'Poništavanje buke': 'da', Kućište: 'USB-C' }],
  ['AUD-SAM-BUDSFE', 'Samsung Galaxy Buds FE', 'Samsung', 'Audio', 99, null, 60, false, 24, 'SM-R400N', { 'Poništavanje buke': 'da' }],
  ['AUD-JBL-T520BT', 'JBL Tune 520BT bežične slušalice', 'JBL', 'Audio', 49.9, null, 29, false, 24, 'JBLT520BTBLK', { Autonomija: '57 h' }],
  ['AUD-SAM-HWB550', 'Samsung HW-B550 soundbar 2.1', 'Samsung', 'Audio', 249, null, 160, false, 24, 'HW-B550', { Kanali: '2.1', Snaga: '410 W' }],

  ['OPR-ANK-PC10K', 'Anker PowerCore 10000 prijenosna baterija', 'Anker', 'Oprema', 29.9, null, 15, false, 12, 'A1263', { Kapacitet: '10000 mAh' }],
  ['OPR-UGR-HDMI21-2M', 'Ugreen HDMI 2.1 kabl 2 m', 'Ugreen', 'Oprema', 14.9, null, 6, false, 12, 'HD140', { Dužina: '2 m', Podrška: '8K / 4K 120 Hz' }],
  ['OPR-UGR-USBC-1M', 'Ugreen USB-C kabl 1 m 60 W', 'Ugreen', 'Oprema', 9.9, null, 4, false, 12, 'US286', { Dužina: '1 m', Snaga: '60 W' }],
  ['OPR-APL-20W', 'Apple USB-C punjač 20 W', 'Apple', 'Oprema', 29, null, 17, false, 12, 'MHJE3', { Snaga: '20 W' }],
  ['OPR-SAM-25W', 'Samsung USB-C punjač 25 W', 'Samsung', 'Oprema', 24.9, null, 13, false, 12, 'EP-TA800', { Snaga: '25 W' }],
  ['OPR-XIA-BAND8', 'Xiaomi Smart Band 8 pametna narukvica', 'Xiaomi', 'Oprema', 39.9, null, 24, false, 12, 'M2239B1', { Ekran: '1,62" AMOLED' }],
  ['OPR-LOG-M185', 'Logitech M185 bežični miš', 'Logitech', 'Oprema', 19.9, null, 10, false, 24, '910-002238', { Povezivanje: 'USB prijemnik' }],
  ['OPR-LOG-K120', 'Logitech K120 tastatura (SRB)', 'Logitech', 'Oprema', 14.9, null, 8, false, 24, '920-002641', { Raspored: 'SRB' }],
  ['OPR-SDK-128GB', 'SanDisk Ultra microSDXC 128 GB', 'SanDisk', 'Oprema', 19.9, null, 10, false, 12, 'SDSQUAB-128G', { Kapacitet: '128 GB' }],
  ['OPR-NOS-TV3265', 'Zidni nosač za TV 32–65" pokretni', null, 'Oprema', 34.9, null, 18, false, 24, 'NOS-3265P', { Nosivost: 'do 35 kg', VESA: 'do 400×400' }],
];

/** EAN-13 with the Montenegrin GS1 prefix 389 and a valid check digit. */
function ean(n) {
  const body = `389${String(1000000 + n).padStart(9, '0')}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

// ---------- serial numbers the script keeps track of ----------

/** Units on each shelf: productId → warehouseId → serials, so picks and transfers name real units. */
const shelf = new Map();
const units = (p, w) => {
  if (!shelf.has(p)) shelf.set(p, new Map());
  if (!shelf.get(p).has(w)) shelf.get(p).set(w, []);
  return shelf.get(p).get(w);
};
const take = (p, w, n) => units(p, w).splice(0, n);
let serialSeq = 0;
function newSerials(product, n) {
  return Array.from({ length: n }, () => {
    serialSeq++;
    // Phones get IMEI-like numbers, everything else a maker-style serial.
    return product.category === 'Mobilni telefoni'
      ? `35${String(4829100000000 + serialSeq * 7919).slice(-13)}`
      : `${product.model.replace(/[^A-Z0-9]/gi, '').slice(0, 8).toUpperCase()}${String(210000 + serialSeq)}`;
  });
}

async function main() {
  if (!ADMIN.email || !ADMIN.password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  const admin = await login(ADMIN.email, ADMIN.password);
  const post = (path, body, token = admin) => call('POST', path, body ?? {}, token);
  const log = (...a) => console.log(...a);

  // ---- company, staff, customers
  await call('PATCH', '/admin/settings/company', {
    name: 'TechStore',
    legalName: 'TechStore d.o.o. Podgorica',
    address: 'Bulevar Džordža Vašingtona 51, 81000 Podgorica',
    taxId: '03187456',
    registrationNumber: '5-0891234/001',
    bankAccount: '510-0000000098765-43 (CKB)',
    phone: '+382 20 234 567',
    email: 'prodaja@techstore.me',
    website: 'www.techstore.me',
    lowStockThreshold: 3,
  }, admin);

  const staff = {};
  for (const [key, name, email, role] of [
    ['manager', 'Marko Petrović', 'marko.petrovic@techstore.me', 'MANAGER'],
    ['storekeeper', 'Ivan Vuković', 'ivan.vukovic@techstore.me', 'WAREHOUSE'],
    ['shopkeeper', 'Ana Radović', 'ana.radovic@techstore.me', 'WAREHOUSE'],
    ['accountant', 'Jelena Popović', 'jelena.popovic@techstore.me', 'ACCOUNTANT'],
  ]) {
    await post('/users', { name, email, password: DEMO_PASSWORD, role });
    staff[key] = await login(email, DEMO_PASSWORD);
  }
  const { manager, storekeeper, shopkeeper, accountant } = staff;

  const customers = {};
  for (const [key, name, email] of [
    ['milica', 'Milica Jovanović', 'milica.jovanovic@example.me'],
    ['nikola', 'Nikola Đurović', 'nikola.djurovic@example.me'],
    ['stefan', 'Stefan Vujović', 'stefan.vujovic@example.me'],
    ['ivana', 'Ivana Kovačević', 'ivana.kovacevic@example.me'],
    ['luka', 'Luka Radulović', 'luka.radulovic@example.me'],
    ['sara', 'Sara Bulatović', 'sara.bulatovic@example.me'],
  ]) {
    const r = await post('/auth/register', { name, email, password: DEMO_PASSWORD });
    customers[key] = { token: r.accessToken, name, email };
  }
  log('✓ company, 4 staff, 6 customers');

  // ---- warehouses, suppliers, categories, brands, products
  const main = await post('/warehouses', { name: 'Glavno skladište Podgorica', address: 'Cetinjski put bb, 81000 Podgorica' });
  const budva = await post('/warehouses', { name: 'Prodavnica Budva', address: 'Mediteranska 21, 85310 Budva' });

  const suppliers = {};
  for (const [key, name, taxId, email, phone, contact] of [
    ['adriatic', 'Adriatic Electronics d.o.o.', '02934871', 'nabavka@adriatic-electronics.me', '+382 20 612 300', 'Dragan Mijušković'],
    ['balkanit', 'Balkan IT Distribucija d.o.o.', '03012645', 'office@balkanit.me', '+382 20 655 410', 'Tamara Šćepanović'],
    ['bijela', 'Bijela Tehnika Montenegro d.o.o.', '02877503', 'prodaja@bijelatehnika.me', '+382 40 214 900', 'Miloš Pejović'],
    ['aparati', 'Mali Aparati Trade d.o.o.', '03155782', 'info@maliaparati.me', '+382 33 451 120', 'Jovana Lekić'],
  ]) {
    suppliers[key] = await post('/suppliers', { name, taxId, email, phone, contactPerson: contact });
  }

  const category = {};
  for (const [name, parent] of CATEGORIES) {
    category[name] = await post('/categories', { name, parentId: parent ? category[parent].id : undefined });
  }
  const brand = {};
  for (const name of BRANDS) brand[name] = await post('/brands', { name });

  const product = {};
  for (const [i, [sku, name, brandName, cat, sell, discount, purchase, serial, warranty, model, attributes]] of PRODUCTS.entries()) {
    const p = await post('/admin/products', {
      name, sku, barcode: ean(i + 1), model,
      description: `${name}. Garancija ${warranty} mjeseci.`,
      attributes,
      trackSerial: serial,
      purchasePrice: purchase,
      sellingPrice: sell,
      discountPrice: discount ?? undefined,
      warrantyMonths: warranty,
      categoryId: category[cat].id,
      brandId: brandName ? brand[brandName].id : undefined,
    });
    product[sku] = { ...p, category: cat, model };
  }
  log(`✓ 2 warehouses, 4 suppliers, ${CATEGORIES.length} categories, ${BRANDS.length} brands, ${PRODUCTS.length} products`);

  // ---- receivings into the main warehouse (one per supplier)
  const qty = {
    'TV-SAM-55DU7172': 6, 'TV-SAM-65Q60D': 3, 'TV-LG-55C4': 2, 'TV-LG-43UT73': 5, 'TV-SNY-50X75': 4, 'TV-PHI-43PUS8': 3,
    'MOB-APL-IP15-128': 8, 'MOB-APL-IP15P-256': 4, 'MOB-SAM-S24-256': 6, 'MOB-SAM-A55-128': 8, 'MOB-SAM-A15-128': 10,
    'MOB-XIA-RN13P-256': 7, 'MOB-XIA-14-512': 3,
    'LAP-LEN-IPS3-15': 5, 'LAP-HP-250G10': 5, 'LAP-LEN-LEG5-16': 2, 'LAP-HP-PAV15': 3,
    // MacBook Air: sold out, the next delivery is still a draft
    'FRZ-GOR-NRK6192': 4, 'FRZ-BSH-KGN39': 2, 'FRZ-SAM-RB34': 3, 'VES-BSH-WAN28': 4, 'VES-GOR-WNEI84': 3, 'VES-LG-F4WV508': 3,
    'MKA-DEL-ECAM22': 6, 'MKA-PHI-EP2221': 5, 'MKA-TEF-EY801D': 10, 'MKA-PHI-HD9252': 12, 'MKA-BSH-MUM5': 4,
    'MKA-PHI-XC5043': 4, 'MKA-TEF-FV2837': 15, 'MKA-PHI-HD9350': 20, 'MKA-GOR-MO20A4': 6,
    'AUD-JBL-FLIP6': 14, 'AUD-JBL-CHARGE5': 8, 'AUD-SNY-WH1000XM5': 2, 'AUD-APL-APP2': 10, 'AUD-SAM-BUDSFE': 12,
    'AUD-JBL-T520BT': 20, 'AUD-SAM-HWB550': 4,
    'OPR-ANK-PC10K': 30, 'OPR-UGR-HDMI21-2M': 40, 'OPR-UGR-USBC-1M': 50, 'OPR-APL-20W': 25, 'OPR-SAM-25W': 30,
    'OPR-XIA-BAND8': 15, 'OPR-LOG-M185': 25, 'OPR-LOG-K120': 20, 'OPR-SDK-128GB': 30, 'OPR-NOS-TV3265': 12,
  };
  const supplierOf = (brandName, cat) =>
    cat === 'Frižideri' || cat === 'Veš mašine' ? 'bijela'
      : cat === 'Mali kućni aparati' ? 'aparati'
        : ['Samsung', 'LG', 'Sony', 'Philips', 'JBL'].includes(brandName) && cat !== 'Oprema' ? 'adriatic'
          : 'balkanit';

  async function receive(supplierKey, warehouseId, lines, doc, token = storekeeper, confirm = true) {
    const items = lines.map(([sku, n]) => {
      const p = product[sku];
      const serials = p.trackSerial ? newSerials(p, n) : undefined;
      return { productId: p.id, quantity: n, purchasePrice: Number(p.purchasePrice ?? PRODUCTS.find((x) => x[0] === sku)[6]), serialNumbers: serials, _serials: serials };
    });
    const r = await post('/receivings', {
      supplierId: suppliers[supplierKey].id,
      warehouseId,
      supplierDocNumber: doc,
      supplierDocDate: new Date().toISOString().slice(0, 10),
      items: items.map(({ _serials, ...i }) => i),
    }, token);
    if (confirm) {
      await post(`/receivings/${r.id}/confirm`, {}, token);
      for (const i of items) if (i._serials) units(i.productId, warehouseId).push(...i._serials);
    }
    return r;
  }

  const bySupplier = {};
  for (const [sku, n] of Object.entries(qty)) {
    const row = PRODUCTS.find((x) => x[0] === sku);
    (bySupplier[supplierOf(row[2], row[3])] ??= []).push([sku, n]);
  }
  let docNo = 1;
  for (const [key, lines] of Object.entries(bySupplier)) {
    await receive(key, main.id, lines, `${key.toUpperCase().slice(0, 3)}-2026/${String(400 + docNo++)}`);
  }
  // Next delivery of MacBooks and iPhones: entered, not yet arrived.
  await receive('balkanit', main.id, [['LAP-APL-MBA13-M3', 4], ['MOB-APL-IP15-128', 6]], 'BAL-2026/431', storekeeper, false);
  log('✓ 4 confirmed receivings, 1 draft');

  // ---- orders
  const courier = (name, phone, address) => ({ customerName: name, customerPhone: phone, deliveryMethod: 'COURIER', deliveryAddress: address });
  const pickup = (name, phone) => ({ customerName: name, customerPhone: phone, deliveryMethod: 'PICKUP' });
  const line = (sku, quantity = 1) => ({ productId: product[sku].id, quantity });

  async function online(customer, items, extra) {
    return post('/orders', { items, customerEmail: customer.email, ...extra }, customer.token);
  }
  async function phoneOrder(items, extra) {
    return post('/admin/orders', { items, ...extra }, manager);
  }
  /** Scans everything reserved for the order, like the storekeeper with the phone. */
  async function pickAll(orderId, onlySku) {
    const sheet = await call('GET', `/admin/orders/${orderId}/pick-sheet`, undefined, storekeeper);
    for (const l of sheet.lines) {
      if (onlySku && l.product.sku !== onlySku) continue;
      if (l.product.trackSerial) {
        for (const sn of take(l.product.id, l.warehouse.id, l.remaining)) {
          await post(`/admin/orders/${orderId}/pick`, { code: sn, warehouseId: l.warehouse.id }, storekeeper);
        }
      } else if (l.remaining) {
        await post(`/admin/orders/${orderId}/pick`, { code: l.product.sku, warehouseId: l.warehouse.id, quantity: l.remaining }, storekeeper);
      }
    }
  }
  const confirm = (id) => post(`/admin/orders/${id}/confirm`, {}, manager);
  const pay = (id) => post(`/admin/orders/${id}/mark-paid`, {}, accountant);
  const startPicking = (id) => post(`/admin/orders/${id}/start-picking`, {}, manager);
  const finishPicking = (id) => post(`/admin/orders/${id}/complete-picking`, {}, storekeeper);
  const ship = (id, carrier, trackingNumber) => post(`/admin/orders/${id}/ship`, { carrier, trackingNumber }, storekeeper);
  const deliver = (id) => post(`/admin/orders/${id}/deliver`, {}, storekeeper);
  const complete = (id) => post(`/admin/orders/${id}/complete`, {}, manager);

  // 1. Online, card, courier: completed.
  const o1 = await online(customers.milica, [line('MOB-APL-IP15-128'), line('AUD-APL-APP2')],
    { ...courier('Milica Jovanović', '+382 67 214 558', 'Ulica slobode 34, 81000 Podgorica'), paymentMethod: 'CARD_ONLINE' });
  await pay(o1.id); await confirm(o1.id); await startPicking(o1.id); await pickAll(o1.id); await finishPicking(o1.id);
  await ship(o1.id, 'Post Express', 'PE482910375ME'); await deliver(o1.id); await complete(o1.id);

  // 2. Phone order, picked up and paid in cash: completed.
  const o2 = await phoneOrder([line('TV-SAM-55DU7172'), line('OPR-UGR-HDMI21-2M'), line('OPR-NOS-TV3265')],
    { ...pickup('Nikola Đurović', '+382 69 332 118'), customerEmail: customers.nikola.email, paymentMethod: 'CASH_ON_DELIVERY' });
  await confirm(o2.id); await startPicking(o2.id); await pickAll(o2.id); await finishPicking(o2.id);
  await pay(o2.id); await ship(o2.id); await complete(o2.id);

  // 3. Courier, cash on delivery: on its way.
  const o3 = await online(customers.stefan, [line('VES-BSH-WAN28')],
    { ...courier('Stefan Vujović', '+382 68 447 902', 'Njegoševa 12, 81400 Nikšić'), paymentMethod: 'CASH_ON_DELIVERY' });
  await confirm(o3.id); await startPicking(o3.id); await pickAll(o3.id); await finishPicking(o3.id);
  await ship(o3.id, 'City Express', 'CE2026-118734');

  // 4. Bank transfer, paid, picked: ready to ship.
  const o4 = await online(customers.ivana, [line('LAP-LEN-IPS3-15'), line('OPR-LOG-M185')],
    { ...courier('Ivana Kovačević', '+382 67 901 356', 'Jadranski put bb, 85330 Kotor'), paymentMethod: 'BANK_TRANSFER' });
  await confirm(o4.id); await pay(o4.id); await startPicking(o4.id); await pickAll(o4.id); await finishPicking(o4.id);

  // 5. Being picked right now: the charger is in the box, the phone is not yet.
  const o5 = await online(customers.luka, [line('MOB-SAM-S24-256'), line('OPR-SAM-25W')],
    { ...courier('Luka Radulović', '+382 69 118 240', 'Trg nezavisnosti 3, 81000 Podgorica'), paymentMethod: 'CARD_ONLINE' });
  await pay(o5.id); await confirm(o5.id); await startPicking(o5.id); await pickAll(o5.id, 'OPR-SAM-25W');

  // 6. Confirmed, waiting for the bank transfer.
  const o6 = await phoneOrder([line('FRZ-GOR-NRK6192')],
    { ...courier('Dragana Marković', '+382 67 550 311', 'Bulevar revolucije 8, 81000 Podgorica'), paymentMethod: 'BANK_TRANSFER', comment: 'Dostava poslije 16h, 3. sprat bez lifta' });
  await confirm(o6.id);

  // 7. New online orders, not yet confirmed.
  await online(customers.sara, [line('AUD-JBL-FLIP6'), line('OPR-ANK-PC10K', 2)],
    { ...courier('Sara Bulatović', '+382 68 212 776', 'Obala bb, 85310 Budva'), paymentMethod: 'CASH_ON_DELIVERY' });
  await phoneOrder([line('MKA-DEL-ECAM22')], { ...pickup('Petar Vukčević', '+382 69 870 045'), paymentMethod: 'CASH_ON_DELIVERY' });
  await online(customers.milica, [line('MKA-PHI-XC5043')],
    { ...courier('Milica Jovanović', '+382 67 214 558', 'Ulica slobode 34, 81000 Podgorica'), paymentMethod: 'CARD_ONLINE' });

  // 8. Cancelled by the customer.
  const o8 = await online(customers.nikola, [line('MOB-XIA-RN13P-256')],
    { ...courier('Nikola Đurović', '+382 69 332 118', 'Hercegovačka 5, 81000 Podgorica'), paymentMethod: 'CASH_ON_DELIVERY' });
  await post(`/orders/${o8.id}/cancel`, { reason: 'Naručio sam greškom drugu boju' }, customers.nikola.token);

  // 9. Completed, then one item comes back (see returns).
  const o9 = await online(customers.ivana, [line('MKA-PHI-HD9252'), line('MKA-PHI-HD9350')],
    { ...courier('Ivana Kovačević', '+382 67 901 356', 'Jadranski put bb, 85330 Kotor'), paymentMethod: 'CARD_ONLINE' });
  await pay(o9.id); await confirm(o9.id); await startPicking(o9.id); await pickAll(o9.id); await finishPicking(o9.id);
  await ship(o9.id, 'Post Express', 'PE482911204ME'); await deliver(o9.id); await complete(o9.id);

  // 10. A TV that later comes in under warranty; and a laptop sale.
  const o10 = await phoneOrder([line('TV-SNY-50X75'), line('AUD-SAM-HWB550')],
    { ...pickup('Stefan Vujović', '+382 68 447 902'), customerEmail: customers.stefan.email, paymentMethod: 'BANK_TRANSFER' });
  await confirm(o10.id); await pay(o10.id); await startPicking(o10.id); await pickAll(o10.id); await finishPicking(o10.id);
  await ship(o10.id); await complete(o10.id);

  const o11 = await online(customers.luka, [line('LAP-HP-250G10'), line('OPR-LOG-K120'), line('OPR-SDK-128GB', 2)],
    { ...courier('Luka Radulović', '+382 69 118 240', 'Trg nezavisnosti 3, 81000 Podgorica'), paymentMethod: 'CARD_ONLINE' });
  await pay(o11.id); await confirm(o11.id); await startPicking(o11.id); await pickAll(o11.id); await finishPicking(o11.id);
  await ship(o11.id, 'City Express', 'CE2026-118902'); await deliver(o11.id);
  log('✓ 13 orders (completed, delivered, shipped, ready, picking, confirmed, new, cancelled)');

  // ---- returns and warranty
  const full9 = await call('GET', `/admin/orders/${o9.id}`, undefined, manager);
  const kettle = full9.items.find((i) => i.sku === 'MKA-PHI-HD9350');
  const r1 = await post('/admin/returns', {
    orderId: o9.id,
    note: 'Kupac vratio u prodavnicu',
    items: [{ orderItemId: kettle.id, quantity: 1, reason: 'CHANGED_MIND', reasonNote: 'Poklon, već ima isti' }],
  }, storekeeper);
  await post(`/admin/returns/${r1.id}/receive`, { warehouseId: main.id }, storekeeper);
  await post(`/admin/returns/${r1.id}/decide`, { items: [{ itemId: r1.items[0].id, decision: 'RESTOCK', note: 'Neotpakovano, ispravno' }] }, storekeeper);
  await post(`/admin/returns/${r1.id}/approve`, {}, manager);
  await post(`/admin/returns/${r1.id}/refund`, { reference: 'Povraćaj na karticu 7702-1188' }, accountant);

  const full2 = await call('GET', `/admin/orders/${o2.id}`, undefined, manager);
  const hdmi = full2.items.find((i) => i.sku === 'OPR-UGR-HDMI21-2M');
  await post('/admin/returns', {
    orderId: o2.id,
    items: [{ orderItemId: hdmi.id, quantity: 1, reason: 'DEFECTIVE', reasonNote: 'Slika treperi na 4K 120 Hz' }],
  }, manager);

  const full10 = await call('GET', `/admin/orders/${o10.id}`, undefined, manager);
  const tvSerial = full10.items.find((i) => i.sku === 'TV-SNY-50X75').serialUnits[0].serialNumber;
  const w1 = await post('/admin/warranty-cases', { serialNumber: tvSerial, problem: 'Nema slike, zvuk radi. Kvar nastao nakon ažuriranja softvera.' }, storekeeper);
  await post(`/admin/warranty-cases/${w1.id}/receive`, {}, storekeeper);
  await post(`/admin/warranty-cases/${w1.id}/send-to-service`, { serviceCenter: 'Ovlašćeni Sony servis Podgorica' }, storekeeper);
  log('✓ 2 returns (refunded, requested), 1 warranty case in service');

  // ---- transfers to the Budva shop
  async function transfer(lines, notes) {
    const items = lines.map(([sku, n]) => {
      const p = product[sku];
      return { productId: p.id, quantity: n, ...(p.trackSerial && { serialNumbers: take(p.id, main.id, n) }) };
    });
    const t = await post('/transfers', { fromWarehouseId: main.id, toWarehouseId: budva.id, notes, items }, storekeeper);
    return { t, items };
  }
  const t1 = await transfer([
    ['MOB-SAM-A55-128', 2], ['MOB-SAM-A15-128', 3], ['MOB-XIA-RN13P-256', 2],
    ['AUD-JBL-FLIP6', 4], ['AUD-JBL-T520BT', 6], ['AUD-SAM-BUDSFE', 4],
    ['OPR-ANK-PC10K', 8], ['OPR-UGR-HDMI21-2M', 10], ['OPR-UGR-USBC-1M', 15], ['OPR-SAM-25W', 8], ['OPR-APL-20W', 6],
  ], 'Popuna prodavnice za sezonu');
  await post(`/transfers/${t1.t.id}/send`, {}, storekeeper);
  await post(`/transfers/${t1.t.id}/receive`, {}, shopkeeper);
  for (const i of t1.items) if (i.serialNumbers) units(i.productId, budva.id).push(...i.serialNumbers);

  const t2 = await transfer([['TV-SAM-55DU7172', 2], ['TV-LG-43UT73', 1]], 'Televizori za izlog');
  await post(`/transfers/${t2.t.id}/send`, {}, storekeeper);
  await transfer([['MKA-PHI-HD9252', 3], ['MKA-TEF-EY801D', 2]], 'Čeka kombi u četvrtak');
  log('✓ 3 transfers (received, in transit, draft)');

  // ---- a small direct delivery to Budva, a count there, a write-off in the main warehouse
  await receive('balkanit', budva.id, [['OPR-XIA-BAND8', 5], ['OPR-SDK-128GB', 10]], 'BAL-2026/437', shopkeeper);

  const count = await post('/inventory-counts', { warehouseId: budva.id, categoryId: category['Oprema'].id, notes: 'Mjesečni popis opreme' }, shopkeeper);
  const sheet = await call('GET', `/inventory-counts/${count.id}`, undefined, shopkeeper);
  for (const l of sheet.lines) {
    // One USB-C cable is missing from the shelf.
    const counted = l.product.sku === 'OPR-UGR-USBC-1M' ? l.expected - 1 : l.expected;
    await call('PUT', `/inventory-counts/${count.id}/lines/${l.product.id}`, { countedQuantity: counted }, shopkeeper);
  }
  await post(`/inventory-counts/${count.id}/finish`, {}, shopkeeper);
  await post(`/inventory-counts/${count.id}/approve`, {}, admin);

  await post('/stock/adjustments', {
    warehouseId: main.id,
    productId: product['MKA-TEF-FV2837'].id,
    quantity: -1,
    reason: 'Oštećeno pri istovaru (napukla posuda za vodu)',
  }, admin);
  log('✓ Budva receiving, approved count with a shortage, 1 write-off');

  log(`\nDone. Staff and customers log in with the password "${DEMO_PASSWORD}":`);
  log('  marko.petrovic@techstore.me (menadžer), ivan.vukovic@techstore.me (magacioner, Podgorica),');
  log('  ana.radovic@techstore.me (magacioner, Budva), jelena.popovic@techstore.me (računovođa),');
  log('  customers: milica.jovanovic@example.me, nikola.djurovic@example.me, … (@example.me)');
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
