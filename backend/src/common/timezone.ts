/** The business runs in Montenegro: "today", report days and document dates use local time. */
export const appTimezone = () => process.env.APP_TIMEZONE || 'Europe/Podgorica';

/** Calendar date of an instant in the business time zone: { year, month, day } as strings. */
export function localParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** YYYY-MM-DD in the business time zone. */
export function localIsoDate(d: Date = new Date()) {
  const { year, month, day } = localParts(d);
  return `${year}-${month}-${day}`;
}

export const localYear = (d: Date) => Number(localParts(d).year);

/** Adds whole days to a YYYY-MM-DD date string. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The instant a local calendar day (YYYY-MM-DD) begins in the business time zone. */
export function localDayStart(isoDate: string) {
  const utcMidnight = new Date(`${isoDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: appTimezone(),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcMidnight);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  // Local wall clock at UTC midnight, minus UTC midnight = the zone's offset then.
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return new Date(utcMidnight.getTime() - (wall - utcMidnight.getTime()));
}
