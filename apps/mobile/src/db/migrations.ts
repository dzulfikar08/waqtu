import type { SQLiteDatabase } from "expo-sqlite";

import { RAMADHAN_MIGRATION } from "@/ramadhan/migrations";

export const DATABASE_NAME = "waqtu.db";

/**
 * Ordered schema migrations. `PRAGMA user_version` holds the number of migrations already applied, so
 * entry `i` upgrades a database from version `i` to `i + 1`. Never edit a shipped entry; append.
 */
export const MIGRATIONS: readonly (readonly string[])[] = [
  // 1: app settings (key/value), e.g. the chosen language.
  ["CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)"],
  // 2: Ramadhan daily checks, khatam plan and log, qadha ledger.
  RAMADHAN_MIGRATION,
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
