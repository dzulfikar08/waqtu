import type { SQLiteDatabase } from "expo-sqlite";

export const DAILY_KEYS = ["puasa", "tarawih", "tadarus", "itikaf"] as const;
export type DailyKey = (typeof DAILY_KEYS)[number];
export type DailyChecks = Record<DailyKey, boolean>;

const EMPTY_DAILY: DailyChecks = { puasa: false, tarawih: false, tadarus: false, itikaf: false };

export async function getDaily(db: SQLiteDatabase, date: string): Promise<DailyChecks> {
  const row = await db.getFirstAsync<Record<DailyKey, number>>(
    "SELECT puasa, tarawih, tadarus, itikaf FROM ramadhan_daily WHERE date = ?",
    date,
  );
  if (!row) return { ...EMPTY_DAILY };
  return {
    puasa: row.puasa === 1,
    tarawih: row.tarawih === 1,
    tadarus: row.tadarus === 1,
    itikaf: row.itikaf === 1,
  };
}

export async function setDaily(
  db: SQLiteDatabase,
  date: string,
  key: DailyKey,
  value: boolean,
): Promise<void> {
  // `key` is one of DAILY_KEYS, never user text, so interpolating the column name is safe.
  if (!DAILY_KEYS.includes(key)) throw new Error(`Unknown daily key ${key}`);
  await db.runAsync(
    `INSERT INTO ramadhan_daily (date, ${key}) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET ${key} = excluded.${key}`,
    date,
    value ? 1 : 0,
  );
}

/** Days with `key` checked between two ISO dates, inclusive. */
export async function countDaily(
  db: SQLiteDatabase,
  key: DailyKey,
  from: string,
  to: string,
): Promise<number> {
  if (!DAILY_KEYS.includes(key)) throw new Error(`Unknown daily key ${key}`);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ramadhan_daily WHERE ${key} = 1 AND date BETWEEN ? AND ?`,
    from,
    to,
  );
  return row?.n ?? 0;
}

export interface StoredKhatam {
  target: number;
  startDate: string;
}

export async function getKhatam(
  db: SQLiteDatabase,
  hijriYear: number,
): Promise<StoredKhatam | null> {
  const row = await db.getFirstAsync<{ target: number; start_date: string }>(
    "SELECT target, start_date FROM ramadhan_khatam WHERE hijri_year = ?",
    hijriYear,
  );
  return row ? { target: row.target, startDate: row.start_date } : null;
}

export async function saveKhatam(
  db: SQLiteDatabase,
  hijriYear: number,
  target: number,
  startDate: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO ramadhan_khatam (hijri_year, target, start_date) VALUES (?, ?, ?)
     ON CONFLICT(hijri_year) DO UPDATE SET target = excluded.target`,
    hijriYear,
    target,
    startDate,
  );
}

export async function deleteKhatam(
  db: SQLiteDatabase,
  hijriYear: number,
  from: string,
  to: string,
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM ramadhan_khatam WHERE hijri_year = ?", hijriYear);
    await db.runAsync("DELETE FROM ramadhan_khatam_log WHERE date BETWEEN ? AND ?", from, to);
  });
}

/** Pages read on one day (absolute, replaces any earlier value for that day). */
export async function setPagesOn(db: SQLiteDatabase, date: string, pages: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO ramadhan_khatam_log (date, pages) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET pages = excluded.pages`,
    date,
    Math.max(0, Math.floor(pages)),
  );
}

export async function getPagesOn(db: SQLiteDatabase, date: string): Promise<number> {
  const row = await db.getFirstAsync<{ pages: number }>(
    "SELECT pages FROM ramadhan_khatam_log WHERE date = ?",
    date,
  );
  return row?.pages ?? 0;
}

/** Pages read on days from `from` up to but excluding `before`. */
export async function getPagesBefore(
  db: SQLiteDatabase,
  from: string,
  before: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(pages) AS total FROM ramadhan_khatam_log WHERE date >= ? AND date < ?",
    from,
    before,
  );
  return row?.total ?? 0;
}

export type QadhaKind = "owed" | "made_up";

export async function addQadha(
  db: SQLiteDatabase,
  kind: QadhaKind,
  count: number,
  date: string,
): Promise<void> {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("count must be >= 1");
  await db.runAsync(
    "INSERT INTO ramadhan_qadha (kind, count, date) VALUES (?, ?, ?)",
    kind,
    count,
    date,
  );
}

/** Undoes the most recent entry. */
export async function undoQadha(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("DELETE FROM ramadhan_qadha WHERE id = (SELECT MAX(id) FROM ramadhan_qadha)");
}

export interface QadhaTotals {
  owed: number;
  madeUp: number;
  /** Days still to make up (never below zero). */
  remaining: number;
}

export async function getQadhaTotals(db: SQLiteDatabase): Promise<QadhaTotals> {
  const rows = await db.getAllAsync<{ kind: QadhaKind; total: number }>(
    "SELECT kind, SUM(count) AS total FROM ramadhan_qadha GROUP BY kind",
  );
  const owed = rows.find((r) => r.kind === "owed")?.total ?? 0;
  const madeUp = rows.find((r) => r.kind === "made_up")?.total ?? 0;
  return { owed, madeUp, remaining: Math.max(0, owed - madeUp) };
}
