import {
  currentOrNextRamadhan,
  diffDays,
  hijriDate,
  ramadhanDay,
  type CivilDate,
} from "@waqtu/core";

export type ProgramPosition =
  /** Ramadhan has not started this Hijri year. */
  | { kind: "before"; daysUntil: number }
  /** Inside Ramadhan; `day` is the program day for today (1-based, at most `totalDays`). */
  | { kind: "during"; day: number }
  /** Ramadhan of this Hijri year is over. */
  | { kind: "after" };

const RAMADHAN = 9;

/** Where `today` sits relative to Ramadhan, with `hijriOffset` as the user's moon-sighting correction. */
export function programPosition(
  today: CivilDate,
  hijriOffset: number,
  totalDays: number,
): ProgramPosition {
  const day = ramadhanDay(today, hijriOffset);
  if (day !== null) return { kind: "during", day: Math.min(day, totalDays) };
  if (hijriDate(today, hijriOffset).month > RAMADHAN) return { kind: "after" };
  const { start } = currentOrNextRamadhan(today, hijriOffset);
  return { kind: "before", daysUntil: diffDays(today, start) };
}

/** First program day not yet completed, or null once all are. Used by "start early" and "continue". */
export function nextUncompletedDay(done: ReadonlySet<number>, totalDays: number): number | null {
  for (let day = 1; day <= totalDays; day++) if (!done.has(day)) return day;
  return null;
}
