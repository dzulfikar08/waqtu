/**
 * Finds the Gregorian day that starts a Hijri month, using the Umm al-Qura calendar
 * built into Intl. Indonesia declares the month at the Kemenag isbat session, which can
 * land one day away from the Umm al-Qura date, so callers must present this as an estimate.
 */

const DAY_MS = 86_400_000;
/** Indonesia has no daylight saving: Jakarta is UTC+7 all year. */
export const JAKARTA_OFFSET_HOURS = 7;

const hijriParts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function hijriOf(date: Date): { year: number; month: number; day: number } {
  const parts = hijriParts.formatToParts(date);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** UTC midnight of the first day of `month` in Hijri `year`, searched inside `[from, from + spanDays)`. */
export function firstOfHijriMonth(year: number, month: number, from: Date, spanDays = 400): Date {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  for (let i = 0; i < spanDays; i++) {
    const day = new Date(start + i * DAY_MS);
    const h = hijriOf(day);
    if (h.year === year && h.month === month && h.day === 1) return day;
  }
  throw new Error(
    `Hijri ${year}-${month}-01 not found within ${spanDays} days of ${from.toISOString()}`,
  );
}

/** Estimated 1 Ramadhan 1448 (Hijri month 9). Searches from Dec 2026, well before the expected date. */
export function ramadhan1448(): { date: Date; startsAtUtc: number } {
  const date = firstOfHijriMonth(1448, 9, new Date(Date.UTC(2026, 11, 1)));
  // Midnight at the start of that day in Jakarta, as an absolute instant.
  return { date, startsAtUtc: date.getTime() - JAKARTA_OFFSET_HOURS * 3_600_000 };
}
