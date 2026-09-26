/**
 * Browser-side API calls. They go to our own /api/backend proxy (same origin),
 * which attaches the session token; the token itself never reaches this code.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const FALLBACK: Record<number, string> = {
  400: "Podaci nijesu ispravni.",
  403: "Nemate pravo na ovu radnju.",
  404: "Traženi podatak ne postoji.",
  409: "Radnja trenutno nije moguća zbog stanja podatka.",
};

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
  if (!res.ok) throw new ApiError(res.status, FALLBACK[res.status] ?? "Došlo je do greške. Pokušajte ponovo.");
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
