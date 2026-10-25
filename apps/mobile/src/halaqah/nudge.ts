import { addDays, civilParts, type CivilDate } from "@waqtu/core";

import { dayKeyInZone, type DayKey } from "../mutabaah/dates";
import { nextUncompletedDay, programPosition } from "./schedule";

/** Device-local setting holding the daily nudge time as `HH:MM`; absent means the nudge is off. */
export const NUDGE_KEY = "halaqah.nudge";

export interface NudgeTime {
  hour: number;
  minute: number;
}

/** Suggested when the user turns the nudge on: before Maghrib, since day N's night is night N+1. */
export const DEFAULT_NUDGE_TIME: NudgeTime = { hour: 16, minute: 0 };

const NUDGE_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseNudgeTime(raw: string | null): NudgeTime | null {
  const m = raw === null ? null : NUDGE_TIME.exec(raw);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

export function formatNudgeTime({ hour, minute }: NudgeTime): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Milliseconds `zone` is ahead of UTC at `instant` (seconds ignored). */
function zoneOffsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return wall - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** The instant the wall clock in `zone` reads `time` on `date`. */
function instantAt(date: CivilDate, time: NudgeTime, zone: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  let at = wall - zoneOffsetMs(new Date(wall), zone);
  at = wall - zoneOffsetMs(new Date(at), zone);
  return new Date(at);
}

export interface PlannedNudge {
  at: Date;
  /** `today`: the program day for that date; `continue`: the first day not yet done (catch-up). */
  kind: "today" | "continue";
  day: number;
}

/**
 * Daily nudges for the next `days` days at `time` in `zone`. Gentle by design: one a day at most,
 * none on a day a session was already finished, none once every day is done or the program's
 * Ramadhan is over, and before Ramadhan only for someone who started early. A day whose talk is
 * already done points to the first one still open, never at what was missed.
 */
export function planNudges(input: {
  now: Date;
  zone: string;
  time: NudgeTime;
  hijriOffset: number;
  program: { hijriYear: number; totalDays: number };
  done: ReadonlyMap<number, DayKey>;
  days: number;
}): PlannedNudge[] {
  const { now, zone, time, program, done } = input;
  const next = nextUncompletedDay(new Set(done.keys()), program.totalDays);
  if (next === null) return [];
  const finishedOn = new Set(done.values());
  const today = civilParts(now, zone);
  const nudges: PlannedNudge[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addDays(today, i);
    const at = instantAt(date, time, zone);
    if (at.getTime() <= now.getTime() || finishedOn.has(dayKeyInZone(at, zone))) continue;
    const position = programPosition(date, input.hijriOffset, program);
    if (position.kind === "after") break;
    if (position.kind === "during" && !done.has(position.day)) {
      nudges.push({ at, kind: "today", day: position.day });
    } else if (position.kind === "during" || done.size > 0) {
      nudges.push({ at, kind: "continue", day: next });
    }
  }
  return nudges;
}
