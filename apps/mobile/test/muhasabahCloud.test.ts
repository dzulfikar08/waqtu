import { afterEach, describe, expect, test } from "bun:test";

import { en as enStrings } from "../src/i18n/locales/en";
import { id as idStrings } from "../src/i18n/locales/id";
import {
  CLOUD_CURSOR_KEY,
  CLOUD_USER_KEY,
  PULL_LIMIT,
  PUSH_CHUNK,
  createMuhasabahStore,
  disableCloud,
  enableCloud,
  isCloudEnabled,
  runMuhasabahSync,
  type MuhasabahTransport,
  type PullPage,
  type WireEntry,
} from "../src/ibadah/cloud";
import { createMuhasabahTransport, deleteCloudCopy } from "../src/ibadah/cloudTransport";
import {
  deleteMuhasabah,
  emptyEntry,
  getMuhasabah,
  saveMuhasabah,
  type MuhasabahEntry,
} from "../src/ibadah/muhasabah";
import { isSyncedSettingKey } from "../src/mutabaah/syncKeys";
import { createSqliteStore, forgetAccount, type SqlDb } from "../src/sync/sqliteStore";
import { SyncHttpError, isUnauthorized } from "../src/sync/transport";
import { migratedDb } from "./helpers/sqlite";

const day = (n: number) => `2027-01-${String(n).padStart(2, "0")}`;
const entry = (date: string, fields: Partial<MuhasabahEntry> = {}): MuhasabahEntry => ({
  ...emptyEntry(date),
  ...fields,
});
const wire = (date: string, updatedAt: number, fields: WireEntry["entry"]): WireEntry => ({
  date,
  updatedAt,
  entry: fields,
});

/** The server contract of services/api/src/muhasabah.ts: per-day rev, whole-entry last-write-wins, cursor paging. */
class FakeServer {
  rev = 0;
  days = new Map<string, WireEntry & { rev: number }>();
  pushSizes: number[] = [];
  pulls = 0;

  transport(): MuhasabahTransport {
    return {
      pull: async (since, limit) => this.pull(since, limit),
      push: async (entries) => this.push(entries),
    };
  }

  push(entries: WireEntry[]) {
    this.pushSizes.push(entries.length);
    for (const incoming of entries) {
      const current = this.days.get(incoming.date);
      const wins =
        !current ||
        incoming.updatedAt > current.updatedAt ||
        (incoming.updatedAt === current.updatedAt &&
          JSON.stringify(incoming.entry) > JSON.stringify(current.entry));
      if (wins) this.days.set(incoming.date, { ...incoming, rev: ++this.rev });
    }
  }

  pull(since: string, limit: number): PullPage {
    this.pulls++;
    const after = Number(since);
    const rows = [...this.days.values()]
      .filter((row) => row.rev > after)
      .sort((a, b) => a.rev - b.rev);
    const page = rows.slice(0, limit);
    return {
      entries: page.map(({ rev: _rev, ...row }) => row),
      cursor: String(page.at(-1)?.rev ?? after),
      hasMore: rows.length > page.length,
    };
  }

  put(date: string, updatedAt: number, fields: WireEntry["entry"]) {
    this.push([wire(date, updatedAt, fields)]);
    this.pushSizes.length = 0;
  }
}

async function setup() {
  const { db, raw } = await migratedDb();
  return { db, raw, store: createMuhasabahStore(db), server: new FakeServer() };
}

const flags = (raw: { query(sql: string): { all(): unknown[] } }) =>
  raw.query("SELECT date, dirty, deleted FROM muhasabah ORDER BY date").all();

describe("muhasabah cloud engine", () => {
  test("pushes every dirty day in chunks of 20 and marks them clean", async () => {
    const { db, raw, store, server } = await setup();
    for (let i = 1; i <= 25; i++) await saveMuhasabah(db, entry(day(i), { taqwa: 5 }), 1000 + i);
    await saveMuhasabah(db, entry("2027-02-01", { taqwa: 5 }), 2000);
    await saveMuhasabah(db, entry("2027-02-02", { feelings: "Tenang" }), 2001);
    await saveMuhasabah(db, entry("2027-02-03", { energy: 7 }), 2002);

    expect(PUSH_CHUNK).toBe(20);
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 0, pushed: 28 });
    expect(server.pushSizes).toEqual([20, 8]);
    expect(raw.query("SELECT COUNT(*) AS n FROM muhasabah WHERE dirty = 1").get()).toEqual({
      n: 0,
    });
    expect(server.days.get("2027-02-02")?.entry).toEqual({ feelings: "Tenang" });

    // Nothing left to send, and the server's echo of our own rows is not a change.
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 0, pushed: 0 });
    expect(server.pushSizes).toEqual([20, 8]);
  });

  test("wire entries omit empty fields and carry every answered one", async () => {
    const { db, store, server } = await setup();
    await saveMuhasabah(
      db,
      entry(day(1), {
        feelings: "Syukur",
        newAction: "Sedekah",
        taqwa: 7,
        gratitude: 8,
        energy: 6,
        willingness: 9,
        continueTomorrow: "Dhuha",
      }),
      1000,
    );
    await saveMuhasabah(db, entry(day(2), { willingness: 3 }), 1000);
    await runMuhasabahSync(store, server.transport());
    expect(server.days.get(day(1))?.entry).toEqual({
      feelings: "Syukur",
      newAction: "Sedekah",
      taqwa: 7,
      gratitude: 8,
      energy: 6,
      willingness: 9,
      continueTomorrow: "Dhuha",
    });
    expect(server.days.get(day(2))?.entry).toEqual({ willingness: 3 });
  });

  test("pulls page by page from the stored cursor and stores the days clean", async () => {
    const { db, raw, store, server } = await setup();
    const total = PULL_LIMIT * 2 + 30;
    for (let i = 0; i < total; i++) {
      server.put(
        `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + Math.floor(i / 12)).padStart(2, "0")}`,
        100 + i,
        {
          taqwa: 1 + (i % 10),
        },
      );
    }
    const report = await runMuhasabahSync(store, server.transport());
    expect(report).toEqual({ pulled: total, pushed: 0 });
    expect(server.pulls).toBe(3);
    expect(await store.getCursor()).toBe(String(total));
    expect(
      raw.query("SELECT COUNT(*) AS n FROM muhasabah WHERE dirty = 0 AND deleted = 0").get(),
    ).toEqual({
      n: total,
    });

    await server.put(day(1), 5000, { energy: 4 });
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 1, pushed: 0 });
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { energy: 4 }));
  });

  test("a strictly newer remote day replaces the local one, even one still waiting to upload", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Lokal", taqwa: 2 }), 1000);
    server.put(day(1), 2000, { gratitude: 9 });
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 1, pushed: 0 });
    // The whole entry is replaced, not merged field by field.
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { gratitude: 9 }));
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 0, deleted: 0 }]);
  });

  test("an older remote day loses and the local one is uploaded", async () => {
    const { db, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Lokal" }), 3000);
    server.put(day(1), 2000, { gratitude: 9 });
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 0, pushed: 1 });
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { feelings: "Lokal" }));
    expect(server.days.get(day(1))?.entry).toEqual({ feelings: "Lokal" });
  });

  test("on an equal timestamp the local day stays", async () => {
    const { db, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Lokal" }), 3000);
    server.put(day(1), 3000, { gratitude: 9 });
    expect((await runMuhasabahSync(store, server.transport())).pulled).toBe(0);
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { feelings: "Lokal" }));
  });

  test("a remote tombstone deletes the local day", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Hapus saya" }), 1000);
    await runMuhasabahSync(store, server.transport());
    server.put(day(1), 2000, null);
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 1, pushed: 0 });
    expect(await getMuhasabah(db, day(1))).toBeNull();
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 0, deleted: 1 }]);
    expect(raw.query("SELECT feelings, taqwa FROM muhasabah").get()).toEqual({
      feelings: null,
      taqwa: null,
    });
  });

  test("a tombstone for a day never seen is kept, so an older write cannot bring it back", async () => {
    const { db, raw, store, server } = await setup();
    server.put(day(1), 2000, null);
    await runMuhasabahSync(store, server.transport());
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 0, deleted: 1 }]);
    server.put(day(1), 1000, { taqwa: 3 });
    await runMuhasabahSync(store, server.transport());
    expect(await getMuhasabah(db, day(1))).toBeNull();
  });

  test("a local delete uploads a tombstone", async () => {
    const { db, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Satu" }), 1000);
    await runMuhasabahSync(store, server.transport());
    await deleteMuhasabah(db, day(1), 2000);
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 0, pushed: 1 });
    expect(server.days.get(day(1))).toMatchObject({ updatedAt: 2000, entry: null });
  });

  test("a day edited while its upload is in flight stays queued", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Satu" }), 1000);
    const slow: MuhasabahTransport = {
      pull: async (since, limit) => server.pull(since, limit),
      push: async (entries) => {
        server.push(entries);
        await saveMuhasabah(db, entry(day(1), { feelings: "Dua" }), 2000);
      },
    };
    await runMuhasabahSync(store, slow);
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 1, deleted: 0 }]);
    expect(await runMuhasabahSync(store, server.transport())).toEqual({ pulled: 0, pushed: 1 });
    expect(server.days.get(day(1))?.entry).toEqual({ feelings: "Dua" });
  });

  test("a failed push leaves days queued and the pulled cursor kept", async () => {
    const { db, raw, store, server } = await setup();
    server.put(day(9), 500, { taqwa: 1 });
    await saveMuhasabah(db, entry(day(1), { taqwa: 5 }), 1000);
    const failing: MuhasabahTransport = {
      pull: async (since, limit) => server.pull(since, limit),
      push: async () => {
        throw new SyncHttpError(500, "boom");
      },
    };
    await expect(runMuhasabahSync(store, failing)).rejects.toThrow("boom");
    expect(await store.getCursor()).toBe("1");
    expect(flags(raw)).toEqual([
      { date: day(1), dirty: 1, deleted: 0 },
      { date: day(9), dirty: 0, deleted: 0 },
    ]);
  });

  test("pulled fields the journal cannot hold are dropped instead of breaking the sync", async () => {
    const { db, store, server } = await setup();
    server.put(day(1), 1000, { taqwa: 11, feelings: "Baik" });
    server.put(day(2), 1000, { taqwa: 0 });
    await runMuhasabahSync(store, server.transport());
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { feelings: "Baik" }));
    expect(await getMuhasabah(db, day(2))).toBeNull();
  });
});

describe("muhasabah cloud switch", () => {
  const settings = (raw: { query(sql: string): { all(): unknown[] } }) =>
    raw
      .query("SELECT key, value FROM settings WHERE key LIKE 'muhasabah.cloud.%' ORDER BY key")
      .all();

  test("off by default and per account", async () => {
    const { db } = await migratedDb();
    expect(await isCloudEnabled(db, "alice")).toBe(false);
    await enableCloud(db, "alice");
    expect(await isCloudEnabled(db, "alice")).toBe(true);
    expect(await isCloudEnabled(db, "bob")).toBe(false);
  });

  test("turning on resets the cursor and queues every day, deletions included", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { taqwa: 5 }), 1000);
    await saveMuhasabah(db, entry(day(2), { taqwa: 6 }), 1000);
    await deleteMuhasabah(db, day(2), 2000);
    raw.run("UPDATE muhasabah SET dirty = 0");
    raw.run("INSERT INTO settings (key, value) VALUES (?, '77')", [CLOUD_CURSOR_KEY]);

    await enableCloud(db, "alice");
    expect(settings(raw)).toEqual([{ key: CLOUD_USER_KEY, value: "alice" }]);
    expect(await store.getCursor()).toBe("0");
    expect(flags(raw)).toEqual([
      { date: day(1), dirty: 1, deleted: 0 },
      { date: day(2), dirty: 1, deleted: 1 },
    ]);

    await runMuhasabahSync(store, server.transport());
    expect(server.days.get(day(1))?.entry).toEqual({ taqwa: 5 });
    expect(server.days.get(day(2))?.entry).toBeNull();
  });

  test("turning off clears the flag and cursor but keeps every local day", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { feelings: "Tetap" }), 1000);
    await enableCloud(db, "alice");
    await runMuhasabahSync(store, server.transport());
    expect(settings(raw)).toHaveLength(2);

    await disableCloud(db);
    expect(settings(raw)).toEqual([]);
    expect(await isCloudEnabled(db, "alice")).toBe(false);
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { feelings: "Tetap" }));
  });

  test("the switch's rows are not synced settings, so the mutabaah sync never uploads them", async () => {
    const { db, raw } = await migratedDb();
    expect(isSyncedSettingKey(CLOUD_USER_KEY)).toBe(false);
    expect(isSyncedSettingKey(CLOUD_CURSOR_KEY)).toBe(false);
    await enableCloud(db, "alice");
    await createMuhasabahStore(db).setCursor("5");
    // Even stamped dirty, they are filtered out of the mutabaah upload.
    raw.run("UPDATE settings SET dirty = 1, updated_at = 9 WHERE key LIKE 'muhasabah.cloud.%'");
    expect(await createSqliteStore(db as SqlDb, "alice").dirtySettings()).toEqual([]);
  });

  test("deleting the account clears the switch and queues the journal again", async () => {
    const { db, raw, store, server } = await setup();
    await saveMuhasabah(db, entry(day(1), { taqwa: 4 }), 1000);
    await enableCloud(db, "alice");
    await runMuhasabahSync(store, server.transport());
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 0, deleted: 0 }]);

    await forgetAccount(db);
    expect(settings(raw)).toEqual([]);
    expect(flags(raw)).toEqual([{ date: day(1), dirty: 1, deleted: 0 }]);
    expect(await getMuhasabah(db, day(1))).toEqual(entry(day(1), { taqwa: 4 }));
  });
});

describe("muhasabah cloud transport", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function mock(responder: (url: string, init: RequestInit) => Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return responder(url, init);
    }) as unknown as typeof fetch;
    return calls;
  }

  test("pull and push hit /v1/muhasabah with the session cookie", async () => {
    const calls = mock(() =>
      Response.json({ entries: [], cursor: "3", hasMore: false, applied: 1 }),
    );
    const transport = createMuhasabahTransport("https://api.test/", async () => "session=abc");
    expect(await transport.pull("2", 100)).toEqual({
      entries: [],
      cursor: "3",
      hasMore: false,
      applied: 1,
    } as never);
    await transport.push([wire(day(1), 5, { taqwa: 4 })]);

    expect(calls[0].url).toBe("https://api.test/v1/muhasabah?since=2&limit=100");
    expect(calls[0].init.method).toBe("GET");
    expect((calls[0].init.headers as Record<string, string>).cookie).toBe("session=abc");
    expect(calls[1].url).toBe("https://api.test/v1/muhasabah");
    expect(calls[1].init.method).toBe("POST");
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      entries: [{ date: day(1), updatedAt: 5, entry: { taqwa: 4 } }],
    });
  });

  test("deleting the cloud copy is a DELETE, and a rejected one throws", async () => {
    const calls = mock(() => Response.json({ deleted: 4 }));
    await deleteCloudCopy("https://api.test", async () => "session=abc");
    expect(calls[0].url).toBe("https://api.test/v1/muhasabah");
    expect(calls[0].init.method).toBe("DELETE");

    mock(() => Response.json({ error: "unauthorized" }, { status: 401 }));
    const rejected = await deleteCloudCopy("https://api.test", async () => "").catch((e) => e);
    expect(isUnauthorized(rejected)).toBe(true);
  });
});

describe("muhasabah cloud strings", () => {
  test("every label exists in both languages", () => {
    const keys = [
      "muhasabah",
      "muhasabahHint",
      "muhasabahPremium",
      "muhasabahOffTitle",
      "muhasabahOffBody",
      "muhasabahOffDelete",
      "muhasabahOffKeep",
      "muhasabahDeleteFailed",
    ] as const;
    for (const key of keys) {
      expect(idStrings.sync[key].length).toBeGreaterThan(0);
      expect(enStrings.sync[key].length).toBeGreaterThan(0);
    }
    for (const key of ["synced", "deleteBodySynced"] as const) {
      expect(idStrings.ibadah.muhasabah[key].length).toBeGreaterThan(0);
      expect(enStrings.ibadah.muhasabah[key].length).toBeGreaterThan(0);
    }
    expect(idStrings.sync.muhasabah).toBe("Sinkronkan muhasabah ke cloud");
    expect(enStrings.sync.muhasabah).toBe("Sync muhasabah to the cloud");
  });

  test("the privacy line no longer claims the journal never leaves the phone", () => {
    expect(enStrings.ibadah.muhasabah.private).toContain(
      "unless you turn on cloud sync in Settings",
    );
    expect(enStrings.ibadah.muhasabah.private.startsWith("Private: your muhasabah notes")).toBe(
      true,
    );
    expect(idStrings.ibadah.muhasabah.private.startsWith("Pribadi: catatan muhasabah")).toBe(true);
    expect(idStrings.ibadah.muhasabah.private).not.toContain("tidak pernah dikirim");
  });
});
