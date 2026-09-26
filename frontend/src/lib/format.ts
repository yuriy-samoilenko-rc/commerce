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

/** "2026-09-26" → "26.09." for chart axes. */
export const dayMonth = (isoDay: string) => `${isoDay.slice(8, 10)}.${isoDay.slice(5, 7)}.`;
