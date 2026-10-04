import { date, money } from "./format";
import { COUNT_STATUS, ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS, SERIAL_STATUS, TRANSFER_STATUS, WARRANTY_STATUS } from "./labels";

/**
 * Browser-side API calls. They go to our own /api/backend proxy (same origin),
 * which attaches the session token; the token itself never reaches this code.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly params: Params = {},
  ) {
    super(message);
  }
}

type Params = Record<string, string | number>;

/** The backend's error codes (backend/src/common/errors.ts) in words for people. */
const CODED: Record<string, (p: Params) => string> = {
  INSUFFICIENT_STOCK: (p) =>
    `Nema dovoljno robe${p.product ? `: „${p.product}“` : ""} — traženo ${p.requested}, dostupno ${p.available}.`,
  PRODUCT_UNAVAILABLE: (p) => `Proizvod „${p.product}“ više nije u prodaji.`,
  ORDER_WRONG_STATE: (p) =>
    `Radnja nije moguća: narudžba je sada „${ORDER_STATUS[p.status] ?? p.status}“, ${(PAYMENT_STATUS[p.paymentStatus] ?? p.paymentStatus).toLowerCase()}. Osvježite stranicu.`,
  ORDER_NOT_PAID: () => "Narudžba još nije plaćena.",
  DUPLICATE: () => "Zapis sa ovim podatkom već postoji.",
  SERIAL_MODE_LOCKED: () =>
    "Praćenje serijskih brojeva ne može se mijenjati dok proizvod ima zalihu ili serijske brojeve.",
  DISCOUNT_NOT_LOWER: () => "Akcijska cijena mora biti niža od prodajne.",
  PRODUCT_ARCHIVED: (p) => `Proizvod „${p.product}“ je arhiviran.`,
  WAREHOUSE_INACTIVE: () => "Skladište nije aktivno.",
  SERIALS_NOT_TRACKED: (p) => `Proizvod „${p.product}“ se ne prati po serijskom broju.`,
  SERIALS_COUNT_MISMATCH: (p) =>
    `„${p.product}“: potrebno je ${p.expected} serijskih brojeva, uneseno ${p.got}.`,
  SERIALS_DUPLICATE: (p) => `Serijski brojevi se ponavljaju: ${p.serials}.`,
  SERIALS_TAKEN: (p) => `Serijski brojevi su već evidentirani: ${p.serials}.`,
  SERIALS_UNAVAILABLE: (p) => `Serijski brojevi nijesu dostupni na ovom skladištu: ${p.serials}.`,
  STOCK_BEING_COUNTED: (p) =>
    `„${p.product}“ je u popisu ${p.count}; kretanja robe su moguća tek kada se popis odobri ili otkaže.`,
  NOT_DRAFT: () => "Dokument više nije nacrt i ne može se mijenjati. Osvježite stranicu.",
  DOCUMENT_EMPTY: () => "Dokument nema nijednu stavku.",
  TRANSFER_WRONG_STATE: (p) =>
    `Radnja nije moguća: prenos je sada „${TRANSFER_STATUS[p.status] ?? p.status}“. Osvježite stranicu.`,
  SAME_WAREHOUSE: () => "Skladište iz kojeg i u koje se roba prenosi mora biti različito.",
  COUNT_ALREADY_OPEN: (p) => `Za ovo skladište je već otvoren popis ${p.count}.`,
  COUNT_WRONG_STATE: (p) =>
    `Radnja nije moguća: popis je sada „${COUNT_STATUS[p.status] ?? p.status}“. Osvježite stranicu.`,
  UNKNOWN_CODE: (p) => `Nepoznat kod „${p.code}“: nije bar-kod, šifra ni serijski broj iz sistema.`,
  SCAN_SERIAL_NOT_BARCODE: (p) => `„${p.product}“ se vodi po serijskim brojevima: skenirajte serijski broj, ne bar-kod.`,
  SERIAL_IS_ONE_UNIT: () => "Serijski broj je uvijek jedan komad.",
  SERIAL_OTHER_PRODUCT: (p) => `Serijski broj ${p.serial} pripada drugom proizvodu.`,
  SERIAL_ALREADY_COUNTED: (p) => `Serijski broj ${p.serial} je već izbrojan.`,
  SERIAL_ELSEWHERE: (p) =>
    `Serijski broj ${p.serial} nije na polici ovog skladišta (${SERIAL_STATUS[p.status] ?? p.status}). Riješite to prije brojanja, npr. prenosom.`,
  OUT_OF_COUNT_SCOPE: (p) => `„${p.product}“ nije u kategoriji koja se broji.`,
  ORDER_NOT_RETURNABLE: (p) =>
    `Povraćaj je moguć samo za isporučene narudžbe; ova je „${ORDER_STATUS[p.status] ?? p.status}“.`,
  RETURN_WRONG_STATE: (p) =>
    `Radnja nije moguća: povraćaj je sada „${RETURN_STATUS[p.status] ?? p.status}“. Osvježite stranicu.`,
  RETURN_QTY_EXCEEDED: (p) => `Od „${p.product}“ se može vratiti još najviše ${p.left} kom.`,
  RETURN_PERIOD_PASSED: (p) =>
    `Rok od ${p.days} dana za povraćaj „${p.product}“ je istekao; kvar se rješava kroz garanciju.`,
  RETURN_UNDECIDED: () => "Prije odobrenja donesite odluku za svaku stavku.",
  RETURN_UNITS_CHANGED: () => "Neki vraćeni komadi više nijesu u statusu „prodato“; provjerite serijske brojeve.",
  SERIAL_NOT_FOUND: (p) => `Serijski broj „${p.serial}“ nije pronađen.`,
  WARRANTY_UNIT_NOT_SOLD: (p) =>
    `Garancija važi samo za prodate komade; ovaj je „${SERIAL_STATUS[p.status] ?? p.status}“.`,
  NO_WARRANTY: () => "Ovaj proizvod nema garanciju.",
  WARRANTY_EXPIRED: (p) => `Garancija je istekla ${date(String(p.until))}.`,
  WARRANTY_ALREADY_OPEN: (p) => `Za ovaj komad je već otvoren garantni zahtjev ${p.case}.`,
  WARRANTY_WRONG_STATE: (p) =>
    `Radnja nije moguća: zahtjev je sada „${WARRANTY_STATUS[p.status] ?? p.status}“. Osvježite stranicu.`,
  UNIT_STATE_CHANGED: () => "Status uređaja se u međuvremenu promijenio. Osvježite stranicu.",
  NOT_IN_PICK_LIST: () => "Ovaj proizvod se za ovu narudžbu ne uzima sa ovog skladišta.",
  PICK_LIMIT: (p) => `„${p.product}“: ostalo je još samo ${p.left} kom. za sklapanje.`,
  UNPICK_LIMIT: (p) => `„${p.product}“: spakovano je samo ${p.picked} kom.`,
  PICKING_INCOMPLETE: (p) => `Nije sve spakovano: ${p.list}.`,
  SERIAL_ALREADY_PICKED: (p) => `Serijski broj ${p.serial} je već spakovan za ovu narudžbu.`,
  SERIAL_PICKED_ELSEWHERE: (p) => `Serijski broj ${p.serial} je već spakovan za drugu narudžbu.`,
  SERIAL_NOT_PICKED: (p) => `Serijski broj ${p.serial} nije spakovan za ovu narudžbu.`,
  REPLACEMENT_UNAVAILABLE: (p) =>
    `Serijski broj ${p.serial} nije slobodan komad proizvoda „${p.product}“ na polici izabranog skladišta.`,
  NO_FILES: () => "Izaberite bar jednu sliku.",
  TOO_MANY_IMAGES: (p) => `Proizvod može imati najviše ${p.max} slika; može se dodati još ${p.left}.`,
  IMAGE_FORMAT: (p) => `„${p.file}“ nije slika u formatu JPEG, PNG ili WebP.`,
  IMAGE_ORDER: () => "Slike su se u međuvremenu promijenile. Osvježite stranicu.",
  NOT_A_PICKUP_POINT: () => "Na izabranom mjestu nije moguće preuzeti narudžbu. Izaberite drugu prodavnicu.",
  SALE_END_WITHOUT_DISCOUNT: () => "Kraj akcije se unosi samo uz akcijsku cijenu.",
  SALE_END_PAST: () => "Kraj akcije mora biti u budućnosti.",
  REVIEW_NOT_ALLOWED: () => "Ocjenu mogu ostaviti samo kupci koji su ovaj proizvod primili.",
  REVIEW_EXISTS: () => "Već ste ocijenili ovaj proizvod.",
  WRONG_PASSWORD: () => "Trenutna lozinka nije ispravna.",
  PROMO_INVALID: (p) => `Promo kod „${p.code}“ ne postoji ili više ne važi.`,
  PROMO_USED_UP: () => "Ovaj promo kod je iskorišćen.",
  PROMO_ALREADY_USED: () => "Ovaj promo kod ste već iskoristili.",
  PROMO_MIN_SUBTOTAL: (p) => `Promo kod važi za kupovinu od najmanje ${money(p.min)}.`,
  PROMO_NOT_APPLICABLE: () => "Promo kod ne važi za proizvode na akciji.",
  PROMO_PERCENT: () => "Procenat popusta ne može biti veći od 100.",
  PROMO_DATES: () => "Kraj važenja mora biti posle početka.",
  PRODUCT_IN_STOCK: () => "Proizvod je već na stanju — možete ga odmah poručiti.",
  RESET_TOKEN_INVALID: () => "Ovaj link za novu lozinku je već iskorišćen ili je istekao.",
};

const FALLBACK: Record<number, string> = {
  400: "Podaci nijesu ispravni.",
  403: "Nemate pravo na ovu radnju.",
  404: "Traženi podatak ne postoji.",
  409: "Radnja trenutno nije moguća zbog stanja podatka.",
};

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { code?: string; params?: Params } | null;
  const coded = body?.code ? CODED[body.code] : undefined;
  const message = coded
    ? coded(body?.params ?? {})
    : (FALLBACK[res.status] ?? "Došlo je do greške. Pokušajte ponovo.");
  return new ApiError(res.status, message, body?.code, body?.params);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/backend${path}`, {
    ...rest,
    headers: { ...(json !== undefined && { "Content-Type": "application/json" }), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (res.status === 401) {
    // A full reload on purpose: it drops every cached query of the expired session.
    // Staff screens have their own login; everyone else is a shop customer.
    const path = window.location.pathname;
    const login = /^\/(admin|m)(\/|$)/.test(path) ? "/prijava" : "/nalog/prijava";
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${login}?next=${encodeURIComponent(path)}`);
    throw new ApiError(401, "Sesija je istekla.");
  }
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
