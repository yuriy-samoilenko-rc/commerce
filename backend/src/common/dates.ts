export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 Jan + 1 month → 28/29 Feb, not 3 Mar
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** When the warranty of a unit sold at `soldAt` ends, or null if it has none. */
export function warrantyUntil(soldAt: Date | null, warrantyMonths: number | null) {
  return soldAt && warrantyMonths ? addMonths(soldAt, warrantyMonths) : null;
}
