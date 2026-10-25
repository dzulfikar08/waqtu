import { decodeSwiftStreak, swiftImportEntries } from "../mutabaah/swiftStreak";
import type { SqlDb } from "../sync/sqliteStore";

/** Device-local marker: "done" once the import ran, else the number of launches that found nothing yet. */
export const SWIFT_IMPORT_KEY = "migration.swiftStreak";

/**
 * Launches that may find the iCloud value missing before giving up. iCloud key-value storage syncs
 * in the background, so a fresh install can read nothing on its first launch and the value on a later one.
 */
export const SWIFT_IMPORT_TRIES = 3;

/**
 * `updated_at` of imported rows. Older than any real edit, so on sign-in a row the account already
 * has for that day (for example from the Mac app's sync) wins over the import instead of being
 * downgraded to "done".
 */
export const SWIFT_IMPORT_STAMP = 1;

/**
 * One-time import of the old Swift app's streak summary (see `mutabaah/swiftStreak.ts`). `read`
 * returns the raw `sharedStreakData` value, or null when there is none (yet). Rows already on this
 * phone are never touched. Imported rows are dirty, so they are uploaded at the next sync. Returns
 * the number of rows added; 0 when there was nothing to add or the import already ran.
 */
export async function importSwiftStreak(
  db: SqlDb,
  read: () => string | null,
  timeZone?: string,
): Promise<number> {
  const marker = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    SWIFT_IMPORT_KEY,
  );
  if (marker?.value === "done") return 0;

  const raw = read();
  if (raw === null) {
    const tries = (Number(marker?.value) || 0) + 1;
    await setMarker(db, tries >= SWIFT_IMPORT_TRIES ? "done" : String(tries));
    return 0;
  }

  const data = decodeSwiftStreak(raw);
  const entries = data ? swiftImportEntries(data, timeZone) : [];
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const e of entries) {
      const existing = await db.getFirstAsync<{ value: number }>(
        "SELECT value FROM entries WHERE date = ? AND item_id = ?",
        e.date,
        e.itemId,
      );
      if (existing) continue;
      await db.runAsync(
        "INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES (?, ?, ?, ?, 1)",
        e.date,
        e.itemId,
        e.value,
        SWIFT_IMPORT_STAMP,
      );
      added++;
    }
    await setMarker(db, "done");
  });
  return added;
}

async function setMarker(db: SqlDb, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    SWIFT_IMPORT_KEY,
    value,
  );
}
