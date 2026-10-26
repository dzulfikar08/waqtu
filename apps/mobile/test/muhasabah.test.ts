import { describe, expect, test } from "bun:test";

import { MIGRATIONS } from "../src/db/migrations";
import { MUHASABAH_MIGRATION } from "../src/ibadah/migrations";
import {
  QUESTIONS,
  averageRating,
  cleanEntry,
  completion,
  deleteMuhasabah,
  emptyEntry,
  getMuhasabah,
  getMuhasabahBetween,
  hasContent,
  monthWeeks,
  ratingTrend,
  saveMuhasabah,
  shiftMonth,
  summarizeTrend,
  type MuhasabahEntry,
} from "../src/ibadah/muhasabah";
import { addDays } from "../src/mutabaah/dates";
import { migratedDb } from "./helpers/sqlite";

const TODAY = "2027-02-12";

function entry(date: string, fields: Partial<MuhasabahEntry> = {}): MuhasabahEntry {
  return { ...emptyEntry(date), ...fields };
}

describe("muhasabah storage", () => {
  test("its table is the newest migration step, appended after the shipped ones", () => {
    expect(MIGRATIONS.at(-1)).toBe(MUHASABAH_MIGRATION);
    expect(MIGRATIONS.indexOf(MUHASABAH_MIGRATION)).toBe(7);
  });

  test("save, read back, update and delete one day", async () => {
    const { db } = await migratedDb();
    expect(await getMuhasabah(db, TODAY)).toBeNull();
    const saved = await saveMuhasabah(
      db,
      entry(TODAY, { feelings: "  Tenang  ", taqwa: 7, gratitude: 9 }),
      1000,
    );
    expect(saved).toEqual(entry(TODAY, { feelings: "Tenang", taqwa: 7, gratitude: 9 }));
    expect(await getMuhasabah(db, TODAY)).toEqual(saved);

    await saveMuhasabah(db, entry(TODAY, { feelings: "Lebih baik", energy: 5 }), 2000);
    expect(await getMuhasabah(db, TODAY)).toEqual(
      entry(TODAY, { feelings: "Lebih baik", energy: 5 }),
    );

    await deleteMuhasabah(db, TODAY);
    expect(await getMuhasabah(db, TODAY)).toBeNull();
  });

  test("an update keeps the first creation time", async () => {
    const { db, raw } = await migratedDb();
    await saveMuhasabah(db, entry(TODAY, { taqwa: 5 }), 1000);
    await saveMuhasabah(db, entry(TODAY, { taqwa: 6 }), 5000);
    expect(raw.query("SELECT created_at, updated_at FROM muhasabah").get()).toEqual({
      created_at: 1000,
      updated_at: 5000,
    });
  });

  test("saving an empty reflection removes the day instead of storing blanks", async () => {
    const { db } = await migratedDb();
    await saveMuhasabah(db, entry(TODAY, { newAction: "Sedekah" }));
    expect(await saveMuhasabah(db, entry(TODAY, { newAction: "   " }))).toBeNull();
    expect(await getMuhasabah(db, TODAY)).toBeNull();
  });

  test("ratings outside 1–10 are dropped before they reach the table, which also refuses them", async () => {
    const { db, raw } = await migratedDb();
    await saveMuhasabah(
      db,
      entry(TODAY, { taqwa: 11, gratitude: 0, energy: 4.5, willingness: 10 }),
    );
    expect(await getMuhasabah(db, TODAY)).toEqual(entry(TODAY, { willingness: 10 }));
    expect(() =>
      raw.run(
        "INSERT INTO muhasabah (date, taqwa, created_at, updated_at) VALUES ('2027-01-01', 12, 0, 0)",
      ),
    ).toThrow();
  });

  test("a range comes back oldest first", async () => {
    const { db } = await migratedDb();
    for (const back of [0, 3, 1, 40]) {
      await saveMuhasabah(db, entry(addDays(TODAY, -back), { taqwa: 5 }));
    }
    const rows = await getMuhasabahBetween(db, addDays(TODAY, -29), TODAY);
    expect(rows.map((r) => r.date)).toEqual(["2027-02-09", "2027-02-11", "2027-02-12"]);
  });

  test("private: nothing is queued for sync", async () => {
    const { db, raw } = await migratedDb();
    await saveMuhasabah(db, entry(TODAY, { feelings: "Rahasia", taqwa: 8 }));
    expect(raw.query("SELECT COUNT(*) AS n FROM entries").get()).toEqual({ n: 0 });
    expect(raw.query("SELECT COUNT(*) AS n FROM settings WHERE dirty = 1").get()).toEqual({ n: 0 });
  });
});

describe("muhasabah answers", () => {
  test("seven questions in the Mutabaah app's order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "feelings",
      "newAction",
      "taqwa",
      "gratitude",
      "energy",
      "willingness",
      "continueTomorrow",
    ]);
  });

  test("content, completion and the mean rating", () => {
    expect(hasContent(emptyEntry(TODAY))).toBe(false);
    expect(hasContent(entry(TODAY, { feelings: " " }))).toBe(false);
    expect(hasContent(entry(TODAY, { energy: 3 }))).toBe(true);
    expect(completion(entry(TODAY, { feelings: "a", taqwa: 2 }))).toBeCloseTo(2 / 7);
    expect(averageRating(entry(TODAY, { taqwa: 8, gratitude: 9, energy: 4 }))).toBe(7);
    expect(averageRating(entry(TODAY, { feelings: "a" }))).toBeNull();
  });

  test("text is trimmed and capped", () => {
    const long = "x".repeat(5000);
    expect(cleanEntry(entry(TODAY, { feelings: long })).feelings).toHaveLength(4000);
    expect(cleanEntry(entry(TODAY, { continueTomorrow: "\n  " })).continueTomorrow).toBeNull();
  });
});

describe("muhasabah trends", () => {
  const entries = [
    entry(addDays(TODAY, -40), { taqwa: 1 }),
    entry(addDays(TODAY, -20), { taqwa: 4, gratitude: 6 }),
    entry(addDays(TODAY, -16), { energy: 4 }),
    entry(addDays(TODAY, -5), { taqwa: 8, gratitude: 8, energy: 6, willingness: 10 }),
    entry(TODAY, { feelings: "Tanpa nilai" }),
  ];

  test("30 days ending today, oldest first, a mean per day", () => {
    const trend = ratingTrend(entries, TODAY, 30);
    expect(trend).toHaveLength(30);
    expect(trend[0].date).toBe(addDays(TODAY, -29));
    expect(trend.at(-1)).toEqual({ date: TODAY, average: null });
    expect(trend.find((d) => d.date === addDays(TODAY, -20))?.average).toBe(5);
    expect(trend.find((d) => d.date === addDays(TODAY, -5))?.average).toBe(8);
    expect(trend.filter((d) => d.average !== null)).toHaveLength(3);
  });

  test("summary: days written, mean, per aspect, and the change between halves", () => {
    const summary = summarizeTrend(entries, TODAY, 30);
    expect(summary.daysWritten).toBe(4);
    expect(summary.average).toBeCloseTo((5 + 4 + 8) / 3);
    expect(summary.aspects).toEqual({ taqwa: 6, gratitude: 7, energy: 5, willingness: 10 });
    // Earlier half (days 29..15 back): 5 and 4 → 4.5; later half: 8.
    expect(summary.change).toBeCloseTo(3.5);
  });

  test("no ratings: no mean and no change", () => {
    const summary = summarizeTrend([entry(TODAY, { feelings: "a" })], TODAY, 30);
    expect(summary).toEqual({
      daysWritten: 1,
      average: null,
      aspects: { taqwa: null, gratitude: null, energy: null, willingness: null },
      change: null,
    });
  });
});

describe("muhasabah calendar", () => {
  test("February 2027 starts on a Monday and fills four weeks", () => {
    const weeks = monthWeeks(2027, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2027-02-01");
    expect(weeks[3][6]).toBe("2027-02-28");
  });

  test("padding before the 1st and after the last day", () => {
    const weeks = monthWeeks(2026, 10);
    // 1 Oct 2026 is a Thursday.
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  test("month arithmetic across the year", () => {
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2027, 2, -14)).toEqual({ year: 2025, month: 12 });
  });
});
