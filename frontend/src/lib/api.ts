import { ORDER_STATUS, PAYMENT_STATUS } from "./labels";

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
    `Nema dovoljno robe: „${p.product}“ — traženo ${p.requested}, dostupno ${p.available}.`,
  PRODUCT_UNAVAILABLE: (p) => `Proizvod „${p.product}“ više nije u prodaji.`,
  ORDER_WRONG_STATE: (p) =>
    `Radnja nije moguća: narudžba je sada „${ORDER_STATUS[p.status] ?? p.status}“, ${(PAYMENT_STATUS[p.paymentStatus] ?? p.paymentStatus).toLowerCase()}. Osvježite stranicu.`,
  ORDER_NOT_PAID: () => "Narudžba još nije plaćena.",
  DUPLICATE: () => "Zapis sa ovim podatkom već postoji.",
  SERIAL_MODE_LOCKED: () =>
    "Praćenje serijskih brojeva ne može se mijenjati dok proizvod ima zalihu ili serijske brojeve.",
  DISCOUNT_NOT_LOWER: () => "Akcijska cijena mora biti niža od prodajne.",
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
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/prijava?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiError(401, "Sesija je istekla.");
  }
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
