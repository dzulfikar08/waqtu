import { describe, expect, test } from "bun:test";

import { addDays, dayKeyInZone, diffDays, isDayKey, lastDays } from "../src/mutabaah/dates";
import { BUILTIN_ITEMS, FLAG } from "../src/mutabaah/items";
import { summarizeWeek } from "../src/mutabaah/week";

const END = "2026-03-08";

describe("summarizeWeek", () => {
  const entries = [
    { date: "2026-03-08", itemId: "fajr", value: FLAG.DONE | FLAG.ONTIME | FLAG.JAMAAH },
    { date: "2026-03-08", itemId: "dhuhr", value: FLAG.DONE | FLAG.QADHA },
    { date: "2026-03-08", itemId: "tilawah", value: 4 },
    { date: "2026-03-07", itemId: "fajr", value: FLAG.DONE | FLAG.ONTIME },
    { date: "2026-03-07", itemId: "tilawah", value: 3 },
    { date: "2026-03-01", itemId: "fajr", value: FLAG.DONE }, // outside the 7-day window
    { date: "2026-03-06", itemId: "isha", value: 0 }, // recorded but not done
  ];

  test("totals, flags and pages", () => {
    const w = summarizeWeek(entries, BUILTIN_ITEMS, END, 3);
    expect(w.days).toHaveLength(7);
    expect(w.days[0].date).toBe("2026-03-02");
    expect(w.days[6].date).toBe(END);
    expect(w.fardhDone).toBe(3);
    expect(w.fardhOnTime).toBe(2);
    expect(w.fardhJamaah).toBe(1);
    expect(w.fardhQadha).toBe(1);
    expect(w.pages).toBe(7);
    expect(w.fardhEnabled).toBe(5);
    expect(w.countedDays).toBe(1);
    expect(w.bestDay).toBe(END);
    expect(w.items[0]).toEqual({ id: "fajr", daysDone: 2 });
  });

  test("a quiet week is just zeros, with no best day", () => {
    const w = summarizeWeek([], BUILTIN_ITEMS, END, 3);
    expect(w.countedDays).toBe(0);
    expect(w.bestDay).toBeNull();
    expect(w.pages).toBe(0);
  });
});

describe("dates", () => {
  test("add, diff, validate", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(diffDays("2026-03-08", "2026-03-01")).toBe(7);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-03-08")).toBe(true);
    expect(lastDays("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });

  test("day key follows the zone, not UTC", () => {
    const instant = new Date("2026-03-01T20:00:00Z"); // already 2 March in Jakarta
    expect(dayKeyInZone(instant, "Asia/Jakarta")).toBe("2026-03-02");
    expect(dayKeyInZone(instant, "UTC")).toBe("2026-03-01");
  });
});
