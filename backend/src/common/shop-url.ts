/** Public address of the online shop (SHOP_URL); links in emails point there. */
export const shopUrl = () =>
  (process.env.SHOP_URL ?? 'http://localhost:3100').replace(/\/+$/, '');
