import type { SQLiteDatabase } from "expo-sqlite";

import { HAFALAN_MARKS_MIGRATION, HAFALAN_MIGRATION } from "@/hafalan/migrations";
import { HALAQAH_MIGRATION, HALAQAH_VOICE_MIGRATION } from "@/halaqah/migrations";
import { RAMADHAN_MIGRATION } from "@/ramadhan/migrations";

export const DATABASE_NAME = "waqtu.db";

/**
 * Ordered schema migrations. `PRAGMA user_version` holds the number of migrations already applied, so
 * entry `i` upgrades a database from version `i` to `i + 1`. Never edit a shipped entry; append.
 */
export const MIGRATIONS: readonly (readonly string[])[] = [
  // 1: app settings (key/value), e.g. the chosen language.
  ["CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)"],
  // 2: mutabaah checklist entries (one row per day + item) and sync bookkeeping. `dirty` marks rows the
  // server has not seen yet; `updated_at` (epoch ms) drives last-write-wins on both sides.
  [
    `CREATE TABLE entries (
      date TEXT NOT NULL,
      item_id TEXT NOT NULL,
      value INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (date, item_id)
    )`,
    "CREATE INDEX entries_dirty ON entries (dirty) WHERE dirty = 1",
    "ALTER TABLE settings ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0",
  ],
  // 3: Ramadhan daily checks, khatam plan and log, qadha ledger.
  RAMADHAN_MIGRATION,
  // 4: halaqah program progress and private reflections.
  HALAQAH_MIGRATION,
  // 5: hafalan plan, per-unit spaced-repetition state and self-listen recordings.
  HAFALAN_MIGRATION,
  // 6: private halaqah voice reflections (file name and length per program day).
  HALAQAH_VOICE_MIGRATION,
  // 7: ayah marks on hafalan recordings, so playback can follow the ayah being recited.
  HAFALAN_MARKS_MIGRATION,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  if (current > MIGRATIONS.length) {
    throw new Error(`Database is version ${current}, this app knows ${MIGRATIONS.length}`);
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const statement of MIGRATIONS[version]) await tx.execAsync(statement);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
