import type { CivilDate } from "./prayer";

export interface HijriDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  monthName: string;
  calendar: "islamic-umalqura" | "islamic-civil";
}

function supports(calendar: string): boolean {
  try {
    return new Intl.DateTimeFormat("en-u-ca-" + calendar).resolvedOptions().calendar === calendar;
  } catch {
    return false;
  }
}

const CALENDAR: HijriDate["calendar"] = supports("islamic-umalqura")
  ? "islamic-umalqura"
  : "islamic-civil";

/**
 * Hijri date for a civil date, shifted by `dayOffset` days (user moon-sighting correction,
 * e.g. -1 for Indonesia when it lags Umm al-Qura). Uses Intl islamic-umalqura, falling back
 * to islamic-civil when the runtime lacks it.
 */
export function hijriDate(date: CivilDate, dayOffset = 0): HijriDate {
  // Noon UTC avoids any zone edge: only the civil Y-M-D matters.
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day + dayOffset, 12));
  const fmt = new Intl.DateTimeFormat("en-u-ca-" + CALENDAR, {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(instant);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const monthName = new Intl.DateTimeFormat("en-u-ca-" + CALENDAR, {
    timeZone: "UTC",
    month: "long",
  }).format(instant);
  return { year: num("year"), month: num("month"), day: num("day"), monthName, calendar: CALENDAR };
}
