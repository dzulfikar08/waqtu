import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { getSetting } from "../src/db/settings";
import { headingOf, needsCalibration, unwrapAngle } from "../src/ibadah/compass";
import {
  ContentError,
  SESSION_IDS,
  dzikirSession,
  findDua,
  loadDuas,
  loadSession,
  matsuratSession,
  parseDhikr,
  parseDuas,
  parseMatsurat,
  type ReaderSession,
} from "../src/ibadah/content";
import {
  categoryName,
  duaTitle,
  foldForSearch,
  parseFavourites,
  searchDuas,
  serializeFavourites,
  toggleFavourite,
} from "../src/ibadah/labels";
import { writeLocal } from "../src/ibadah/local";
import {
  doneCount,
  isItemDone,
  mutabaahItemFor,
  nextOpenItem,
  parseProgress,
  progressKey,
  remaining,
  resetItem,
  serializeProgress,
  sessionProgress,
  suggestedTime,
  tapItem,
  type Counts,
} from "../src/ibadah/reader";
import { suggestTimeAt } from "../src/ibadah/suggest";
import {
  DEFAULT_TASBIH,
  MAX_CUSTOM_TARGET,
  TASBIH_KEY,
  TasbihContentError,
  addedCount,
  choosePreset,
  linkableItems,
  linkedItemOf,
  loadPhrases,
  parsePhrases,
  parseTasbih,
  positionOf,
  presetPhases,
  reset,
  serializeTasbih,
  setCustomTarget,
  tap,
  undo,
  type TasbihState,
} from "../src/ibadah/tasbih";
import { isSyncedSettingKey } from "../src/mutabaah/syncKeys";
import { DEFAULT_ITEMS, type ItemDef } from "../src/mutabaah/items";
import { parsePrayerSettings } from "../src/prayer/config";
import { migratedDb } from "./helpers/sqlite";

const ADHKAR = new URL("../../../content/adhkar/", import.meta.url);
const raw = (file: string) => readFileSync(new URL(file, ADHKAR));
const json = (file: string): unknown => JSON.parse(raw(file).toString("utf8"));

/**
 * SHA-256 of the files as copied from the Mutabaah app's Resources (tasbih.json: its TasbihPreset list). A formatter or
 * a hand edit that touches a byte of the Arabic fails here.
 */
const PINNED: Record<string, string> = {
  "duas.json": "44b92d396af50d6b4e2a113fa1c6385be8b12af407d0081e7df2ba2e56bbbb6a",
  "evening_dhikr.json": "1b8c8b0ed77c167d32881bf85ad48591c005758990ce85b609dc51b07cf1db4d",
  "kubro-pagi.json": "fccaf80a4aaf22a59be4b544fdcffe17fcf1adfc9fbd2d10f3a57c8728e7ac8b",
  "kubro-petang.json": "98b64f6a8c0ef67732c77a68054317cd3d3f151200cc9e9cc5850de458ae51a6",
  "morning_dhikr.json": "433e310ae46f74f8f6fce43c299731294d87459dc995578de4daaeae8eea36d3",
  "sugro-pagi.json": "5d66b65d960eb6b03d1f97acb88093cf7cc2b9ba3854b66284a0f3d8225f91a8",
  "sugro-petang.json": "2ffe51790503148d5e668d076c68465b5d6549f591ef5172e2c95297c370a1ff",
  "tasbih.json": "5675a8ddd44a083281841c1f36b1de2d5fcc46a4a4fa075aa7c53486f915144e",
};

describe("bundled adhkar content", () => {
  test.each(Object.entries(PINNED))("%s is byte-for-byte the copied file", (file, sha) => {
    expect(createHash("sha256").update(raw(file)).digest("hex")).toBe(sha);
  });

  test("every session loads, with the expected size and translation language", () => {
    const expected: Record<string, { items: number; reps: number; lang: string }> = {
      "matsurat-kubro-pagi": { items: 40, reps: 199, lang: "id" },
      "matsurat-kubro-petang": { items: 40, reps: 199, lang: "id" },
      "matsurat-sughro-pagi": { items: 32, reps: 191, lang: "id" },
      "matsurat-sughro-petang": { items: 32, reps: 195, lang: "id" },
      "dzikir-pagi": { items: 15, reps: 238, lang: "en" },
      "dzikir-petang": { items: 15, reps: 238, lang: "en" },
    };
    expect([...SESSION_IDS].sort()).toEqual(Object.keys(expected).sort());
    for (const id of SESSION_IDS) {
      const session = loadSession(id);
      expect(session.id).toBe(id);
      expect(session.items).toHaveLength(expected[id].items);
      expect(session.items.reduce((sum, item) => sum + item.repeat, 0)).toBe(expected[id].reps);
      expect(session.translationLang).toBe(expected[id].lang);
      expect(new Set(session.items.map((item) => item.key)).size).toBe(session.items.length);
      for (const item of session.items) {
        expect(item.lines.length).toBeGreaterThan(0);
        for (const line of item.lines) expect(line.arabic.trim()).not.toBe("");
      }
    }
  });

  test("Arabic is passed through exactly as stored", () => {
    const file = json("kubro-pagi.json") as { data: { arabic: string; data?: { arabic: string }[] }[] };
    const session = loadSession("matsurat-kubro-pagi");
    for (const [i, entry] of file.data.entries()) {
      const item = session.items[i];
      if (entry.data) {
        expect(item.heading?.arabic).toBe(entry.arabic);
        expect(item.lines.map((l) => l.arabic)).toEqual(entry.data.map((v) => v.arabic));
      } else {
        expect(item.lines[0].arabic).toBe(entry.arabic);
      }
    }
    const morning = json("morning_dhikr.json") as {
      items: { id: string; arabic: string; reference: string }[];
    };
    for (const entry of morning.items) {
      const item = loadSession("dzikir-pagi").items.find((it) => it.key === entry.id);
      expect(item?.lines[0].arabic).toBe(entry.arabic);
      expect(item?.reference).toBe(entry.reference);
    }
  });

  test("dhikr follow their `order`; passages keep their ayat", () => {
    const session = loadSession("dzikir-petang");
    expect(session.items[0].key).toBe("evening-001");
    expect(session.items.at(-1)?.key).toBe("evening-015");
    const fatihah = loadSession("matsurat-sughro-petang").items[1];
    expect(fatihah.title).toBe("Surat Al-Fātiḥah");
    expect(fatihah.heading?.translation).toBe("Pembukaan");
    expect(fatihah.lines).toHaveLength(7);
    expect(fatihah.lines[0].label).toBe("Ayat 1");
  });

  test("session ids by kind and time", () => {
    expect(matsuratSession("kubro", "pagi")).toBe("matsurat-kubro-pagi");
    expect(dzikirSession("petang")).toBe("dzikir-petang");
  });

  test("malformed files are rejected with the place of the fault", () => {
    expect(() => parseMatsurat({ title: "x", data: [] }, "matsurat-kubro-pagi")).toThrow(
      ContentError,
    );
    expect(() =>
      parseMatsurat(
        { title: "x", data: [{ title: "a", type: "single", arabic: "ب", repeat: 0 }] },
        "matsurat-kubro-pagi",
      ),
    ).toThrow(/data\[0\]\.repeat/);
    expect(() =>
      parseMatsurat(
        { title: "x", data: [{ title: "a", type: "other", arabic: "ب", repeat: 1 }] },
        "matsurat-kubro-pagi",
      ),
    ).toThrow(/type/);
    const item = {
      id: "a",
      arabic: "ب",
      transliteration: "b",
      translation: "t",
      repetitions: 1,
      reference: "r",
      order: 1,
    };
    expect(() => parseDhikr({ title: "x", items: [item, item] }, "dzikir-pagi")).toThrow(
      /duplicate/,
    );
    expect(() =>
      parseDhikr({ title: "x", items: [{ ...item, arabic: "  " }] }, "dzikir-pagi"),
    ).toThrow(/arabic/);
    expect(() => parseDuas({ categories: [{ id: "c", name: "C", duas: [] }] })).toThrow(
      ContentError,
    );
  });

  test("a missing translation or transliteration is null, never invented", () => {
    const session = parseMatsurat(
      { title: "x", data: [{ title: "a", type: "single", arabic: "ب", repeat: 1 }] },
      "matsurat-kubro-pagi",
    );
    expect(session.items[0].lines[0]).toEqual({
      label: null,
      arabic: "ب",
      latin: null,
      translation: null,
    });
  });
});

describe("duas", () => {
  test("13 duas in 5 categories, ids unique, every one with a source", () => {
    const categories = loadDuas();
    expect(categories).toHaveLength(5);
    const duas = categories.flatMap((c) => c.duas);
    expect(duas).toHaveLength(13);
    expect(new Set(duas.map((d) => d.id)).size).toBe(13);
    for (const dua of duas) expect(dua.reference.trim()).not.toBe("");
    expect(findDua("dua-sayyidul-istighfar")?.dua.notes).toContain("people of Paradise");
    expect(findDua("nope")).toBeNull();
  });

  test("Indonesian list labels, English from the file, and a fallback for unknown ids", () => {
    const found = findDua("dua-before-eating");
    if (!found) throw new Error("missing");
    expect(duaTitle(found.dua, "id")).toBe("Sebelum makan");
    expect(duaTitle(found.dua, "en")).toBe("Before Eating");
    expect(categoryName(found.category, "id")).toBe("Doa sehari-hari");
    expect(duaTitle({ ...found.dua, id: "new" }, "id")).toBe("Before Eating");
  });

  test("search matches every word across titles, transliteration, translation and Arabic", () => {
    const all = loadDuas();
    const ids = (q: string, lang = "id") =>
      searchDuas(all, q, lang).flatMap((g) => g.duas.map((d) => d.id));
    expect(ids("")).toHaveLength(13);
    expect(ids("makan")).toEqual(["dua-before-eating", "dua-after-eating"]);
    expect(ids("masjid keluar")).toEqual(["dua-leaving-masjid"]);
    expect(ids("forgiveness", "en")).toContain("dua-istighfar");
    expect(ids("Muslim 713")).toEqual(["dua-entering-masjid", "dua-leaving-masjid"]);
    // Bare Arabic without harakat finds the vocalised text.
    expect(ids("بسم الله")).toContain("dua-before-eating");
    expect(ids("zzz")).toEqual([]);
    expect(foldForSearch("Du'ā")).toBe("dua");
  });

  test("favourites round-trip and survive bad stored values", () => {
    let favs = parseFavourites(null);
    favs = toggleFavourite(favs, "dua-travel");
    favs = toggleFavourite(favs, "dua-before-eating");
    expect(parseFavourites(serializeFavourites(favs))).toEqual(
      new Set(["dua-before-eating", "dua-travel"]),
    );
    expect(toggleFavourite(favs, "dua-travel").has("dua-travel")).toBe(false);
    expect(parseFavourites("{")).toEqual(new Set());
    expect(parseFavourites('{"a":1}')).toEqual(new Set());
    expect(parseFavourites('["ok", 3, null]')).toEqual(new Set(["ok"]));
  });
});

describe("reader counters", () => {
  const session: ReaderSession = {
    id: "dzikir-pagi",
    sourceTitle: "t",
    translationLang: "en",
    items: [
      { key: "a", title: null, heading: null, lines: [], repeat: 1, reference: null },
      { key: "b", title: null, heading: null, lines: [], repeat: 3, reference: null },
      { key: "c", title: null, heading: null, lines: [], repeat: 2, reference: null },
    ],
  };
  const [a, b, c] = session.items;

  test("a tap counts one recitation down, and stops at zero", () => {
    let counts: Counts = {};
    expect(remaining(counts, b)).toBe(3);
    counts = tapItem(counts, b);
    counts = tapItem(counts, b);
    expect(remaining(counts, b)).toBe(1);
    counts = tapItem(counts, b);
    expect(isItemDone(counts, b)).toBe(true);
    const after = tapItem(counts, b);
    expect(after).toBe(counts);
    expect(doneCount(counts, b)).toBe(3);
  });

  test("long-press puts an item back to its full count", () => {
    const counts = tapItem(tapItem({}, b), a);
    const back = resetItem(counts, b);
    expect(remaining(back, b)).toBe(3);
    expect(remaining(back, a)).toBe(0);
    expect(resetItem(back, b)).toBe(back);
  });

  test("progress counts repetitions and finished items", () => {
    let counts: Counts = {};
    expect(sessionProgress(session, counts)).toEqual({
      done: 0,
      total: 6,
      itemsDone: 0,
      itemsTotal: 3,
      fraction: 0,
      complete: false,
    });
    counts = tapItem(tapItem(tapItem(counts, a), b), c);
    const mid = sessionProgress(session, counts);
    expect(mid.done).toBe(3);
    expect(mid.itemsDone).toBe(1);
    expect(mid.fraction).toBe(0.5);
    counts = tapItem(tapItem(tapItem(counts, b), b), c);
    expect(sessionProgress(session, counts).complete).toBe(true);
  });

  test("stored counts above an item's repeat never overshoot", () => {
    expect(doneCount({ a: 99 }, a)).toBe(1);
    expect(sessionProgress(session, { a: 99 }).done).toBe(1);
  });

  test("the next unfinished item wraps round and is null when all are done", () => {
    expect(nextOpenItem(session, { a: 1 }, 0)).toBe(1);
    expect(nextOpenItem(session, { a: 1, b: 3 }, 2)).toBeNull();
    expect(nextOpenItem(session, { b: 3, c: 2 }, 2)).toBe(0);
    expect(nextOpenItem(session, { a: 1, b: 3, c: 2 }, 0)).toBeNull();
  });

  test("progress is kept for the day only", () => {
    const stored = serializeProgress({ a: 1, b: 2 }, "2027-02-12");
    expect(parseProgress(stored, "2027-02-12")).toEqual({ a: 1, b: 2 });
    expect(parseProgress(stored, "2027-02-13")).toEqual({});
    expect(parseProgress("nonsense", "2027-02-12")).toEqual({});
    expect(parseProgress('{"day":"2027-02-12","counts":{"a":-1,"b":1.5,"c":2}}', "2027-02-12")).toEqual(
      { c: 2 },
    );
    expect(progressKey("matsurat-sughro-pagi")).toBe("ibadah.progress.matsurat-sughro-pagi");
    expect(isSyncedSettingKey(progressKey("dzikir-pagi"))).toBe(false);
  });

  test("morning from Subuh until Asr, evening from Asr through the night", () => {
    expect(suggestedTime("fajr")).toBe("pagi");
    expect(suggestedTime("sunrise")).toBe("pagi");
    expect(suggestedTime("dhuhr")).toBe("pagi");
    expect(suggestedTime("asr")).toBe("petang");
    expect(suggestedTime("maghrib")).toBe("petang");
    expect(suggestedTime("isha")).toBe("petang");
    expect(mutabaahItemFor("pagi")).toBe("dzikir_pagi");
    expect(mutabaahItemFor("petang")).toBe("dzikir_petang");
  });

  test("the suggestion follows the prayer times of the saved place", () => {
    const stored = new Map([
      ["lat", "-6.2088"],
      ["lon", "106.8456"],
      ["tz", "Asia/Jakarta"],
      ["method", "kemenag"],
    ]);
    const jakarta = parsePrayerSettings((key) => stored.get(key));
    expect(suggestTimeAt(null, new Date(2027, 1, 12, 9, 0))).toBe("pagi");
    expect(suggestTimeAt(null, new Date(2027, 1, 12, 16, 0))).toBe("petang");
    // 12 Feb 2027 in Jakarta: Subuh ≈ 04:30, Asr ≈ 15:15 (WIB = UTC+7).
    expect(suggestTimeAt(jakarta, new Date(Date.UTC(2027, 1, 12, 0, 0)))).toBe("pagi"); // 07:00
    expect(suggestTimeAt(jakarta, new Date(Date.UTC(2027, 1, 12, 7, 0)))).toBe("pagi"); // 14:00
    expect(suggestTimeAt(jakarta, new Date(Date.UTC(2027, 1, 12, 10, 0)))).toBe("petang"); // 17:00
    expect(suggestTimeAt(jakarta, new Date(Date.UTC(2027, 1, 12, 20, 0)))).toBe("petang"); // 03:00
  });
});

describe("tasbih", () => {
  const phrases = loadPhrases();
  const after = presetPhases("afterPrayer", phrases, 0);

  test("the phrases are the Mutabaah app's presets, untouched", () => {
    expect(phrases.map((p) => [p.id, p.recommendedCount])).toEqual([
      ["subhanallah", 33],
      ["alhamdulillah", 33],
      ["allahu-akbar", 34],
      ["tahlil", 100],
      ["istighfar", 100],
      ["salawat", 100],
    ]);
    expect(phrases[0].arabic).toBe("سُبْحَانَ اللَّهِ");
    expect(() => parsePhrases({ phrases: [{ id: "x" }] })).toThrow(TasbihContentError);
  });

  test("33 · 33 · 34 walks through the three phrases and completes at 100", () => {
    expect(after.map((p) => p.target)).toEqual([33, 33, 34]);
    expect(positionOf(0, after)).toMatchObject({ phase: 0, inPhase: 0, rounds: 0 });
    expect(positionOf(33, after)).toMatchObject({ phase: 0, inPhase: 33 });
    expect(positionOf(34, after)).toMatchObject({ phase: 1, inPhase: 1 });
    expect(positionOf(100, after)).toMatchObject({ phase: 2, inPhase: 34, roundComplete: true });
    expect(positionOf(101, after)).toMatchObject({ phase: 0, inPhase: 1, rounds: 1 });
  });

  test("taps report the end of a part and of a round", () => {
    let state: TasbihState = { ...DEFAULT_TASBIH, count: 32 };
    let result = tap(state, after);
    expect(result.event).toBe("phase");
    state = result.state;
    expect(tap(state, after).event).toBe("tick");
    result = tap({ ...state, count: 99 }, after);
    expect(result.event).toBe("round");
    expect(result.state.count).toBe(100);
  });

  test("100 of one phrase, and the free count with and without a target", () => {
    expect(presetPhases("istighfar", phrases, 0)).toEqual([
      { phrase: phrases[4], target: 100 },
    ]);
    const open = presetPhases("custom", phrases, 0);
    expect(positionOf(250, open)).toMatchObject({ inPhase: 250, target: 0, roundComplete: false });
    expect(tap({ ...DEFAULT_TASBIH, preset: "custom", count: 5 }, open).event).toBe("tick");
    const eleven = presetPhases("custom", phrases, 11);
    expect(tap({ ...DEFAULT_TASBIH, preset: "custom", count: 10 }, eleven).event).toBe("round");
  });

  test("undo, reset, switching preset and the target bounds", () => {
    const state: TasbihState = { ...DEFAULT_TASBIH, count: 3 };
    expect(undo(state).count).toBe(2);
    expect(undo({ ...state, count: 0 }).count).toBe(0);
    expect(reset(state).count).toBe(0);
    expect(choosePreset(state, "tahlil")).toMatchObject({ preset: "tahlil", count: 0 });
    expect(choosePreset(state, "afterPrayer")).toBe(state);
    expect(setCustomTarget(state, 99_999).customTarget).toBe(MAX_CUSTOM_TARGET);
    expect(setCustomTarget(state, -4).customTarget).toBe(0);
  });

  test("the count survives a restart: stored on the phone, read back the same", async () => {
    const { db, raw: sqlite } = await migratedDb();
    const state: TasbihState = {
      preset: "salawat",
      count: 57,
      customTarget: 33,
      vibrate: false,
      linkedItem: "c.istighfar1",
    };
    await writeLocal(db, TASBIH_KEY, serializeTasbih(state));
    await writeLocal(db, TASBIH_KEY, serializeTasbih({ ...state, count: 58 }));
    expect(parseTasbih(await getSetting(db, TASBIH_KEY))).toEqual({ ...state, count: 58 });
    // Device-local: clean and not a synced key, so the sync engine never uploads it.
    const row = sqlite.query("SELECT dirty FROM settings WHERE key = ?").get(TASBIH_KEY) as {
      dirty: number;
    };
    expect(row.dirty).toBe(0);
    expect(isSyncedSettingKey(TASBIH_KEY)).toBe(false);
  });

  test("bad stored values fall back field by field", () => {
    expect(parseTasbih(null)).toEqual(DEFAULT_TASBIH);
    expect(parseTasbih("[")).toEqual(DEFAULT_TASBIH);
    expect(parseTasbih('{"preset":"nope","count":-3,"vibrate":"yes","customTarget":7}')).toEqual({
      ...DEFAULT_TASBIH,
      customTarget: 7,
    });
  });

  test("only the user's own counters can be linked, and adding clamps", () => {
    const items: ItemDef[] = [
      ...DEFAULT_ITEMS,
      { id: "c.istighfar1", kind: "count", label: "Istighfar" },
      { id: "c.tick0001", kind: "check", label: "Tick" },
    ];
    expect(linkableItems(items).map((i) => i.id)).toEqual(["c.istighfar1"]);
    expect(linkedItemOf({ ...DEFAULT_TASBIH, linkedItem: "c.istighfar1" }, items)?.id).toBe(
      "c.istighfar1",
    );
    expect(linkedItemOf({ ...DEFAULT_TASBIH, linkedItem: "tilawah" }, items)).toBeNull();
    expect(addedCount(10, 33)).toBe(43);
    expect(addedCount(9_990, 33)).toBe(10_000);
  });
});

describe("compass", () => {
  test("true north when the platform has it, magnetic otherwise", () => {
    expect(headingOf({ trueHeading: 120.5, magHeading: 119, accuracy: 3 })).toEqual({
      degrees: 120.5,
      trueNorth: true,
    });
    expect(headingOf({ trueHeading: -1, magHeading: 361, accuracy: 3 })).toEqual({
      degrees: 1,
      trueNorth: false,
    });
    expect(headingOf({ trueHeading: -1, magHeading: -1, accuracy: 0 })).toBeNull();
  });

  test("calibration hint at low or no accuracy", () => {
    expect(needsCalibration(0)).toBe(true);
    expect(needsCalibration(1)).toBe(true);
    expect(needsCalibration(2)).toBe(false);
    expect(needsCalibration(Number.NaN)).toBe(true);
  });

  test("the dial turns the short way across north", () => {
    expect(unwrapAngle(359, 1)).toBe(361);
    expect(unwrapAngle(361, 358)).toBe(358);
    expect(unwrapAngle(720, 10)).toBe(730);
  });
});
