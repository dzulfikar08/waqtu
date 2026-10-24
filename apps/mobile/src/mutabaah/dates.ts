/** A civil calendar day as `YYYY-MM-DD`. Entries, streaks and sync all key on it. */
export type DayKey = string;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DAY = 86_400_000;

function utcMs(day: DayKey): number {
  const m = DAY_KEY.exec(day);
  if (!m) throw new Error(`Invalid day key: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false;
  const m = DAY_KEY.exec(value);
  if (!m) return false;
  const d = new Date(utcMs(value));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function format(ms: number): DayKey {
  const d = new Date(ms);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function addDays(day: DayKey, n: number): DayKey {
  return format(utcMs(day) + n * MS_DAY);
}

/** `a - b` in whole days. */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((utcMs(a) - utcMs(b)) / MS_DAY);
}

export function civilOf(day: DayKey): { year: number; month: number; day: number } {
  const m = DAY_KEY.exec(day);
  if (!m) throw new Error(`Invalid day key: ${day}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** The civil day an instant falls on in `timeZone` (device zone when omitted). */
export function dayKeyInZone(instant: Date, timeZone?: string): DayKey {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}`;
}

/** The `count` days ending at `end`, oldest first. */
export function lastDays(end: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - (count - 1)));
}
