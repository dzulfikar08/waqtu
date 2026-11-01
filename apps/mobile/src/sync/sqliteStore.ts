import { CLOUD_CURSOR_KEY, CLOUD_USER_KEY } from "../ibadah/cloud";
import type { SyncEntry, SyncSetting } from "../mutabaah/merge";
import { isSyncedSettingKey } from "../mutabaah/syncKeys";
import type { SyncStore } from "../mutabaah/syncEngine";

/** The slice of expo-sqlite's database the sync store needs, so tests can run it on bun:sqlite. */
export type SqlParam = string | number | null;
export interface SqlDb {
  getFirstAsync<T>(sql: string, ...params: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  runAsync(sql: string, ...params: SqlParam[]): Promise<unknown>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

interface EntryRow {
  date: string;
  item_id: string;
  value: number;
  updated_at: number;
}
interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

const entryOf = (r: EntryRow): SyncEntry => ({
  date: r.date,
  itemId: r.item_id,
  value: r.value,
  updatedAt: r.updated_at,
});
const settingOf = (r: SettingRow): SyncSetting => ({
  key: r.key,
  value: r.value,
  updatedAt: r.updated_at,
});

export const cursorKey = (userId: string) => `sync.cursor.${userId}`;
export const SYNC_USER_KEY = "sync.user";

/** SQLite replica for the sync engine. Server rows are stored clean; the user's own writes stay `dirty`. */
export function createSqliteStore(db: SqlDb, userId: string): SyncStore {
  return {
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
    async getCursor() {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        cursorKey(userId),
      );
      return row?.value ?? "0";
    },
    async setCursor(cursor) {
      await db.runAsync(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        cursorKey(userId),
        cursor,
      );
    },
    async getEntry(date, itemId) {
      const row = await db.getFirstAsync<EntryRow>(
        "SELECT date, item_id, value, updated_at FROM entries WHERE date = ? AND item_id = ?",
        date,
        itemId,
      );
      return row ? entryOf(row) : undefined;
    },
    async getSetting(key) {
      const row = await db.getFirstAsync<SettingRow>(
        "SELECT key, value, updated_at FROM settings WHERE key = ?",
        key,
      );
      return row ? settingOf(row) : undefined;
    },
    async putRemoteEntry(e) {
      await db.runAsync(
        `INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(date, item_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 0`,
        e.date,
        e.itemId,
        e.value,
        e.updatedAt,
      );
    },
    async putRemoteSetting(s) {
      if (!isSyncedSettingKey(s.key)) return;
      await db.runAsync(
        `INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 0)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, dirty = 0`,
        s.key,
        s.value,
        s.updatedAt,
      );
    },
    async dirtyEntries() {
      const rows = await db.getAllAsync<EntryRow>(
        "SELECT date, item_id, value, updated_at FROM entries WHERE dirty = 1 ORDER BY updated_at",
      );
      return rows.map(entryOf);
    },
    async dirtySettings() {
      const rows = await db.getAllAsync<SettingRow>(
        "SELECT key, value, updated_at FROM settings WHERE dirty = 1 ORDER BY updated_at",
      );
      return rows.filter((r) => isSyncedSettingKey(r.key)).map(settingOf);
    },
    async markEntriesClean(entries) {
      await db.withTransactionAsync(async () => {
        for (const e of entries) {
          await db.runAsync(
            "UPDATE entries SET dirty = 0 WHERE date = ? AND item_id = ? AND updated_at = ?",
            e.date,
            e.itemId,
            e.updatedAt,
          );
        }
      });
    },
    async markSettingsClean(settings) {
      await db.withTransactionAsync(async () => {
        for (const s of settings) {
          await db.runAsync(
            "UPDATE settings SET dirty = 0 WHERE key = ? AND updated_at = ?",
            s.key,
            s.updatedAt,
          );
        }
      });
    },
  };
}

/**
 * Detaches this phone from a deleted account: the cursors and the account marker go, the data stays
 * and is marked unsynced. The next sign-in then adopts and uploads it as a first sign-in does,
 * instead of treating it as another person's. The muhasabah cloud switch belonged to the deleted
 * account, so it goes too; the journal stays on the phone, queued again for a later opt-in.
 */
export async function forgetAccount(db: SqlDb): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM settings WHERE key LIKE 'sync.cursor.%'");
    await db.runAsync("DELETE FROM settings WHERE key = ?", SYNC_USER_KEY);
    await db.runAsync("DELETE FROM settings WHERE key IN (?, ?)", CLOUD_USER_KEY, CLOUD_CURSOR_KEY);
    await db.runAsync("UPDATE entries SET dirty = 1");
    await db.runAsync("UPDATE muhasabah SET dirty = 1");
    const keys = await db.getAllAsync<{ key: string }>("SELECT key FROM settings");
    for (const { key } of keys) {
      if (isSyncedSettingKey(key)) {
        await db.runAsync("UPDATE settings SET dirty = 1 WHERE key = ?", key);
      }
    }
  });
}

/**
 * Local data follows the account on this device, except when a different account signs in: then the
 * previous account's rows and every sync cursor are cleared (the rows live on its server copy, and
 * switching back re-pulls them in full) so nothing is uploaded to the wrong account. The first sign-in keeps what was recorded offline and uploads it.
 */
export async function prepareAccount(db: SqlDb, userId: string): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    SYNC_USER_KEY,
  );
  if (row?.value === userId) return;
  await db.withTransactionAsync(async () => {
    // Cursors belong to the account they were issued for: a stale one would skip rows on a re-pull.
    await db.runAsync("DELETE FROM settings WHERE key LIKE 'sync.cursor.%'");
    if (row) {
      await db.runAsync("DELETE FROM entries");
      const keys = await db.getAllAsync<{ key: string }>("SELECT key FROM settings");
      for (const { key } of keys) {
        if (isSyncedSettingKey(key)) await db.runAsync("DELETE FROM settings WHERE key = ?", key);
      }
    }
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      SYNC_USER_KEY,
      userId,
    );
  });
}
