import type { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  importSwiftStreak,
  SWIFT_IMPORT_KEY,
  SWIFT_IMPORT_STAMP,
  SWIFT_IMPORT_TRIES,
} from "../src/db/swiftStreakImport";
import { FLAG } from "../src/mutabaah/items";
import { runSync } from "../src/mutabaah/syncEngine";
import { decodeSwiftStreak, swiftGridDays, swiftImportEntries } from "../src/mutabaah/swiftStreak";
import { createSqliteStore, prepareAccount } from "../src/sync/sqliteStore";
import { migratedDb } from "./helpers/sqlite";

/**
 * Bytes as the Mac app stores them: `JSONEncoder().encode(StreakData)` with default strategies
 * (`lastUpdated` in seconds since 2001-01-01), the grid from `AppViewModel.mapWeeklyGrid()`, which
 * leaves `date` empty. Saved 2026-10-21 21:00 in Jakarta, a Wednesday.
 */
const MAC_FIXTURE = readFileSync(join(import.meta.dir, "fixtures/swift-streak-mac.json"), "utf8");
const TZ = "Asia/Jakarta";

const data = () => {
  const decoded = decodeSwiftStreak(MAC_FIXTURE);
  if (!decoded) throw new Error("fixture did not decode");
  return decoded;
};

describe("decodeSwiftStreak", () => {
  test("reads the Swift encoding, including the 2001-based date", () => {
    const d = data();
    expect(d.currentStreak).toBe(12);
    expect(d.bestStreak).toBe(40);
    expect(d.todayTotal).toBe(5);
    expect(d.weeklyGrid).toHaveLength(7);
    expect(d.weeklyGrid[6]).toEqual({ date: "", label: "Wed", status: "empty", isToday: true });
    expect(d.lastUpdated.toISOString()).toBe("2026-10-21T14:00:00.254Z");
  });

  test("anything StreakData's decoder would reject is null", () => {
    const valid = JSON.parse(MAC_FIXTURE);
    const variants: unknown[] = [
      [],
      null,
      { ...valid, lastUpdated: "2026-10-21" },
      { ...valid, currentStreak: 1.5 },
      { ...valid, weeklyGrid: undefined },
      { ...valid, weeklyGrid: [{ ...valid.weeklyGrid[0], status: "done" }] },
      { ...valid, weeklyGrid: [{ ...valid.weeklyGrid[0], isToday: "no" }] },
    ];
    for (const v of variants) expect(decodeSwiftStreak(JSON.stringify(v))).toBeNull();
    expect(decodeSwiftStreak("not json")).toBeNull();
  });
});

describe("swiftGridDays", () => {
  test("places undated dots by position, today being the day lastUpdated falls on", () => {
    expect(swiftGridDays(data(), TZ)).toEqual([
      { date: "2026-10-15", status: "complete" },
      { date: "2026-10-16", status: "partial" },
      { date: "2026-10-17", status: "complete" },
      { date: "2026-10-18", status: "missed" },
      { date: "2026-10-19", status: "empty" },
      { date: "2026-10-20", status: "complete" },
      { date: "2026-10-21", status: "empty" },
    ]);
  });

  test("a zone that moves today to another weekday yields nothing rather than shifted days", () => {
    // 14:00 UTC is already Thursday at UTC+14, but the grid says today is Wednesday.
    expect(swiftGridDays(data(), "Pacific/Kiritimati")).toEqual([]);
  });

  test("dots that carry a date keep it", () => {
    const d = data();
    d.weeklyGrid = [{ date: "2026-01-01", label: "Thu", status: "complete", isToday: false }];
    expect(swiftGridDays(d, TZ)).toEqual([{ date: "2026-01-01", status: "complete" }]);
  });
});

describe("swiftImportEntries", () => {
  test("complete days become the five fardhu marked done; partial, missed and empty add nothing", () => {
    const entries = swiftImportEntries(data(), TZ);
    expect(entries).toHaveLength(15);
    expect(new Set(entries.map((e) => e.date))).toEqual(
      new Set(["2026-10-15", "2026-10-17", "2026-10-20"]),
    );
    expect(entries.every((e) => e.value === FLAG.DONE)).toBe(true);
    expect(entries.filter((e) => e.date === "2026-10-20").map((e) => e.itemId)).toEqual([
      "fajr",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ]);
  });
});

describe("importSwiftStreak", () => {
  const marker = (raw: Database) =>
    raw
      .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
      .get(SWIFT_IMPORT_KEY)?.value;

  test("adds the complete days once, as dirty rows, without touching what the phone has", async () => {
    const { raw, db } = await migratedDb();
    raw.run(
      "INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES ('2026-10-15', 'fajr', 0, 900, 0), ('2026-10-17', 'dhuhr', 7, 900, 0)",
    );
    let reads = 0;
    const read = () => {
      reads++;
      return MAC_FIXTURE;
    };

    expect(await importSwiftStreak(db, read, TZ)).toBe(13);
    expect(marker(raw)).toBe("done");
    const rows = raw
      .query<
        { date: string; item_id: string; value: number; updated_at: number; dirty: number },
        []
      >("SELECT date, item_id, value, updated_at, dirty FROM entries ORDER BY date, item_id")
      .all();
    expect(rows).toHaveLength(15);
    expect(rows.find((r) => r.date === "2026-10-15" && r.item_id === "fajr")).toMatchObject({
      value: 0,
      updated_at: 900,
    });
    expect(rows.find((r) => r.date === "2026-10-17" && r.item_id === "dhuhr")).toMatchObject({
      value: 7,
      updated_at: 900,
    });
    const imported = rows.filter((r) => r.updated_at === SWIFT_IMPORT_STAMP);
    expect(imported).toHaveLength(13);
    expect(imported.every((r) => r.value === FLAG.DONE && r.dirty === 1)).toBe(true);

    // One-time: a later launch does not even read iCloud again.
    expect(await importSwiftStreak(db, read, TZ)).toBe(0);
    expect(reads).toBe(1);
  });

  test("nothing in iCloud yet: retried on later launches, then given up", async () => {
    const { raw, db } = await migratedDb();
    let reads = 0;
    const read = () => {
      reads++;
      return null;
    };
    for (let i = 1; i < SWIFT_IMPORT_TRIES; i++) {
      expect(await importSwiftStreak(db, read, TZ)).toBe(0);
      expect(marker(raw)).toBe(String(i));
    }
    expect(await importSwiftStreak(db, read, TZ)).toBe(0);
    expect(marker(raw)).toBe("done");
    await importSwiftStreak(db, read, TZ);
    expect(reads).toBe(SWIFT_IMPORT_TRIES);
  });

  test("the value arriving on a later launch is still imported", async () => {
    const { db } = await migratedDb();
    expect(await importSwiftStreak(db, () => null, TZ)).toBe(0);
    expect(await importSwiftStreak(db, () => MAC_FIXTURE, TZ)).toBe(15);
  });

  test("an unreadable value is final and adds nothing", async () => {
    const { raw, db } = await migratedDb();
    expect(await importSwiftStreak(db, () => "{}", TZ)).toBe(0);
    expect(marker(raw)).toBe("done");
    expect(raw.query("SELECT COUNT(*) AS n FROM entries").get()).toEqual({ n: 0 });
  });

  test("on sign-in the account's own record of a day wins over the import", async () => {
    const { raw, db } = await migratedDb();
    await importSwiftStreak(db, () => MAC_FIXTURE, TZ);
    // The Mac app synced this day already, prayed on time and in jamaah.
    const remote = { date: "2026-10-20", itemId: "fajr", value: 7, updatedAt: 1_000 };
    const pushed: string[] = [];
    await prepareAccount(db, "u");
    await runSync(createSqliteStore(db, "u"), {
      pull: async () => ({ entries: [remote], settings: [], cursor: "1", hasMore: false }),
      push: async (entries) => {
        pushed.push(...entries.map((e) => `${e.date}|${e.itemId}`));
      },
    });
    expect(
      raw
        .query<{ value: number }, []>(
          "SELECT value FROM entries WHERE date = '2026-10-20' AND item_id = 'fajr'",
        )
        .get(),
    ).toEqual({ value: 7 });
    expect(pushed).toHaveLength(14);
    expect(pushed).not.toContain("2026-10-20|fajr");
  });
});
