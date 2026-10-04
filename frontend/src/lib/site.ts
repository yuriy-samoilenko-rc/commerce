/** The shop's public address (SITE_URL), without a trailing slash. */
export const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3100").replace(/\/+$/, "");
