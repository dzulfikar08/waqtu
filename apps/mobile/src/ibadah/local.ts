import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Device-local state of the Ibadah tools (tasbih count, reader progress, favourites) in the `settings` table, stored
 * clean (`dirty = 0`) under `ibadah.*` keys, which are not synced keys, so it stays on the phone. Written quietly: a
 * tasbih tap must not make every open screen re-read the checklist, so no data-changed event is sent.
 */
export async function writeLocal(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 0) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 0",
    key,
    value,
    Date.now(),
  );
}
