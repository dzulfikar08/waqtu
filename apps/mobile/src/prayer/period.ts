import { addDays, dayKeyInZone } from "../mutabaah/dates";

import type { Location, PrayerSettings } from "./config";
import { timesFor } from "./schedule";

/** Part of the day, from the prayer times: Fajr to sunrise, sunrise to Dhuhr, and so on until the next Fajr. */
export type DayPeriod = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

const ORDER: readonly DayPeriod[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export interface PeriodSpan {
  period: DayPeriod;
  /** When this part of the day began (its prayer time). */
  start: Date;
  /** When the next one begins. */
  end: Date;
  /** The part of the day that follows. */
  next: DayPeriod;
}

/**
 * The part of the day `now` falls in, with its bounds. Looks at yesterday, today and tomorrow so the night (Isha to the
 * next Fajr) spans midnight. Null only where the times do not occur (polar latitudes).
 */
export function periodAt(
  settings: PrayerSettings,
  location: Location,
  now: Date,
): PeriodSpan | null {
  const today = dayKeyInZone(now, location.timeZone);
  const marks: { period: DayPeriod; at: Date }[] = [];
  for (const day of [addDays(today, -1), today, addDays(today, 1)]) {
    const { times } = timesFor(settings, location, day);
    for (const period of ORDER) {
      const at = times[period];
      if (at) marks.push({ period, at });
    }
  }
  const t = now.getTime();
  for (let i = 0; i < marks.length - 1; i++) {
    if (marks[i].at.getTime() <= t && t < marks[i + 1].at.getTime()) {
      const following = marks[i + 1];
      return {
        period: marks[i].period,
        start: marks[i].at,
        end: following.at,
        next: following.period,
      };
    }
  }
  return null;
}

/** How far through `span` `now` is, from 0 to 1. */
export function periodProgress(span: PeriodSpan, now: Date): number {
  const total = span.end.getTime() - span.start.getTime();
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - span.start.getTime()) / total));
}

/** A rough part of the day from the phone's clock, for when there is no location yet and so no prayer times. */
export function periodForHour(hour: number): DayPeriod {
  if (hour < 4) return "isha";
  if (hour < 6) return "fajr";
  if (hour < 11) return "sunrise";
  if (hour < 15) return "dhuhr";
  if (hour < 18) return "asr";
  if (hour < 19) return "maghrib";
  return "isha";
}
