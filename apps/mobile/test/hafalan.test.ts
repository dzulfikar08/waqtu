import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  buildUnits,
  dailyPortion,
  newUnitState,
  gradeUnit,
  resolveTarget,
  SURAHS,
  TOTAL_AYAHS,
  type HafalanPlan,
} from "@waqtu/core";

import { getEntriesBetween } from "../src/db/entries";
import { MIGRATIONS } from "../src/db/migrations";
import {
  deletePlan,
  deleteRecording,
  getPlan,
  getRecordings,
  getStates,
  gradeUnitToday,
  MUROJAAH_ITEM_ID,
  planUnits,
  saveRecording,
  savePlan,
  updatePlan,
} from "../src/hafalan/db";
import { arabicDigits, formatSeconds, nextTodo, unitLabel, unitRole } from "../src/hafalan/format";
import { SURAH_LOADERS } from "../src/hafalan/surahLoaders";
import { surahAyahs, unitBlocks, wordCount, wordKeys } from "../src/hafalan/text";
import { BUILTIN_ITEMS, DEFAULT_ITEMS } from "../src/mutabaah/items";
import { migratedDb } from "./helpers/sqlite";

const verbatim = readFileSync(
  new URL("../../../content/quran/quran-uthmani-1.1.txt", import.meta.url),
  "utf8",
);
const lines = verbatim.split("\n").filter((l) => /^\d/.test(l));

describe("bundled Quran text", () => {
  test("one module per surah, 114 in all, each carrying Tanzil's notice", () => {
    expect(SURAH_LOADERS).toHaveLength(114);
    for (const [i, load] of SURAH_LOADERS.entries()) {
      const file = load();
      expect(file.surah).toBe(i + 1);
      expect(file.notice).toContain("Tanzil");
      expect(file.notice).toContain("Creative Commons Attribution 3.0");
      expect(file.notice).toContain("changing the text is not allowed");
    }
  });

  test("the bundled ayahs are exactly Tanzil's verbatim file: 6236 of them, in order", () => {
    const bundled = SURAH_LOADERS.flatMap((load, i) =>
      load().ayahs.map((text, a) => `${i + 1}|${a + 1}|${text}`),
    );
    expect(bundled).toHaveLength(TOTAL_AYAHS);
    expect(bundled).toEqual(lines);
    for (const [i, s] of SURAHS.entries()) expect(surahAyahs(i + 1)).toHaveLength(s.ayahs);
    expect(() => surahAyahs(0)).toThrow(RangeError);
    expect(() => surahAyahs(115)).toThrow(RangeError);
  });

  test("the per-surah files stay compact (lazy-loadable, no whitespace padding)", () => {
    const size = SURAH_LOADERS.reduce((n, load) => n + JSON.stringify(load()).length, 0);
    expect(size).toBeLessThan(1_700_000);
  });
});

describe("unit text", () => {
  test("every unit of the whole Quran shows exactly its stored ayahs: Bismillah heading + words", () => {
    const units = buildUnits({ start: 0, end: TOTAL_AYAHS - 1 });
    let ayahs = 0;
    for (const unit of units) {
      for (const block of unitBlocks(unit)) {
        for (const [k, ayah] of block.ayahs.entries()) {
          const stored = surahAyahs(ayah.surah)[ayah.ayah - 1];
          const head = k === 0 && block.bismillah !== null ? `${block.bismillah} ` : "";
          expect(head + ayah.words.join(" ")).toBe(stored);
          ayahs++;
        }
      }
    }
    expect(ayahs).toBe(TOTAL_AYAHS);
  });

  test("a unit that starts a surah gets its heading and Bismillah; surah 9 and 1 have none lifted out", () => {
    const [first] = buildUnits(resolveTarget({ kind: "surah", from: 2, to: 2 }));
    const [block] = unitBlocks(first);
    expect(block.startsSurah).toBe(true);
    expect(block.bismillah).not.toBeNull();
    const [tawbah] = buildUnits(resolveTarget({ kind: "surah", from: 9, to: 9 }));
    expect(unitBlocks(tawbah)[0].bismillah).toBeNull();
    const [fatihah] = buildUnits(resolveTarget({ kind: "surah", from: 1, to: 1 }));
    expect(unitBlocks(fatihah)[0].bismillah).toBeNull();
    expect(unitBlocks(fatihah)[0].ayahs[0].words).toHaveLength(4);
  });

  test("a unit that crosses a surah boundary has one block per surah, in order", () => {
    const blocks = unitBlocks({ start: 6221, end: 6235 });
    expect(blocks.map((b) => b.surah)).toEqual([112, 113, 114]);
    expect(blocks.map((b) => b.startsSurah)).toEqual([true, true, true]);
    expect(wordCount(blocks)).toBe(wordKeys(blocks).length);
    expect(new Set(wordKeys(blocks)).size).toBe(wordKeys(blocks).length);
  });

  test("labels and formatting", () => {
    expect(unitLabel({ start: 0, end: 6 })).toBe("Al-Fatihah 1–7");
    expect(unitLabel({ start: 6221, end: 6221 })).toBe("Al-Ikhlas 1");
    expect(unitLabel({ start: 6224, end: 6226 })).toBe("Al-Ikhlas 4 – Al-Falaq 2");
    expect(arabicDigits(286)).toBe("\u0662\u0668\u0666");
    expect(formatSeconds(75)).toBe("1:15");
    expect(formatSeconds(-3)).toBe("0:00");
  });
});

const PLAN: HafalanPlan = {
  target: { kind: "juz", from: 30, to: 30 },
  startDay: "2027-03-01",
  deadline: "2027-03-30",
  maxReviewPerDay: 12,
};

describe("hafalan storage", () => {
  test("migrated: the hafalan tables exist at the current schema version", async () => {
    const { raw } = await migratedDb();
    const version = raw.query("PRAGMA user_version").get() as { user_version: number };
    expect(version.user_version).toBe(MIGRATIONS.length);
    const tables = raw
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'hafalan_%'")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name).sort()).toEqual([
      "hafalan_plan",
      "hafalan_recording",
      "hafalan_unit",
    ]);
  });

  test("a plan round-trips, can be moved on, and an invalid one is refused", async () => {
    const { db } = await migratedDb();
    expect(await getPlan(db)).toBeNull();
    await savePlan(db, PLAN);
    expect(await getPlan(db)).toEqual(PLAN);
    await updatePlan(db, { deadline: "2027-04-06", maxReviewPerDay: 20 });
    expect(await getPlan(db)).toEqual({ ...PLAN, deadline: "2027-04-06", maxReviewPerDay: 20 });
    await expect(updatePlan(db, { deadline: "2027-02-01" })).rejects.toThrow(RangeError);
    await expect(
      savePlan(db, { ...PLAN, target: { kind: "juz", from: 31, to: 31 } }),
    ).rejects.toThrow(RangeError);
    expect((await getPlan(db))?.deadline).toBe("2027-04-06");
  });

  test("grading stores the scheduler state and refuses a second grade the same day", async () => {
    const { db } = await migratedDb();
    await savePlan(db, PLAN);
    const first = await gradeUnitToday(db, 0, 4, "2027-03-01");
    expect(first?.state).toMatchObject({ unit: 0, learnedOn: "2027-03-01", due: "2027-03-02" });
    expect(await getStates(db)).toEqual([first?.state as never]);
    expect(await gradeUnitToday(db, 0, 5, "2027-03-01")).toBeNull();
    expect((await getStates(db))[0].lastGrade).toBe(4);
    expect(await gradeUnitToday(db, 9999, 4, "2027-03-01")).toBeNull();
    const next = await gradeUnitToday(db, 0, 5, "2027-03-02");
    expect(next?.state).toMatchObject({ interval: 6, reps: 2, lastGrade: 5 });
  });

  test("grading without a plan does nothing", async () => {
    const { db } = await migratedDb();
    expect(await gradeUnitToday(db, 0, 4, "2027-03-01")).toBeNull();
    expect(await getEntriesBetween(db, "2027-03-01", "2027-03-01")).toEqual([]);
  });

  test("clearing today's list writes the dirty `murojaah` mutabaah entry, and not before", async () => {
    const { db, raw } = await migratedDb();
    await savePlan(db, PLAN);
    const units = planUnits(PLAN);
    const target = dailyPortion(PLAN, units.length, [], "2027-03-01").sabaq.todo;
    expect(target.length).toBeGreaterThan(1);

    for (const unit of target.slice(0, -1)) {
      const r = await gradeUnitToday(db, unit, 4, "2027-03-01");
      expect(r?.dayComplete).toBe(false);
    }
    expect(await getEntriesBetween(db, "2027-03-01", "2027-03-01")).toEqual([]);

    const last = await gradeUnitToday(db, target.at(-1) as number, 4, "2027-03-01");
    expect(last?.dayComplete).toBe(true);
    expect(await getEntriesBetween(db, "2027-03-01", "2027-03-01")).toEqual([
      { date: "2027-03-01", itemId: MUROJAAH_ITEM_ID, value: 1 },
    ]);
    const row = raw.query("SELECT dirty FROM entries WHERE item_id = 'murojaah'").get() as {
      dirty: number;
    };
    expect(row.dirty).toBe(1);
  });

  test("the day after, reviewing every due unit is what completes it (new portion included)", async () => {
    const { db } = await migratedDb();
    await savePlan(db, PLAN);
    const units = planUnits(PLAN).length;
    for (const unit of dailyPortion(PLAN, units, [], "2027-03-01").sabaq.todo) {
      await gradeUnitToday(db, unit, 5, "2027-03-01");
    }
    let portion = dailyPortion(PLAN, units, await getStates(db), "2027-03-02");
    const todo = [...portion.murojaah.todo, ...portion.sabaq.todo];
    expect(portion.murojaah.todo.length).toBeGreaterThan(0);
    let completed = false;
    for (const unit of todo) {
      completed = (await gradeUnitToday(db, unit, 4, "2027-03-02"))?.dayComplete ?? false;
    }
    expect(completed).toBe(true);
    portion = dailyPortion(PLAN, units, await getStates(db), "2027-03-02");
    expect(portion.complete).toBe(true);
    expect((await getEntriesBetween(db, "2027-03-02", "2027-03-02"))[0]).toMatchObject({
      itemId: "murojaah",
      value: 1,
    });
  });

  test("murojaah is a built-in mutabaah item that is not in the default checklist", () => {
    expect(BUILTIN_ITEMS.find((i) => i.id === "murojaah")).toEqual({
      id: "murojaah",
      kind: "check",
    });
    expect(DEFAULT_ITEMS.some((i) => i.id === "murojaah")).toBe(false);
  });

  test("recordings: kept per unit, replaced, deleted; the files to remove are returned", async () => {
    const { db } = await migratedDb();
    await savePlan(db, PLAN);
    expect(await saveRecording(db, 3, "a.m4a", 40)).toBeNull();
    expect(await saveRecording(db, 3, "b.m4a", 55)).toBe("a.m4a");
    expect(await saveRecording(db, 5, "c.m4a", 10)).toBeNull();
    expect([...(await getRecordings(db))]).toEqual([
      [3, { file: "b.m4a", seconds: 55 }],
      [5, { file: "c.m4a", seconds: 10 }],
    ]);
    expect(await deleteRecording(db, 3)).toBe("b.m4a");
    expect(await deleteRecording(db, 3)).toBeNull();
    expect((await getRecordings(db)).size).toBe(1);
  });

  test("replacing or deleting the plan drops progress and returns every recording file", async () => {
    const { db } = await migratedDb();
    await savePlan(db, PLAN);
    await gradeUnitToday(db, 0, 4, "2027-03-01");
    await saveRecording(db, 0, "x.m4a", 20);
    await saveRecording(db, 1, "y.m4a", 30);
    const replaced = await savePlan(db, { ...PLAN, target: { kind: "surah", from: 112, to: 112 } });
    expect(replaced.sort()).toEqual(["x.m4a", "y.m4a"]);
    expect(await getStates(db)).toEqual([]);
    expect((await getRecordings(db)).size).toBe(0);
    await saveRecording(db, 0, "z.m4a", 5);
    expect(await deletePlan(db)).toEqual(["z.m4a"]);
    expect(await getPlan(db)).toBeNull();
  });
});

describe("today's list helpers", () => {
  const units = planUnits(PLAN).length;
  const learned = [gradeUnit(newUnitState(0), 4, "2027-03-01")];
  const portion = dailyPortion(PLAN, units, learned, "2027-03-02");

  test("role of a unit and the next one to do", () => {
    expect(unitRole(portion, 0)).toBe("murojaah");
    expect(unitRole(portion, portion.sabaq.todo[0])).toBe("sabaq");
    expect(unitRole(portion, units - 1)).toBe("other");
    expect(nextTodo(portion, portion.sabaq.todo[0])).not.toBe(portion.sabaq.todo[0]);
    const done = dailyPortion(PLAN, units, [gradeUnit(learned[0], 5, "2027-03-02")], "2027-03-02");
    expect(unitRole(done, 0)).toBe("done");
  });
});
