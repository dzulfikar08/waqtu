import { describe, expect, test } from "bun:test";

import {
  chunk,
  entryWins,
  settingWins,
  type SyncEntry,
  type SyncSetting,
} from "../src/mutabaah/merge";
import {
  runSync,
  type PullPage,
  type SyncStore,
  type SyncTransport,
} from "../src/mutabaah/syncEngine";

const e = (date: string, itemId: string, value: number, updatedAt: number): SyncEntry => ({
  date,
  itemId,
  value,
  updatedAt,
});
const s = (key: string, value: string, updatedAt: number): SyncSetting => ({
  key,
  value,
  updatedAt,
});

describe("merge rules", () => {
  test("newer wins, older loses, identical does not replace", () => {
    const base = e("2026-03-01", "fajr", 3, 100);
    expect(entryWins(e("2026-03-01", "fajr", 0, 101), base)).toBe(true);
    expect(entryWins(e("2026-03-01", "fajr", 15, 99), base)).toBe(false);
    expect(entryWins(base, base)).toBe(false);
    expect(entryWins(base, undefined)).toBe(true);
  });

  test("equal timestamp: greater value wins, both directions agree", () => {
    const a = e("2026-03-01", "tilawah", 5, 100);
    const b = e("2026-03-01", "tilawah", 7, 100);
    expect(entryWins(b, a)).toBe(true);
    expect(entryWins(a, b)).toBe(false);
  });

  test("settings: newer wins, equal timestamp falls to the greater value", () => {
    const base = s("method", "mwl", 50);
    expect(settingWins(s("method", "isna", 51), base)).toBe(true);
    expect(settingWins(s("method", "isna", 49), base)).toBe(false);
    expect(settingWins(s("method", "mwl", 50), base)).toBe(false);
    expect(settingWins(s("method", "singapore", 50), base)).toBe(true);
    expect(settingWins(base, s("method", "singapore", 50))).toBe(false);
  });

  test("chunk", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

/** In-memory replica with the same dirty-tracking contract as the SQLite store. */
class MemoryStore implements SyncStore {
  entries = new Map<string, { row: SyncEntry; dirty: boolean }>();
  settings = new Map<string, { row: SyncSetting; dirty: boolean }>();
  cursor = "0";
  now = 1;

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async getCursor() {
    return this.cursor;
  }
  async setCursor(c: string) {
    this.cursor = c;
  }
  async getEntry(date: string, itemId: string) {
    return this.entries.get(`${date}|${itemId}`)?.row;
  }
  async getSetting(key: string) {
    return this.settings.get(key)?.row;
  }
  async putRemoteEntry(row: SyncEntry) {
    this.entries.set(`${row.date}|${row.itemId}`, { row, dirty: false });
  }
  async putRemoteSetting(row: SyncSetting) {
    this.settings.set(row.key, { row, dirty: false });
  }
  async dirtyEntries() {
    return [...this.entries.values()].filter((x) => x.dirty).map((x) => x.row);
  }
  async dirtySettings() {
    return [...this.settings.values()].filter((x) => x.dirty).map((x) => x.row);
  }
  async markEntriesClean(rows: readonly SyncEntry[]) {
    for (const r of rows) {
      const cur = this.entries.get(`${r.date}|${r.itemId}`);
      if (cur && cur.row.updatedAt === r.updatedAt) cur.dirty = false;
    }
  }
  async markSettingsClean(rows: readonly SyncSetting[]) {
    for (const r of rows) {
      const cur = this.settings.get(r.key);
      if (cur && cur.row.updatedAt === r.updatedAt) cur.dirty = false;
    }
  }
  // User edits
  edit(date: string, itemId: string, value: number, updatedAt: number) {
    this.entries.set(`${date}|${itemId}`, { row: e(date, itemId, value, updatedAt), dirty: true });
  }
  editSetting(key: string, value: string, updatedAt: number) {
    this.settings.set(key, { row: s(key, value, updatedAt), dirty: true });
  }
  value(date: string, itemId: string) {
    return this.entries.get(`${date}|${itemId}`)?.row.value;
  }
}

/** The server contract of services/api: per-row rev, last-write-wins, cursor paging. */
class FakeServer {
  rev = 0;
  entries = new Map<string, SyncEntry & { rev: number }>();
  settings = new Map<string, SyncSetting & { rev: number }>();
  pushes = 0;
  pulls = 0;

  transport(): SyncTransport {
    return {
      pull: async (since, limit) => this.pull(since, limit),
      push: async (entries, settings) => this.push(entries, settings),
    };
  }

  push(entries: SyncEntry[], settings: SyncSetting[]) {
    this.pushes++;
    for (const row of entries) {
      const key = `${row.date}|${row.itemId}`;
      if (entryWins(row, this.entries.get(key))) this.entries.set(key, { ...row, rev: ++this.rev });
    }
    for (const row of settings) {
      if (settingWins(row, this.settings.get(row.key))) {
        this.settings.set(row.key, { ...row, rev: ++this.rev });
      }
    }
    return Promise.resolve();
  }

  pull(since: string, limit: number): PullPage {
    this.pulls++;
    const after = Number(since);
    const rows = [
      ...[...this.entries.values()].map((r) => ({ kind: "e" as const, r })),
      ...[...this.settings.values()].map((r) => ({ kind: "s" as const, r })),
    ]
      .filter((x) => x.r.rev > after)
      .sort((a, b) => a.r.rev - b.r.rev);
    const page = rows.slice(0, limit);
    const strip = ({ rev: _rev, ...rest }: { rev: number }) => rest;
    return {
      entries: page.filter((x) => x.kind === "e").map((x) => strip(x.r) as SyncEntry),
      settings: page.filter((x) => x.kind === "s").map((x) => strip(x.r) as SyncSetting),
      cursor: String(page.length ? page[page.length - 1].r.rev : after),
      hasMore: rows.length > limit,
    };
  }
}

describe("runSync", () => {
  test("pushes local edits and a second device pulls them", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    const b = new MemoryStore();
    a.edit("2026-03-01", "fajr", 3, 10);
    a.edit("2026-03-01", "tilawah", 4, 11);
    a.editSetting("method", "mwl", 12);

    expect(await runSync(a, server.transport())).toEqual({ pulled: 0, pushed: 3 });
    expect(await runSync(b, server.transport())).toEqual({ pulled: 3, pushed: 0 });
    expect(b.value("2026-03-01", "tilawah")).toBe(4);
    expect(b.settings.get("method")?.row.value).toBe("mwl");
  });

  test("running again is idempotent: nothing pushed, nothing re-applied", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    a.edit("2026-03-01", "fajr", 3, 10);
    await runSync(a, server.transport());
    const pushesBefore = server.pushes;
    const revBefore = server.rev;
    const report = await runSync(a, server.transport());
    expect(report.pushed).toBe(0);
    expect(server.pushes).toBe(pushesBefore);
    expect(server.rev).toBe(revBefore);
  });

  test("a newer remote edit beats a stale local edit before it is pushed", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    const b = new MemoryStore();
    a.edit("2026-03-01", "fajr", 3, 10);
    await runSync(a, server.transport());
    await runSync(b, server.transport());

    b.edit("2026-03-01", "fajr", 0, 30); // later: unticked on device b
    await runSync(b, server.transport());
    a.edit("2026-03-01", "fajr", 11, 20); // earlier edit, still queued on device a
    await runSync(a, server.transport());

    expect(a.value("2026-03-01", "fajr")).toBe(0);
    expect(server.entries.get("2026-03-01|fajr")?.value).toBe(0);
    expect(await a.dirtyEntries()).toEqual([]);
  });

  test("a newer local edit wins and is pushed", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    const b = new MemoryStore();
    b.edit("2026-03-01", "fajr", 3, 10);
    await runSync(b, server.transport());
    a.edit("2026-03-01", "fajr", 15, 20);
    await runSync(a, server.transport());
    await runSync(b, server.transport());
    expect(server.entries.get("2026-03-01|fajr")?.value).toBe(15);
    expect(b.value("2026-03-01", "fajr")).toBe(15);
  });

  test("two devices converge whatever the sync order", async () => {
    const run = async (order: "ab" | "ba") => {
      const server = new FakeServer();
      const a = new MemoryStore();
      const b = new MemoryStore();
      a.edit("2026-03-01", "tilawah", 5, 100);
      b.edit("2026-03-01", "tilawah", 7, 100); // exact tie
      a.edit("2026-03-02", "fajr", 3, 50);
      b.edit("2026-03-02", "fajr", 0, 60);
      const first = order === "ab" ? [a, b] : [b, a];
      for (const store of [...first, ...first]) await runSync(store, server.transport());
      return {
        a: [...a.entries.values()].map((x) => x.row),
        b: [...b.entries.values()].map((x) => x.row),
      };
    };
    const ab = await run("ab");
    const ba = await run("ba");
    const key = (r: SyncEntry) => `${r.date}|${r.itemId}`;
    const norm = (rows: SyncEntry[]) => [...rows].sort((x, y) => key(x).localeCompare(key(y)));
    expect(norm(ab.a)).toEqual(norm(ab.b));
    expect(norm(ab.a)).toEqual(norm(ba.a));
    expect(norm(ab.a)).toEqual([
      e("2026-03-01", "tilawah", 7, 100),
      e("2026-03-02", "fajr", 0, 60),
    ]);
  });

  test("pages through a long pull and advances the cursor", async () => {
    const server = new FakeServer();
    for (let i = 0; i < 1203; i++) {
      server.entries.set(`2026-03-01|c.item${i}`, {
        ...e("2026-03-01", `c.item${i}`, 1, 5),
        rev: ++server.rev,
      });
    }
    const a = new MemoryStore();
    const report = await runSync(a, server.transport());
    expect(report.pulled).toBe(1203);
    expect(a.entries.size).toBe(1203);
    expect(a.cursor).toBe("1203");
    expect(server.pulls).toBe(3);
  });

  test("a server that reports hasMore without advancing cannot loop forever", async () => {
    const a = new MemoryStore();
    let calls = 0;
    const stuck: SyncTransport = {
      pull: async () => {
        calls++;
        return { entries: [], settings: [], cursor: "0", hasMore: true };
      },
      push: async () => {},
    };
    await runSync(a, stuck);
    expect(calls).toBe(1);
  });

  test("pushes large local backlogs in batches", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    for (let i = 0; i < 1100; i++) a.edit("2026-03-01", `c.item${i}`, 1, 5);
    for (let i = 0; i < 150; i++) a.editSetting(`k${i}`, "v", 5);
    const sizes: number[][] = [];
    const spy: SyncTransport = {
      pull: async (since, limit) => server.pull(since, limit),
      push: async (entries, settings) => {
        sizes.push([entries.length, settings.length]);
        await server.push(entries, settings);
      },
    };
    const report = await runSync(a, spy);
    expect(report.pushed).toBe(1250);
    expect(sizes).toEqual([
      [500, 100],
      [500, 50],
      [100, 0],
    ]);
    expect(await a.dirtyEntries()).toEqual([]);
    expect(await a.dirtySettings()).toEqual([]);
  });

  test("an edit made while the push is in flight stays queued", async () => {
    const server = new FakeServer();
    const a = new MemoryStore();
    a.edit("2026-03-01", "fajr", 3, 10);
    const racing: SyncTransport = {
      pull: async (since, limit) => server.pull(since, limit),
      push: async (entries, settings) => {
        await server.push(entries, settings);
        a.edit("2026-03-01", "fajr", 0, 20);
      },
    };
    await runSync(a, racing);
    expect(await a.dirtyEntries()).toEqual([e("2026-03-01", "fajr", 0, 20)]);
    await runSync(a, server.transport());
    expect(server.entries.get("2026-03-01|fajr")?.value).toBe(0);
  });

  test("a failed push leaves rows queued for the next run", async () => {
    const a = new MemoryStore();
    a.edit("2026-03-01", "fajr", 3, 10);
    const offline: SyncTransport = {
      pull: async () => ({ entries: [], settings: [], cursor: "0", hasMore: false }),
      push: async () => {
        throw new Error("offline");
      },
    };
    await expect(runSync(a, offline)).rejects.toThrow("offline");
    expect((await a.dirtyEntries()).length).toBe(1);
  });

  test("a newer remote setting replaces a clean local one", async () => {
    const server = new FakeServer();
    server.settings.set("method", { ...s("method", "isna", 99), rev: ++server.rev });
    const a = new MemoryStore();
    a.settings.set("method", { row: s("method", "mwl", 10), dirty: false });
    await runSync(a, server.transport());
    expect(a.settings.get("method")?.row.value).toBe("isna");
  });
});
