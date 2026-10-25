import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";

import { MIGRATIONS } from "../src/db/migrations";
import { setSyncedSetting } from "../src/db/settings";
import { addCustomItem, DEFAULT_ITEMS, parseItems, serializeItems } from "../src/mutabaah/items";
import { settingWins, type SyncEntry, type SyncSetting } from "../src/mutabaah/merge";
import { runSync, type PullPage, type SyncTransport } from "../src/mutabaah/syncEngine";
import { ITEMS_KEY } from "../src/mutabaah/syncKeys";
import {
  createSqliteStore,
  cursorKey,
  forgetAccount,
  prepareAccount,
  type SqlDb,
  type SqlParam,
} from "../src/sync/sqliteStore";
import { asExpoDb } from "./helpers/sqlite";

/** The real SQL and migrations on bun:sqlite, behind the same async surface as expo-sqlite. */
function openDb(): { db: SqlDb; sqlite: Database } {
  const sqlite = new Database(":memory:");
  for (const statements of MIGRATIONS) for (const sql of statements) sqlite.run(sql);
  const db: SqlDb = {
    getFirstAsync: async <T>(sql: string, ...p: SqlParam[]) =>
      (sqlite.query(sql).get(...p) as T | null) ?? null,
    getAllAsync: async <T>(sql: string, ...p: SqlParam[]) => sqlite.query(sql).all(...p) as T[],
    runAsync: async (sql, ...p) => {
      sqlite.query(sql).run(...p);
    },
    withTransactionAsync: async (task) => {
      sqlite.run("BEGIN");
      try {
        await task();
        sqlite.run("COMMIT");
      } catch (e) {
        sqlite.run("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, sqlite };
}

/** One change on the server, in rev order: an entry or a setting. */
type Change = { rev: number } & ({ entry: SyncEntry } | { setting: SyncSetting });

/** Per-user server data with the contract's rev cursor; entries and settings share one change log. */
class Server {
  private users = new Map<string, { rev: number; changes: Change[] }>();
  seed(
    userId: string,
    entries: Omit<SyncEntry, "updatedAt">[],
    settings: Omit<SyncSetting, "updatedAt">[] = [],
  ) {
    const user = { rev: 0, changes: [] as Change[] };
    for (const e of entries)
      user.changes.push({ entry: { ...e, updatedAt: 100 }, rev: ++user.rev });
    for (const s of settings) {
      user.changes.push({ setting: { ...s, updatedAt: 100 }, rev: ++user.rev });
    }
    this.users.set(userId, user);
  }
  /** The user's settings after last-write-wins, as the server would serve them to a new device. */
  settings(userId: string): Map<string, SyncSetting> {
    const merged = new Map<string, SyncSetting>();
    for (const c of this.users.get(userId)?.changes ?? []) {
      if ("setting" in c && settingWins(c.setting, merged.get(c.setting.key))) {
        merged.set(c.setting.key, c.setting);
      }
    }
    return merged;
  }
  transport(userId: string): SyncTransport {
    const user = this.users.get(userId) ?? { rev: 0, changes: [] };
    this.users.set(userId, user);
    return {
      pull: async (since, limit): Promise<PullPage> => {
        const changes = user.changes.filter((c) => c.rev > Number(since));
        const page = changes.slice(0, limit);
        return {
          entries: page.flatMap((c) => ("entry" in c ? [c.entry] : [])),
          settings: page.flatMap((c) => ("setting" in c ? [c.setting] : [])),
          cursor: String(page.length ? page[page.length - 1].rev : since),
          hasMore: changes.length > limit,
        };
      },
      push: async (entries, settings) => {
        for (const entry of entries) user.changes.push({ entry, rev: ++user.rev });
        for (const setting of settings) user.changes.push({ setting, rev: ++user.rev });
      },
    };
  }
}

const A = "user-a";
const B = "user-b";

describe("switching accounts", () => {
  let db: SqlDb;
  let sqlite: Database;
  let server: Server;
  beforeEach(() => {
    ({ db, sqlite } = openDb());
    server = new Server();
    server.seed(A, [
      { date: "2026-03-01", itemId: "fajr", value: 3 },
      { date: "2026-03-01", itemId: "dhuhr", value: 3 },
    ]);
    server.seed(B, [{ date: "2026-03-02", itemId: "isha", value: 1 }]);
  });

  const sync = async (user: string) => {
    await prepareAccount(db, user);
    return runSync(createSqliteStore(db, user), server.transport(user));
  };
  const days = () =>
    sqlite
      .query<{ k: string }, []>("SELECT date || '|' || item_id AS k FROM entries ORDER BY k")
      .all()
      .map((r) => r.k);
  const cursors = () =>
    sqlite
      .query<{ key: string }, []>(
        "SELECT key FROM settings WHERE key LIKE 'sync.cursor.%' ORDER BY key",
      )
      .all()
      .map((r) => r.key);

  test("A → B → A re-pulls A in full instead of resuming from a stale cursor", async () => {
    expect((await sync(A)).pulled).toBe(2);
    expect(cursors()).toEqual([cursorKey(A)]);

    // B signs in: A's rows and A's cursor are gone, B's data arrives.
    expect((await sync(B)).pulled).toBe(1);
    expect(days()).toEqual(["2026-03-02|isha"]);
    expect(cursors()).toEqual([cursorKey(B)]);

    // A signs back in: a kept cursor (=2) would pull nothing and leave A's days empty.
    expect((await sync(A)).pulled).toBe(2);
    expect(days()).toEqual(["2026-03-01|dhuhr", "2026-03-01|fajr"]);
    expect(cursors()).toEqual([cursorKey(A)]);
  });

  test("the first sign-in keeps what was recorded offline and uploads it", async () => {
    const store = createSqliteStore(db, "pre");
    await db.runAsync(
      "INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES ('2026-03-05', 'fajr', 3, 500, 1)",
    );
    expect(await store.dirtyEntries()).toHaveLength(1);
    const report = await sync(A);
    expect(report).toEqual({ pulled: 2, pushed: 1 });
    expect(days()).toContain("2026-03-05|fajr");
  });

  test("a custom amalan added offline is uploaded on the first sign-in and reaches a new phone", async () => {
    // The account already holds an older item list, for example from another phone.
    const C = "user-c";
    server.seed(C, [], [{ key: ITEMS_KEY, value: serializeItems(DEFAULT_ITEMS) }]);

    // Offline, before any sign-in: the user adds "Baca Al-Mulk" in the item manager.
    const items = addCustomItem(DEFAULT_ITEMS, "Baca Al-Mulk", "check", () => "mulk01");
    await setSyncedSetting(asExpoDb(sqlite), ITEMS_KEY, serializeItems(items));
    expect(await createSqliteStore(db, "pre").dirtySettings()).toHaveLength(1);

    // First sign-in: the newer offline list beats the server's and is pushed.
    expect(await sync(C)).toEqual({ pulled: 0, pushed: 1 });
    expect(await createSqliteStore(db, C).dirtySettings()).toEqual([]);
    expect(server.settings(C).get(ITEMS_KEY)?.value).toBe(serializeItems(items));

    // A second phone signing in to the same account gets the custom item.
    const other = openDb();
    await prepareAccount(other.db, C);
    await runSync(createSqliteStore(other.db, C), server.transport(C));
    const stored = other.sqlite
      .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
      .get(ITEMS_KEY);
    expect(parseItems(stored?.value)).toContainEqual({
      id: "c.mulk01",
      kind: "check",
      label: "Baca Al-Mulk",
    });
  });

  test("signing out and back in as the same user keeps data and cursor", async () => {
    await sync(A);
    const report = await sync(A);
    expect(report).toEqual({ pulled: 0, pushed: 0 });
    expect(cursors()).toEqual([cursorKey(A)]);
    expect(days()).toHaveLength(2);
  });

  test("deleting the account keeps local data and uploads it to the next account", async () => {
    await sync(A);
    expect(await createSqliteStore(db, A).dirtyEntries()).toHaveLength(0);
    await forgetAccount(db);
    expect(cursors()).toEqual([]);
    expect(days()).toHaveLength(2);
    const report = await sync("fresh");
    expect(report.pushed).toBe(2);
    expect(days()).toHaveLength(2);
  });

  test("other users' unsynced edits are never uploaded to the next account", async () => {
    await sync(A);
    await db.runAsync(
      "INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES ('2026-03-09', 'asr', 3, 900, 1)",
    );
    const report = await sync(B);
    expect(report.pushed).toBe(0);
    expect(days()).not.toContain("2026-03-09|asr");
  });
});
