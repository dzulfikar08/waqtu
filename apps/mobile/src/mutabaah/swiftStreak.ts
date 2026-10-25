/**
 * Reads the streak summary the old Swift iPhone / Mac app kept in iCloud key-value storage
 * (`apps/apple/shared/Core/StreakSyncManager.swift`, key `sharedStreakData`) and turns what can be
 * rebuilt from it into checklist entries.
 *
 * The value is `JSONEncoder().encode(StreakData)` with Foundation's default strategies, so
 * `lastUpdated` is a number of seconds since 2001-01-01T00:00:00Z (`.deferredToDate`).
 *
 * Only the 7-day `weeklyGrid` is per day, and it says how many prayers were done, not which:
 * - `complete` (all five prayed or prayed late) becomes the five fardhu marked done. Not "on time":
 *   the Swift app counted late prayers too.
 * - `partial`, `missed` and `empty` add nothing; a partial day does not say which prayers.
 * `currentStreak` and `bestStreak` are totals with no days behind them, so they cannot be rebuilt;
 * the streak here is recomputed from entries and starts from the imported days.
 */
import { addDays, civilOf, dayKeyInZone, isDayKey, type DayKey } from "./dates";
import { FARDH_IDS, FLAG } from "./items";

export const SWIFT_STREAK_KEY = "sharedStreakData";

/** 2001-01-01T00:00:00Z in epoch ms: the reference date of Swift's `Date`. */
const APPLE_EPOCH_MS = 978_307_200_000;

const STATUSES = ["complete", "partial", "missed", "empty"] as const;
export type SwiftDotStatus = (typeof STATUSES)[number];

export interface SwiftDayDot {
  /** `yyyy-MM-dd`; the Mac app writes "" here, so days are usually placed by position. */
  date: string;
  /** English short weekday ("Mon"), used to check the placement. */
  label: string;
  status: SwiftDotStatus;
  isToday: boolean;
}

export interface SwiftStreak {
  currentStreak: number;
  bestStreak: number;
  todayPrayed: number;
  todayTotal: number;
  /** Oldest first, ending with the day `lastUpdated` falls on. */
  weeklyGrid: SwiftDayDot[];
  lastUpdated: Date;
}

export interface ImportedEntry {
  date: DayKey;
  itemId: string;
  value: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function decodeDot(raw: unknown): SwiftDayDot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { date, label, status, isToday } = raw as Record<string, unknown>;
  if (typeof date !== "string" || typeof label !== "string" || typeof isToday !== "boolean") {
    return null;
  }
  if (!STATUSES.includes(status as SwiftDotStatus)) return null;
  return { date, label, status: status as SwiftDotStatus, isToday };
}

/** The stored JSON → summary; null when it is not what `StreakData` encodes (Swift's decoder would fail too). */
export function decodeSwiftStreak(raw: string): SwiftStreak | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const { currentStreak, bestStreak, todayPrayed, todayTotal, weeklyGrid, lastUpdated } =
    data as Record<string, unknown>;
  if (!isInt(currentStreak) || !isInt(bestStreak) || !isInt(todayPrayed) || !isInt(todayTotal)) {
    return null;
  }
  if (typeof lastUpdated !== "number" || !Number.isFinite(lastUpdated)) return null;
  if (!Array.isArray(weeklyGrid)) return null;
  const dots: SwiftDayDot[] = [];
  for (const entry of weeklyGrid) {
    const dot = decodeDot(entry);
    if (!dot) return null;
    dots.push(dot);
  }
  return {
    currentStreak,
    bestStreak,
    todayPrayed,
    todayTotal,
    weeklyGrid: dots,
    lastUpdated: new Date(APPLE_EPOCH_MS + lastUpdated * 1000),
  };
}

function weekdayOf(day: DayKey): string {
  const { year, month, day: d } = civilOf(day);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, d)).getUTCDay()];
}

/**
 * The grid's days with their dates. A dot's own date is used when it has one; otherwise it is placed
 * by position, the `isToday` dot (or the last one) being the day `lastUpdated` falls on in `timeZone`
 * (device zone when omitted). If any placed day disagrees with its weekday label the placement is
 * wrong (another time zone, an unexpected grid) and nothing is returned rather than the wrong days.
 */
export function swiftGridDays(
  data: SwiftStreak,
  timeZone?: string,
): { date: DayKey; status: SwiftDotStatus }[] {
  const grid = data.weeklyGrid;
  const todays = grid.flatMap((dot, i) => (dot.isToday ? [i] : []));
  const anchorIndex = todays.length === 1 ? todays[0] : grid.length - 1;
  const anchor = dayKeyInZone(data.lastUpdated, timeZone);
  const days: { date: DayKey; status: SwiftDotStatus }[] = [];
  for (const [i, dot] of grid.entries()) {
    const date = isDayKey(dot.date) ? dot.date : addDays(anchor, i - anchorIndex);
    if (WEEKDAYS.includes(dot.label) && weekdayOf(date) !== dot.label) return [];
    days.push({ date, status: dot.status });
  }
  return days;
}

/** Entries the summary vouches for: the five fardhu, marked done, on every `complete` day. */
export function swiftImportEntries(data: SwiftStreak, timeZone?: string): ImportedEntry[] {
  return swiftGridDays(data, timeZone)
    .filter((day) => day.status === "complete")
    .flatMap((day) => FARDH_IDS.map((itemId) => ({ date: day.date, itemId, value: FLAG.DONE })));
}
