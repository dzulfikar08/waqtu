import { diffDays, hijriDate, hijriMonthStart, type CivilDate } from "@waqtu/core";

export type ProgramPosition =
  /**
   * The program's Ramadhan has not come yet. `daysUntil` counts down only when it is the next one
   * (this Hijri year is the program's year); earlier years carry null.
   */
  | { kind: "before"; daysUntil: number | null }
  /** Inside the program's Ramadhan; `day` is the program day for today (1-based, at most `totalDays`). */
  | { kind: "during"; day: number }
  /** The program's Ramadhan is over, including any later Ramadhan (a different year's program). */
  | { kind: "after" };

const RAMADHAN = 9;

/**
 * Where `today` sits relative to the program's Ramadhan (`hijriYear`), with `hijriOffset` as the
 * user's moon-sighting correction. A Ramadhan of another Hijri year never counts as "during".
 */
export function programPosition(
  today: CivilDate,
  hijriOffset: number,
  program: { hijriYear: number; totalDays: number },
): ProgramPosition {
  const h = hijriDate(today, hijriOffset);
  if (h.year > program.hijriYear || (h.year === program.hijriYear && h.month > RAMADHAN)) {
    return { kind: "after" };
  }
  if (h.year === program.hijriYear && h.month === RAMADHAN) {
    return { kind: "during", day: Math.min(h.day, program.totalDays) };
  }
  if (h.year < program.hijriYear) return { kind: "before", daysUntil: null };
  const start = hijriMonthStart(program.hijriYear, RAMADHAN, hijriOffset);
  return { kind: "before", daysUntil: diffDays(today, start) };
}

/** First program day not yet completed, or null once all are. Used by "start early" and "continue". */
export function nextUncompletedDay(done: ReadonlySet<number>, totalDays: number): number | null {
  for (let day = 1; day <= totalDays; day++) if (!done.has(day)) return day;
  return null;
}
