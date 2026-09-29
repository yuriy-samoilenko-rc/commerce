// Shop content for the demo catalog: longer descriptions, more specifications and two
// illustrations per product (drawn here, not copied from anyone: real photos are uploaded
// later in the admin). Run after demo-data.mjs, with the API running:
//
//   npm run demo:content
//
// Products that already have photos keep them; descriptions are rewritten every run.
// Only products of the demo categories are touched.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const API = process.env.API_URL ?? 'http://localhost:3000';

async function call(method, path, body, token, raw) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(!raw && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json?.message ?? text}`);
  return json;
}

// ---------- descriptions ----------

const attr = (p, key) => p.attributes?.[key];
/** 1 mjesec, 2–4 mjeseca, 5+ mjeseci (and 21 mjesec, 24 mjeseca, …). */
const months = (n) =>
  `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'mjesec' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'mjeseca' : 'mjeseci'}`;
const warranty = (p) =>
  p.warrantyMonths ? `Garancija ${months(p.warrantyMonths)}, servis preko ovlašćenog servisa u Crnoj Gori.` : '';

/** Category → [intro, features, in the box, extra specifications]. */
const TEXT = {
  Televizori: (p) => [
    `${p.name} donosi oštru sliku i bogate boje u svaki dnevni boravak. Dijagonala ${attr(p, 'Dijagonala') ?? ''} je pravi izbor za filmove, sport i igrice.`,
    `Pametne funkcije daju pristup Netflixu, YouTubeu i lokalnim IPTV servisima bez dodatnih uređaja, a HDR sadržaj se prikazuje sa više detalja u svijetlim i tamnim scenama. Tanki okvir i elegantno postolje uklapaju se u svaki prostor.`,
    `U kutiji: televizor, daljinski upravljač sa baterijama, postolje i kabl za napajanje.`,
    { HDR: 'HDR10, HLG', Priključci: '3× HDMI, 2× USB, LAN, Wi-Fi, Bluetooth', 'Montaža na zid': 'VESA' },
  ],
  'Mobilni telefoni': (p) => [
    `${p.name} je brz i pouzdan telefon za svakodnevicu: fotografije, poruke, mape i društvene mreže bez čekanja.`,
    `Veliki ekran sa visokim osvježavanjem čini listanje glatkim, a baterija bez problema izdrži cijeli dan. Kamera snima jasne fotografije i danju i noću, a ${attr(p, 'Memorija') ?? 'ugrađena memorija'} ostavlja dovoljno mjesta za aplikacije i uspomene.`,
    `U kutiji: telefon, USB-C kabl i alat za SIM karticu. Punjač se kupuje posebno.`,
    { Mreža: '5G / 4G LTE', 'Dual SIM': 'da (nano + eSIM)', Punjenje: 'USB-C, brzo punjenje' },
  ],
  Laptopovi: (p) => [
    `${p.name} je laptop za posao, školu i zabavu — lagan za nošenje, a dovoljno snažan za zahtjevnije programe.`,
    `Procesor ${attr(p, 'Procesor') ?? ''} uz ${attr(p, 'RAM') ?? 'dovoljno'} radne memorije pokreće više aplikacija istovremeno bez usporavanja, a brzi SSD skraćuje paljenje i učitavanje. Kvalitetna tastatura i precizan touchpad olakšavaju dugotrajan rad.`,
    `U kutiji: laptop, punjač i kratko uputstvo.`,
    { Ekran: 'IPS, Full HD, mat', Bežično: 'Wi-Fi 6, Bluetooth 5', 'Operativni sistem': 'bez OS / prema modelu' },
  ],
  Frižideri: (p) => [
    `${p.name} čuva namirnice svježim duže, uz tih rad i nisku potrošnju struje.`,
    `Prostrani frižiderski dio ima podesive police i fioke za voće i povrće, a zamrzivač sa fiokama omogućava pregledno slaganje. Sistem ravnomjernog hlađenja drži stalnu temperaturu na svim policama.`,
    `Isporuka na adresu i odvoz starog uređaja mogući su uz dogovor.`,
    { 'Nivo buke': '36 dB', 'Klimatska klasa': 'SN–T', 'Zapremina ukupno': 'oko 300 l' },
  ],
  'Veš mašine': (p) => [
    `${p.name} pere temeljno i nježno, sa programima za svaku vrstu veša.`,
    `Kapacitet ${attr(p, 'Kapacitet') ?? '8 kg'} dovoljan je za cijelu porodicu, a brzi program osvježi veš za manje od pola sata. Inverter motor radi tiše i troši manje energije, a dječja zaštita sprječava slučajne promjene programa.`,
    `Isporuka na adresu i povezivanje uz dogovor.`,
    { 'Energetski razred': 'A', 'Broj programa': '14', 'Odloženi start': 'do 24 h' },
  ],
  'Mali kućni aparati': (p) => [
    `${p.name} olakšava svakodnevne poslove u kuhinji i domu.`,
    `Jednostavno rukovanje, kvalitetni materijali i lako čišćenje čine ga uređajem koji se koristi svaki dan. Kompaktne dimenzije štede prostor, a zaštita od pregrijavanja brine o bezbjednosti.`,
    `U kutiji: uređaj i uputstvo za upotrebu na našem jeziku.`,
    { Napon: '220–240 V', Boja: 'crna / inox' },
  ],
  Audio: (p) => [
    `${p.name} daje čist zvuk sa dubokim basom — kod kuće, na putu ili na plaži.`,
    `Bluetooth veza se uspostavlja u par sekundi, a baterija traje dovoljno za cijeli dan slušanja. Kvalitetni materijali i pažljivo podešen zvuk čine muziku, podkaste i filmove prijatnijim za slušanje.`,
    `U kutiji: uređaj i USB-C kabl za punjenje.`,
    { Povezivanje: 'Bluetooth 5.x', Punjenje: 'USB-C' },
  ],
  Oprema: (p) => [
    `${p.name} — pouzdan dodatak za vaše uređaje.`,
    `Provjereni kvalitet izrade i kompatibilnost sa većinom telefona, laptopova i televizora. Praktičan je za svakodnevnu upotrebu kod kuće, u kancelariji i na putu.`,
    ``,
    {},
  ],
};

// ---------- illustrations ----------

const PALETTE = {
  Televizori: ['#e8eef7', '#c9d6ea'],
  'Mobilni telefoni': ['#f1ecf7', '#d9cdea'],
  Laptopovi: ['#e9f2f1', '#c8dfdc'],
  Frižideri: ['#eef3f6', '#d3e0e8'],
  'Veš mašine': ['#edf1f7', '#cfd9e8'],
  'Mali kućni aparati': ['#f7f0e8', '#ead8c3'],
  Audio: ['#f5ebed', '#e5cdd3'],
  Oprema: ['#eef0f2', '#d6dade'],
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A simple studio-style drawing of the kind of product, centered on a 1200×1200 canvas. */
function shape(p) {
  const n = p.name.toLowerCase();
  const dark = '#1f2328';
  const screen = `<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d3b55"/><stop offset=".55" stop-color="#101622"/><stop offset="1" stop-color="#3a2f55"/></linearGradient>`;
  switch (p.category) {
    case 'Televizori':
      return `<defs>${screen}</defs>
        <rect x="170" y="300" width="860" height="500" rx="14" fill="${dark}"/>
        <rect x="186" y="316" width="828" height="468" rx="6" fill="url(#scr)"/>
        <path d="M186 316 L620 316 L380 784 L186 784 Z" fill="#fff" opacity=".06"/>
        <rect x="560" y="800" width="80" height="60" fill="#3a3f45"/>
        <rect x="430" y="858" width="340" height="16" rx="8" fill="#2a2e33"/>`;
    case 'Mobilni telefoni':
      return `<defs>${screen}</defs>
        <rect x="430" y="210" width="340" height="700" rx="56" fill="${dark}"/>
        <rect x="446" y="226" width="308" height="668" rx="44" fill="url(#scr)"/>
        <rect x="560" y="246" width="80" height="22" rx="11" fill="${dark}"/>
        <rect x="690" y="280" width="4" height="60" fill="#fff" opacity=".2"/>
        <path d="M446 600 Q600 520 754 620 L754 850 Q754 894 710 894 L490 894 Q446 894 446 850 Z" fill="#fff" opacity=".05"/>`;
    case 'Laptopovi':
      return `<defs>${screen}</defs>
        <rect x="290" y="300" width="620" height="400" rx="16" fill="${dark}"/>
        <rect x="306" y="316" width="588" height="368" rx="6" fill="url(#scr)"/>
        <path d="M220 720 L980 720 L1020 790 Q1024 800 1010 800 L190 800 Q176 800 180 790 Z" fill="#b9bec5"/>
        <rect x="520" y="722" width="160" height="14" rx="7" fill="#9aa0a8"/>`;
    case 'Frižideri':
      return `<rect x="420" y="170" width="360" height="820" rx="26" fill="#e9ecef" stroke="#aab1b9" stroke-width="6"/>
        <line x1="420" y1="600" x2="780" y2="600" stroke="#aab1b9" stroke-width="6"/>
        <rect x="740" y="260" width="14" height="220" rx="7" fill="#8a929b"/>
        <rect x="740" y="660" width="14" height="200" rx="7" fill="#8a929b"/>
        <rect x="460" y="220" width="120" height="44" rx="8" fill="#cfd5db"/>`;
    case 'Veš mašine':
      return `<rect x="360" y="260" width="480" height="640" rx="28" fill="#f5f6f7" stroke="#aab1b9" stroke-width="6"/>
        <line x1="360" y1="370" x2="840" y2="370" stroke="#c9ced4" stroke-width="4"/>
        <circle cx="720" cy="315" r="26" fill="#d5dade"/><rect x="400" y="300" width="160" height="30" rx="6" fill="#2f353b"/>
        <circle cx="600" cy="620" r="185" fill="#cfd5db"/><circle cx="600" cy="620" r="150" fill="#39434d"/>
        <path d="M500 560 A130 130 0 0 1 660 490" stroke="#fff" stroke-width="10" fill="none" opacity=".25"/>`;
    case 'Audio':
      if (n.includes('soundbar'))
        return `<rect x="180" y="520" width="840" height="140" rx="60" fill="${dark}"/><rect x="220" y="560" width="760" height="60" rx="30" fill="#2e3439"/>
          <rect x="820" y="720" width="200" height="200" rx="24" fill="${dark}"/><circle cx="920" cy="820" r="60" fill="#2e3439"/>`;
      if (n.includes('slušalice') && !n.includes('buds') && !n.includes('airpods'))
        return `<path d="M370 640 Q370 300 600 300 Q830 300 830 640" stroke="${dark}" stroke-width="40" fill="none" stroke-linecap="round"/>
          <rect x="310" y="600" width="130" height="240" rx="60" fill="${dark}"/><rect x="760" y="600" width="130" height="240" rx="60" fill="${dark}"/>`;
      if (n.includes('airpods') || n.includes('buds'))
        return `<rect x="420" y="420" width="360" height="300" rx="120" fill="#f8f9fa" stroke="#c4cad0" stroke-width="6"/>
          <line x1="430" y1="520" x2="770" y2="520" stroke="#c4cad0" stroke-width="4"/>
          <circle cx="600" cy="600" r="10" fill="#9aa0a8"/>`;
      return `<rect x="330" y="420" width="540" height="340" rx="170" fill="${dark}"/>
        <rect x="360" y="450" width="480" height="280" rx="140" fill="#2b3136"/>
        <circle cx="600" cy="590" r="90" fill="#3a4148"/><circle cx="600" cy="590" r="40" fill="#1a1e22"/>`;
    case 'Mali kućni aparati':
      if (n.includes('espresso'))
        return `<rect x="400" y="260" width="400" height="620" rx="30" fill="${dark}"/><rect x="440" y="300" width="320" height="120" rx="12" fill="#2e3439"/>
          <rect x="560" y="520" width="80" height="60" rx="10" fill="#9aa0a8"/><rect x="530" y="700" width="140" height="110" rx="10" fill="#f5f5f5"/>`;
      if (n.includes('friteza') || n.includes('airfryer'))
        return `<rect x="400" y="300" width="400" height="560" rx="150" fill="${dark}"/><rect x="450" y="560" width="300" height="220" rx="40" fill="#2e3439"/>
          <rect x="560" y="520" width="80" height="20" rx="10" fill="#9aa0a8"/><circle cx="600" cy="420" r="46" fill="#2e3439"/>`;
      if (n.includes('kuvalo'))
        return `<path d="M470 380 L730 380 L770 860 L430 860 Z" fill="#dfe3e7" stroke="#9aa0a8" stroke-width="6"/>
          <path d="M760 460 Q860 480 840 640 Q830 720 770 740" stroke="#2e3439" stroke-width="36" fill="none"/>
          <rect x="420" y="860" width="360" height="40" rx="20" fill="#2e3439"/>`;
      if (n.includes('pegla'))
        return `<path d="M300 780 Q320 560 620 520 L880 520 Q920 520 920 560 L920 780 Z" fill="#3563a6"/>
          <path d="M520 520 Q560 380 760 380 L840 380 Q880 380 880 420 L880 520" stroke="#2e3439" stroke-width="40" fill="none"/>`;
      if (n.includes('mikrotalasna'))
        return `<rect x="240" y="380" width="720" height="440" rx="24" fill="#c9ced4"/><rect x="280" y="420" width="500" height="360" rx="12" fill="#2b3136"/>
          <rect x="810" y="430" width="110" height="60" rx="8" fill="#2b3136"/><circle cx="865" cy="580" r="34" fill="#9aa0a8"/>`;
      if (n.includes('usisivač'))
        return `<rect x="570" y="200" width="60" height="560" rx="30" fill="#9aa0a8"/><rect x="520" y="200" width="160" height="220" rx="60" fill="${dark}"/>
          <path d="M470 760 L730 760 Q760 760 760 790 L760 830 L440 830 L440 790 Q440 760 470 760 Z" fill="${dark}"/>`;
      return `<rect x="390" y="300" width="420" height="560" rx="60" fill="#e2e5e8" stroke="#9aa0a8" stroke-width="6"/>
        <rect x="450" y="360" width="300" height="300" rx="150" fill="#c9ced4"/><rect x="480" y="740" width="240" height="60" rx="30" fill="#2e3439"/>`;
    default: // Oprema
      if (n.includes('kabl'))
        return `<path d="M300 700 C420 360 780 840 900 480" stroke="${dark}" stroke-width="28" fill="none" stroke-linecap="round"/>
          <rect x="250" y="680" width="110" height="60" rx="12" fill="#9aa0a8"/><rect x="850" y="430" width="110" height="60" rx="12" fill="#9aa0a8"/>`;
      if (n.includes('punjač'))
        return `<rect x="440" y="380" width="320" height="320" rx="40" fill="#f8f9fa" stroke="#c4cad0" stroke-width="6"/>
          <rect x="560" y="700" width="20" height="90" fill="#9aa0a8"/><rect x="620" y="700" width="20" height="90" fill="#9aa0a8"/>
          <rect x="570" y="500" width="60" height="24" rx="8" fill="#c4cad0"/>`;
      if (n.includes('miš'))
        return `<rect x="480" y="320" width="240" height="420" rx="120" fill="${dark}"/><line x1="600" y1="330" x2="600" y2="470" stroke="#444a50" stroke-width="6"/>
          <rect x="590" y="380" width="20" height="50" rx="10" fill="#6b7178"/>`;
      if (n.includes('tastatura'))
        return `<rect x="200" y="460" width="800" height="280" rx="24" fill="${dark}"/>` +
          Array.from({ length: 4 }, (_, r) => Array.from({ length: 12 }, (_, c) => `<rect x="${236 + c * 62}" y="${490 + r * 58}" width="50" height="44" rx="6" fill="#3a4047"/>`).join('')).join('');
      if (n.includes('narukvica'))
        return `<rect x="560" y="200" width="80" height="800" rx="40" fill="#2e3439"/><rect x="520" y="480" width="160" height="240" rx="50" fill="${dark}"/>
          <rect x="540" y="500" width="120" height="200" rx="40" fill="url(#scr)"/><defs><linearGradient id="scr"><stop offset="0" stop-color="#2d3b55"/><stop offset="1" stop-color="#3a2f55"/></linearGradient></defs>`;
      if (n.includes('microsd'))
        return `<path d="M470 330 L700 330 L730 360 L730 870 L470 870 Z" fill="#c62828"/><rect x="500" y="690" width="200" height="140" rx="8" fill="#e8e8e8"/>`;
      if (n.includes('nosač'))
        return `<rect x="380" y="320" width="440" height="300" rx="12" fill="none" stroke="${dark}" stroke-width="30"/>
          <path d="M600 620 L600 760 L760 860" stroke="${dark}" stroke-width="30" fill="none"/><rect x="720" y="840" width="140" height="80" rx="12" fill="${dark}"/>`;
      return `<rect x="440" y="300" width="320" height="600" rx="44" fill="${dark}"/><rect x="480" y="760" width="240" height="20" rx="10" fill="#3a4047"/>
        <circle cx="600" cy="400" r="12" fill="#57c26a"/>`;
  }
}

function illustration(p, variant) {
  const [light, deep] = PALETTE[p.category] ?? PALETTE.Oprema;
  const bg =
    variant === 0
      ? `<radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${light}"/></radialGradient>`
      : `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></linearGradient>`;
  const brand = p.brand?.name ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs>${bg}<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-opacity=".18"/></filter></defs>
    <rect width="1200" height="1200" fill="url(#bg)"/>
    <ellipse cx="600" cy="960" rx="360" ry="26" fill="#000" opacity=".07"/>
    <g filter="url(#sh)"${variant === 1 ? ' transform="translate(600 600) scale(.82) rotate(-6) translate(-600 -600)"' : ''}>${shape(p)}</g>
    <text x="70" y="120" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#1f2328" opacity=".85">${esc(brand)}</text>
    <text x="70" y="1130" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30" fill="#1f2328" opacity=".45">Ilustracija · TechStore</text>
  </svg>`;
}

async function main() {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  const { accessToken: token } = await call('POST', '/auth/login', { email, password });

  const { items } = await call('GET', '/admin/products?limit=100&status=all&sort=name', undefined, token);
  // Only the demo catalog's categories (demo-data.mjs); anything else, e.g. test data, stays as it is.
  const demo = items.filter((p) => TEXT[p.category.name]);
  let photos = 0;
  for (const p of demo) {
    const category = p.category.name;
    const build = TEXT[category];
    const [intro, features, box, extra] = build({ ...p, attributes: p.attributes ?? {} });
    const description = [intro, features, box, warranty(p)].filter(Boolean).join('\n\n');
    await call('PATCH', `/admin/products/${p.id}`, {
      description,
      attributes: { ...extra, ...(p.attributes ?? {}), ...(p.warrantyMonths && { Garancija: months(p.warrantyMonths) }) },
    }, token);

    if (!p.images?.length) {
      const form = new FormData();
      for (const variant of [0, 1]) {
        const png = await sharp(Buffer.from(illustration({ ...p, category }, variant))).png().toBuffer();
        form.append('files', new Blob([png], { type: 'image/png' }), `${p.sku}-${variant + 1}.png`);
      }
      await call('POST', `/admin/products/${p.id}/images`, undefined, token, form);
      const images = await call('GET', `/admin/products/${p.id}/images`, undefined, token);
      await call('PATCH', `/admin/products/${p.id}/images/${images[0].id}`, { alt: `${p.name} — ilustracija` }, token);
      photos += 2;
    }
  }
  console.log(`✓ ${demo.length} descriptions and specifications, ${photos} illustrations uploaded`);
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
