// Shop URLs, usable from server and client components alike.
export const productHref = (p: { slug: string }) => `/proizvod/${p.slug}`;
export const categoryHref = (c: { slug: string }) => `/katalog/${c.slug}`;
