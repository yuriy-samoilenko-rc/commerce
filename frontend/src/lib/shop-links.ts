// Shop URLs, usable from server and client components alike.
export const productHref = (p: { id: string }) => `/proizvod/${p.id}`;
export const categoryHref = (c: { id: string }) => `/katalog?kategorija=${c.id}`;
