import { Database } from "bun:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import { migrate } from "../../src/db/migrations";

/**
 * In-memory SQLite behind the slice of the expo-sqlite API the app's db modules use, so tests run
 * the real migrations and SQL. Methods take positional params like expo's variadic form.
 */
export function openTestDb(): Database {
  return new Database(":memory:");
}

export function asExpoDb(raw: Database): SQLiteDatabase {
  const api = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      raw.query(sql).run(...(params as never[]));
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) =>
      raw.query(sql).get(...(params as never[])) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) =>
      raw.query(sql).all(...(params as never[])),
    runSync: (sql: string, ...params: unknown[]) => {
      raw.query(sql).run(...(params as never[]));
    },
    getFirstSync: (sql: string, ...params: unknown[]) =>
      raw.query(sql).get(...(params as never[])) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await fn();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
    withExclusiveTransactionAsync: async (fn: (tx: unknown) => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await fn(api);
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return api as unknown as SQLiteDatabase;
}

/** A fully migrated in-memory database. */
export async function migratedDb(): Promise<{ raw: Database; db: SQLiteDatabase }> {
  const raw = openTestDb();
  const db = asExpoDb(raw);
  await migrate(db);
  return { raw, db };
}
