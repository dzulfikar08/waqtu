import type { SQLiteDatabase } from "expo-sqlite";

import { emitDataChanged } from "../db/events";
import { lastDays, type DayKey } from "../mutabaah/dates";

/**
 * Muhasabah: a daily self-reflection journal, after the Mutabaah app's questions (two open questions, four 1–10 ratings,
 * an intention for tomorrow). Private: one row per day in `muhasabah` (migrations.ts), on this phone only. The sync
 * engine never reads the table and nothing here writes a mutabaah entry.
 */

export const RATING_ASPECTS = ["taqwa", "gratitude", "energy", "willingness"] as const;
export type RatingAspect = (typeof RATING_ASPECTS)[number];

export const TEXT_FIELDS = ["feelings", "newAction", "continueTomorrow"] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const MAX_TEXT = 4000;

export interface MuhasabahEntry {
  date: DayKey;
  feelings: string | null;
  newAction: string | null;
  taqwa: number | null;
  gratitude: number | null;
  energy: number | null;
  willingness: number | null;
  continueTomorrow: string | null;
}

/** The order the questions are asked in, as in the Mutabaah app. */
export const QUESTIONS: readonly (
  | { id: TextField; kind: "text" }
  | { id: RatingAspect; kind: "rating" }
)[] = [
  { id: "feelings", kind: "text" },
  { id: "newAction", kind: "text" },
  { id: "taqwa", kind: "rating" },
  { id: "gratitude", kind: "rating" },
  { id: "energy", kind: "rating" },
  { id: "willingness", kind: "rating" },
  { id: "continueTomorrow", kind: "text" },
];

/** Emoji per rating 1–10 and aspect, from the Mutabaah app's rating scales. */
export const RATING_EMOJI: Readonly<Record<RatingAspect, readonly string[]>> = {
  taqwa: ["😔", "😞", "😐", "🙂", "😊", "😌", "🤲", "✨", "🌟", "💫"],
  gratitude: ["😞", "😐", "🙂", "😊", "😌", "🙏", "🤲", "✨", "🌟", "💫"],
  energy: ["😴", "😪", "😑", "😐", "🙂", "😊", "😄", "😃", "⚡", "🔥"],
  willingness: ["😔", "😞", "😐", "🤔", "🙂", "😊", "😄", "😃", "🔥", "💪"],
};

export function emptyEntry(date: DayKey): MuhasabahEntry {
  return {
    date,
    feelings: null,
    newAction: null,
    taqwa: null,
    gratitude: null,
    energy: null,
    willingness: null,
    continueTomorrow: null,
  };
}

/** A rating within 1–10, or null. */
export function cleanRating(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX
    ? value
    : null;
}

/** Trimmed text, capped; blank is null. */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed.slice(0, MAX_TEXT);
}

export function cleanEntry(entry: MuhasabahEntry): MuhasabahEntry {
  return {
    date: entry.date,
    feelings: cleanText(entry.feelings),
    newAction: cleanText(entry.newAction),
    taqwa: cleanRating(entry.taqwa),
    gratitude: cleanRating(entry.gratitude),
    energy: cleanRating(entry.energy),
    willingness: cleanRating(entry.willingness),
    continueTomorrow: cleanText(entry.continueTomorrow),
  };
}

export function hasContent(entry: MuhasabahEntry): boolean {
  return (
    TEXT_FIELDS.some((field) => cleanText(entry[field]) !== null) ||
    RATING_ASPECTS.some((aspect) => cleanRating(entry[aspect]) !== null)
  );
}

/** How many of the seven questions are answered, 0 to 1. */
export function completion(entry: MuhasabahEntry): number {
  const answered =
    TEXT_FIELDS.filter((field) => cleanText(entry[field]) !== null).length +
    RATING_ASPECTS.filter((aspect) => cleanRating(entry[aspect]) !== null).length;
  return answered / QUESTIONS.length;
}

/** Mean of the ratings given, or null when none is. */
export function averageRating(entry: MuhasabahEntry): number | null {
  const ratings = RATING_ASPECTS.map((aspect) => cleanRating(entry[aspect])).filter(
    (r): r is number => r !== null,
  );
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

/**
 * The weeks of a calendar month, Monday first: each week is seven cells, a day key or null for the padding before the
 * 1st and after the last day. `month` is 1–12.
 */
export function monthWeeks(year: number, month: number): (DayKey | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (DayKey | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(
      `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

/** The month `delta` months after `year`/`month` (1–12). */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface TrendDay {
  date: DayKey;
  /** Mean rating of the day, null for a day without ratings. */
  average: number | null;
}

/** The `days` days ending `today`, oldest first, each with its mean rating. */
export function ratingTrend(
  entries: readonly MuhasabahEntry[],
  today: DayKey,
  days: number,
): TrendDay[] {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  return lastDays(today, days).map((date) => {
    const entry = byDate.get(date);
    return { date, average: entry ? averageRating(entry) : null };
  });
}

export interface TrendSummary {
  /** Days in the window with an entry. */
  daysWritten: number;
  /** Mean of the daily means, null without ratings. */
  average: number | null;
  /** Mean per aspect over the window. */
  aspects: Record<RatingAspect, number | null>;
  /** Mean of the later half minus the earlier half; null unless both halves have ratings. */
  change: number | null;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function summarizeTrend(
  entries: readonly MuhasabahEntry[],
  today: DayKey,
  days: number,
): TrendSummary {
  const window = new Set(lastDays(today, days));
  const inWindow = entries.filter((entry) => window.has(entry.date) && hasContent(entry));
  const trend = ratingTrend(inWindow, today, days);
  const averages = trend.map((day) => day.average);
  const half = Math.floor(days / 2);
  const earlier = mean(averages.slice(0, half).filter((a): a is number => a !== null));
  const later = mean(averages.slice(half).filter((a): a is number => a !== null));
  const aspectMean = (aspect: RatingAspect) =>
    mean(
      inWindow.map((entry) => cleanRating(entry[aspect])).filter((r): r is number => r !== null),
    );
  return {
    daysWritten: inWindow.length,
    average: mean(averages.filter((a): a is number => a !== null)),
    aspects: {
      taqwa: aspectMean("taqwa"),
      gratitude: aspectMean("gratitude"),
      energy: aspectMean("energy"),
      willingness: aspectMean("willingness"),
    },
    change: earlier !== null && later !== null ? later - earlier : null,
  };
}

interface Row {
  date: string;
  feelings: string | null;
  new_action: string | null;
  taqwa: number | null;
  gratitude: number | null;
  energy: number | null;
  willingness: number | null;
  continue_tomorrow: string | null;
}

const COLUMNS =
  "date, feelings, new_action, taqwa, gratitude, energy, willingness, continue_tomorrow";

function fromRow(row: Row): MuhasabahEntry {
  return {
    date: row.date,
    feelings: row.feelings,
    newAction: row.new_action,
    taqwa: row.taqwa,
    gratitude: row.gratitude,
    energy: row.energy,
    willingness: row.willingness,
    continueTomorrow: row.continue_tomorrow,
  };
}

export async function getMuhasabah(
  db: SQLiteDatabase,
  date: DayKey,
): Promise<MuhasabahEntry | null> {
  const row = await db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM muhasabah WHERE date = ?`, date);
  return row ? fromRow(row) : null;
}

/** Entries for the days in `[from, to]`, oldest first. */
export async function getMuhasabahBetween(
  db: SQLiteDatabase,
  from: DayKey,
  to: DayKey,
): Promise<MuhasabahEntry[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM muhasabah WHERE date >= ? AND date <= ? ORDER BY date`,
    from,
    to,
  );
  return rows.map(fromRow);
}

/** Saves a day's reflection (cleaned); an entry with nothing in it deletes the day instead. Returns what was kept. */
export async function saveMuhasabah(
  db: SQLiteDatabase,
  entry: MuhasabahEntry,
  now: number = Date.now(),
): Promise<MuhasabahEntry | null> {
  const clean = cleanEntry(entry);
  if (!hasContent(clean)) {
    await deleteMuhasabah(db, clean.date);
    return null;
  }
  await db.runAsync(
    `INSERT INTO muhasabah (${COLUMNS}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       feelings = excluded.feelings,
       new_action = excluded.new_action,
       taqwa = excluded.taqwa,
       gratitude = excluded.gratitude,
       energy = excluded.energy,
       willingness = excluded.willingness,
       continue_tomorrow = excluded.continue_tomorrow,
       updated_at = excluded.updated_at`,
    clean.date,
    clean.feelings,
    clean.newAction,
    clean.taqwa,
    clean.gratitude,
    clean.energy,
    clean.willingness,
    clean.continueTomorrow,
    now,
    now,
  );
  emitDataChanged();
  return clean;
}

export async function deleteMuhasabah(db: SQLiteDatabase, date: DayKey): Promise<void> {
  await db.runAsync("DELETE FROM muhasabah WHERE date = ?", date);
  emitDataChanged();
}
