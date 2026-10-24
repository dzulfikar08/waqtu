import type { SQLiteDatabase } from "expo-sqlite";

/** Keys in the shared `settings` table that belong to the Ramadhan features. */
export const KEYS = {
  liveCountdown: "ramadhan.liveCountdown",
  liveActivityId: "ramadhan.liveActivityId",
  zakatReminder: "ramadhan.zakatReminder",
  zakatMembers: "ramadhan.zakat.members",
  zakatMode: "ramadhan.zakat.mode",
  zakatPrice: "ramadhan.zakat.pricePerKg",
  zakatCash: "ramadhan.zakat.cashPerPerson",
  fidyahMode: "ramadhan.fidyah.mode",
  fidyahPrice: "ramadhan.fidyah.pricePerKg",
  fidyahCash: "ramadhan.fidyah.cashPerDay",
  fidyahKg: "ramadhan.fidyah.kg",
} as const;

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

/** Stores `value`; null deletes the key. */
export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string | null,
): Promise<void> {
  if (value === null) await db.runAsync("DELETE FROM settings WHERE key = ?", key);
  else await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value);
}
