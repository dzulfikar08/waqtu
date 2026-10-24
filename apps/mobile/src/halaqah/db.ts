import type { SQLiteDatabase } from "expo-sqlite";

import { setEntry } from "../db/entries";
import { emitDataChanged } from "../db/events";
import type { DayKey } from "../mutabaah/dates";

/** Mutabaah item key a finished halaqah session is recorded under. */
export const HALAQAH_ITEM_ID = "halaqah";

export const MAX_REFLECTION = 4000;

/** Completed program days with the civil day each was marked. */
export async function getProgress(
  db: SQLiteDatabase,
  programId: string,
): Promise<Map<number, DayKey>> {
  const rows = await db.getAllAsync<{ day: number; completed_on: string }>(
    "SELECT day, completed_on FROM halaqah_progress WHERE program_id = ?",
    programId,
  );
  return new Map(rows.map((r) => [r.day, r.completed_on]));
}

/**
 * Marks a program day done and records the `halaqah` mutabaah entry for `completedOn` (the day the
 * user actually watched, which for catch-up is later than the program day). Marking again keeps
 * the first completion date.
 */
export async function completeDay(
  db: SQLiteDatabase,
  programId: string,
  day: number,
  completedOn: DayKey,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT OR IGNORE INTO halaqah_progress (program_id, day, completed_on) VALUES (?, ?, ?)",
      programId,
      day,
      completedOn,
    );
    const row = await db.getFirstAsync<{ completed_on: string }>(
      "SELECT completed_on FROM halaqah_progress WHERE program_id = ? AND day = ?",
      programId,
      day,
    );
    await setEntry(db, row?.completed_on ?? completedOn, HALAQAH_ITEM_ID, 1);
  });
  emitDataChanged();
}

/** Undoes a completion. The mutabaah entry is cleared only when no other session was finished that day. */
export async function uncompleteDay(
  db: SQLiteDatabase,
  programId: string,
  day: number,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ completed_on: string }>(
      "SELECT completed_on FROM halaqah_progress WHERE program_id = ? AND day = ?",
      programId,
      day,
    );
    if (!row) return;
    await db.runAsync(
      "DELETE FROM halaqah_progress WHERE program_id = ? AND day = ?",
      programId,
      day,
    );
    const left = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM halaqah_progress WHERE completed_on = ?",
      row.completed_on,
    );
    if ((left?.n ?? 0) === 0) await setEntry(db, row.completed_on, HALAQAH_ITEM_ID, 0);
  });
  emitDataChanged();
}

export async function getReflection(
  db: SQLiteDatabase,
  programId: string,
  day: number,
): Promise<string> {
  const row = await db.getFirstAsync<{ body: string }>(
    "SELECT body FROM halaqah_reflection WHERE program_id = ? AND day = ?",
    programId,
    day,
  );
  return row?.body ?? "";
}

/** Saves the reflection on this device only; empty text deletes it. */
export async function saveReflection(
  db: SQLiteDatabase,
  programId: string,
  day: number,
  text: string,
): Promise<void> {
  const body = text.trim().slice(0, MAX_REFLECTION);
  if (body === "") {
    await db.runAsync(
      "DELETE FROM halaqah_reflection WHERE program_id = ? AND day = ?",
      programId,
      day,
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO halaqah_reflection (program_id, day, body, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(program_id, day) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    programId,
    day,
    body,
    Date.now(),
  );
}
