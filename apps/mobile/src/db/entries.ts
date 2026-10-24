import type { SQLiteDatabase } from "expo-sqlite";

import { emitDataChanged } from "./events";
import type { DayKey } from "../mutabaah/dates";
import { markedFromNotification } from "../mutabaah/items";
import type { EntryLike } from "../mutabaah/streak";

interface Row {
  date: string;
  item_id: string;
  value: number;
}

const toEntry = (r: Row): EntryLike => ({ date: r.date, itemId: r.item_id, value: r.value });

/** Entries for the days in `[from, to]`, including zero values. */
export async function getEntriesBetween(
  db: SQLiteDatabase,
  from: DayKey,
  to: DayKey,
): Promise<EntryLike[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT date, item_id, value FROM entries WHERE date >= ? AND date <= ?",
    from,
    to,
  );
  return rows.map(toEntry);
}

/** Recorded (non-zero) entries from `from` on: what streaks are computed from. */
export async function getRecordedSince(db: SQLiteDatabase, from: DayKey): Promise<EntryLike[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT date, item_id, value FROM entries WHERE date >= ? AND value > 0",
    from,
  );
  return rows.map(toEntry);
}

/**
 * Records a value and queues it for sync. The stamp is `now`, but never older than the stored
 * one, so an edit on a phone whose clock lags a synced device still wins its own row.
 */
export async function setEntry(
  db: SQLiteDatabase,
  date: DayKey,
  itemId: string,
  value: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(date, item_id) DO UPDATE SET
       value = excluded.value,
       updated_at = MAX(excluded.updated_at, entries.updated_at + 1),
       dirty = 1`,
    date,
    itemId,
    value,
    Date.now(),
  );
  emitDataChanged();
}

/** The "Sudah sholat" notification action: records the prayer as done, never downgrading a richer entry. */
export async function recordPrayerDone(
  db: SQLiteDatabase,
  date: DayKey,
  prayer: string,
  onTime: boolean,
): Promise<void> {
  const row = await db.getFirstAsync<{ value: number }>(
    "SELECT value FROM entries WHERE date = ? AND item_id = ?",
    date,
    prayer,
  );
  const current = row?.value ?? 0;
  const next = markedFromNotification(current, onTime);
  if (next !== current) await setEntry(db, date, prayer, next);
}
