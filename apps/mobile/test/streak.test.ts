import { describe, expect, test } from "bun:test";

import { addDays, type DayKey } from "../src/mutabaah/dates";
import { BUILTIN_ITEMS } from "../src/mutabaah/items";
import {
  computeStreak,
  countedDays,
  DEFAULT_STREAK_CONFIG,
  endPause,
  parseStreakConfig,
  serializeStreakConfig,
  startPause,
  type StreakConfig,
} from "../src/mutabaah/streak";

const D0 = "2026-03-01";
const day = (n: number): DayKey => addDays(D0, n);
const cfg = (patch: Partial<StreakConfig> = {}): StreakConfig => ({
  ...DEFAULT_STREAK_CONFIG,
  ...patch,
});
const days = (...ns: number[]) => new Set(ns.map(day));

describe("computeStreak", () => {
  test("no history", () => {
    const r = computeStreak(new Set(), day(5), cfg());
    expect(r).toMatchObject({
      current: 0,
      best: 0,
      forgiven: 0,
      graceLeft: 1,
      countedToday: false,
    });
  });

  test("consecutive days including today", () => {
    const r = computeStreak(days(0, 1, 2, 3), day(3), cfg());
    expect(r.current).toBe(4);
    expect(r.best).toBe(4);
    expect(r.countedToday).toBe(true);
  });

  test("today still open does not break or reset the streak", () => {
    const r = computeStreak(days(0, 1, 2), day(3), cfg());
    expect(r.current).toBe(3);
    expect(r.countedToday).toBe(false);
  });

  test("one miss is forgiven with the default grace and adds nothing", () => {
    const r = computeStreak(days(0, 1, 3, 4), day(4), cfg());
    expect(r.current).toBe(4);
    expect(r.forgiven).toBe(1);
    expect(r.graceLeft).toBe(0);
  });

  test("two misses in a week break the streak when grace is 1", () => {
    const r = computeStreak(days(0, 1, 2, 5), day(5), cfg({ graceDays: 1 }));
    expect(r.current).toBe(1);
    expect(r.best).toBe(3);
  });

  test("two consecutive misses are fine with grace 2", () => {
    const r = computeStreak(days(0, 1, 4), day(4), cfg({ graceDays: 2 }));
    expect(r.current).toBe(3);
    expect(r.forgiven).toBe(2);
  });

  test("grace 0 is strict", () => {
    const r = computeStreak(days(0, 1, 3), day(3), cfg({ graceDays: 0 }));
    expect(r.current).toBe(1);
    expect(r.best).toBe(2);
  });

  test("grace refills after the 7-day window", () => {
    // miss day 2, counted 3..9, miss day 10 (8 days after the first forgiven miss), counted 11
    const r = computeStreak(days(0, 1, 3, 4, 5, 6, 7, 8, 9, 11), day(11), cfg({ graceDays: 1 }));
    expect(r.current).toBe(10);
    expect(r.forgiven).toBe(2);
  });

  test("misses before the first counted day are not held against the user", () => {
    const r = computeStreak(days(10, 11), day(11), cfg());
    expect(r.current).toBe(2);
    expect(r.forgiven).toBe(0);
  });

  test("a long gap resets, then a new streak starts at one", () => {
    const r = computeStreak(days(0, 1, 2, 3, 20), day(20), cfg());
    expect(r.current).toBe(1);
    expect(r.best).toBe(4);
  });

  test("paused days neither count nor break", () => {
    const config = cfg({ graceDays: 0, pauses: [{ from: day(2), to: day(6) }] });
    const r = computeStreak(days(0, 1, 7), day(7), config);
    expect(r.current).toBe(3);
  });

  test("an open pause covers today and keeps the streak", () => {
    const config = cfg({ graceDays: 0, pauses: [{ from: day(3), to: null }] });
    const r = computeStreak(days(0, 1, 2), day(9), config);
    expect(r.current).toBe(3);
    expect(r.paused).toBe(true);
  });

  test("future entries are ignored", () => {
    const r = computeStreak(days(0, 1, 9), day(1), cfg());
    expect(r.current).toBe(2);
  });
});

describe("pauses", () => {
  test("start then resume the same day leaves nothing behind", () => {
    const started = startPause(cfg(), day(4));
    expect(started.pauses).toEqual([{ from: day(4), to: null }]);
    expect(endPause(started, day(4)).pauses).toEqual([]);
  });

  test("resume closes the range at yesterday", () => {
    const started = startPause(cfg(), day(4));
    expect(endPause(started, day(7)).pauses).toEqual([{ from: day(4), to: day(6) }]);
  });

  test("starting twice is a no-op", () => {
    const started = startPause(cfg(), day(4));
    expect(startPause(started, day(5))).toBe(started);
  });

  test("resume keeps older finished pauses", () => {
    const config = cfg({
      pauses: [
        { from: day(0), to: day(1) },
        { from: day(4), to: null },
      ],
    });
    expect(endPause(config, day(6)).pauses).toEqual([
      { from: day(0), to: day(1) },
      { from: day(4), to: day(5) },
    ]);
  });
});

describe("countedDays", () => {
  const entries = [
    { date: day(0), itemId: "fajr", value: 3 },
    { date: day(0), itemId: "dhuhr", value: 3 },
    { date: day(0), itemId: "asr", value: 1 },
    { date: day(1), itemId: "fajr", value: 3 },
    { date: day(1), itemId: "dhuha", value: 1 },
    { date: day(2), itemId: "fajr", value: 4 }, // jamaah flag without DONE is not done
    { date: day(2), itemId: "tilawah", value: 0 },
    { date: day(3), itemId: "removed-item", value: 1 },
  ];

  test("needs minDone done items from the enabled list", () => {
    expect([...countedDays(entries, BUILTIN_ITEMS, 3)]).toEqual([day(0)]);
    expect([...countedDays(entries, BUILTIN_ITEMS, 2)].sort()).toEqual([day(0), day(1)]);
  });

  test("items no longer on the list do not count", () => {
    expect(countedDays(entries, BUILTIN_ITEMS, 1).has(day(3))).toBe(false);
  });

  test("threshold is capped by the number of enabled items", () => {
    const only = BUILTIN_ITEMS.filter((i) => i.id === "fajr");
    expect([...countedDays(entries, only, 5)].sort()).toEqual([day(0), day(1)]);
  });
});

describe("streak config storage", () => {
  test("round trips", () => {
    const config = cfg({ graceDays: 2, minDone: 5, pauses: [{ from: day(1), to: null }] });
    expect(parseStreakConfig(serializeStreakConfig(config))).toEqual(config);
  });

  test("bad input falls back to defaults", () => {
    expect(parseStreakConfig("not json")).toEqual(DEFAULT_STREAK_CONFIG);
    expect(parseStreakConfig(null)).toEqual(DEFAULT_STREAK_CONFIG);
    expect(parseStreakConfig('{"graceDays":99,"minDone":0,"pauses":[{"from":"nope"}]}')).toEqual(
      DEFAULT_STREAK_CONFIG,
    );
  });
});
