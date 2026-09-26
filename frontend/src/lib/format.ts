// Montenegrin formats, local time (the business runs in Montenegro).
const LOCALE = "sr-Latn-ME";
const TIME_ZONE = "Europe/Podgorica";

const moneyFormat = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" });
const numberFormat = new Intl.NumberFormat(LOCALE);
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 1.357,90 € — the API sends money as a decimal string. */
export const money = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "—" : moneyFormat.format(Number(value));

export const count = (value: number) => numberFormat.format(value);

/** 26.09.2026. */
export const date = (iso: string | null | undefined) => (iso ? dateFormat.format(new Date(iso)) : "—");

/** 26.09.2026. 15:05 */
export const dateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFormat.format(new Date(iso)) : "—";

/**
 * What people type into a number field: "49,90", "1.234,50", "1.400", "1234.5".
 * Locally the comma is the decimal separator and the dot groups thousands, so dots in
 * thousands position ("1.400", "12.345.678") are grouping; any other single dot ("49.9")
 * is read as a decimal point. Returns NaN for anything else, null for empty.
 */
export function parseDecimal(text: string): number | null {
  const s = text.replace(/[\s €]/g, "");
  if (!s) return null;
  const grouped = s.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(s);
  const normalized = grouped ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

/** An API decimal ("49.9") as the text of an input field ("49,90"). */
export const decimalInput = (value: string | number | null | undefined, digits = 2) =>
  value === null || value === undefined ? "" : Number(value).toFixed(digits).replace(".", ",");

/** "2026-09-26" → "26.09." for chart axes. */
export const dayMonth = (isoDay: string) => `${isoDay.slice(8, 10)}.${isoDay.slice(5, 7)}.`;
