import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import {
  ayahIndex,
  BISMILLAH,
  firstLetters,
  juzOfIndex,
  juzRange,
  pageOfIndex,
  pageRange,
  quranWords,
  refOfIndex,
  splitBismillah,
  SURAHS,
  surahInfo,
  surahRange,
  TOTAL_AYAHS,
} from "../src/index";
import { AYAH_WORDS, JUZ_START, PAGE_START } from "../src/quran-data";

const QURAN_DIR = new URL("../../../content/quran/", import.meta.url);
const verbatim = readFileSync(new URL("quran-uthmani-1.1.txt", QURAN_DIR), "utf8");
const lines = verbatim.split("\n").filter((l) => /^\d/.test(l));
const text: string[][] = SURAHS.map(() => []);
for (const line of lines) {
  const [s, , t] = line.split("|");
  text[Number(s) - 1].push(t);
}

describe("Tanzil text integrity", () => {
  test("the verbatim file is byte-identical to the download (SHA-256 pinned)", () => {
    expect(
      createHash("sha256")
        .update(readFileSync(new URL("quran-uthmani-1.1.txt", QURAN_DIR)))
        .digest("hex"),
    ).toBe("bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8");
  });

  test("keeps Tanzil's copyright and terms of use", () => {
    expect(verbatim).toContain("Tanzil Quran Text (Uthmani, Version 1.1)");
    expect(verbatim).toContain("Creative Commons Attribution 3.0");
    expect(verbatim).toContain("CHANGING IT IS NOT ALLOWED");
    expect(verbatim).toContain("tanzil.net");
  });

  test("6236 ayahs, numbered 1..n in each of the 114 surahs", () => {
    expect(lines).toHaveLength(6236);
    expect(TOTAL_AYAHS).toBe(6236);
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.ayahs, 0)).toBe(6236);
    for (const [i, s] of SURAHS.entries()) expect(text[i]).toHaveLength(s.ayahs);
    const keys = lines.map((l) => l.split("|").slice(0, 2).join(":"));
    const expected = SURAHS.flatMap((s, i) =>
      Array.from({ length: s.ayahs }, (_, a) => `${i + 1}:${a + 1}`),
    );
    expect(keys).toEqual(expected);
  });

  test("famous ayah counts", () => {
    expect([1, 2, 18, 36, 67, 112, 113, 114].map((n) => surahInfo(n).ayahs)).toEqual([
      7, 286, 110, 83, 30, 4, 5, 6,
    ]);
  });

  test("every ayah has text and none is edited by trailing spaces or control characters", () => {
    for (const list of text) {
      for (const t of list) {
        expect(t.length).toBeGreaterThan(0);
        expect(t).toBe(t.trim());
        expect([...t].every((ch) => ch.charCodeAt(0) > 31)).toBe(true);
      }
    }
  });

  test("Bismillah is prefixed to ayah 1 of every surah except 1 and 9", () => {
    expect(text[0][0]).toBe(BISMILLAH);
    for (const [i, list] of text.entries()) {
      const { bismillah, text: rest } = splitBismillah(i + 1, 1, list[0]);
      if (i + 1 === 1 || i + 1 === 9) {
        expect(bismillah).toBeNull();
        expect(rest).toBe(list[0]);
      } else {
        expect(bismillah).not.toBeNull();
        expect(`${bismillah} ${rest}`).toBe(list[0]);
        expect(rest.length).toBeGreaterThan(0);
      }
      for (const t of list.slice(1)) expect(t.startsWith(BISMILLAH)).toBe(false);
    }
  });

  test("most surahs carry the canonical Bismillah; 95 and 97 spell its marks differently", () => {
    const different = text
      .map((list, i) => ({ n: i + 1, b: splitBismillah(i + 1, 1, list[0]).bismillah }))
      .filter((x) => x.b !== null && x.b !== BISMILLAH)
      .map((x) => x.n);
    expect(different).toEqual([95, 97]);
  });

  test("splitBismillah leaves other ayahs alone", () => {
    expect(splitBismillah(2, 2, text[1][1])).toEqual({ bismillah: null, text: text[1][1] });
    expect(splitBismillah(2, 1, "الم")).toEqual({ bismillah: null, text: "الم" });
  });

  test("word counts in the metadata match the text", () => {
    const counts = text.flatMap((list, i) =>
      list.map((t, a) => quranWords(splitBismillah(i + 1, a + 1, t).text).length),
    );
    expect(AYAH_WORDS).toEqual(counts);
    expect(AYAH_WORDS.every((n) => n > 0)).toBe(true);
  });
});

describe("mushaf metadata", () => {
  test("604 pages and 30 juz start on increasing ayahs, the first at 1:1", () => {
    expect(PAGE_START).toHaveLength(604);
    expect(JUZ_START).toHaveLength(30);
    expect(PAGE_START[0]).toBe(0);
    expect(JUZ_START[0]).toBe(0);
    for (let i = 1; i < PAGE_START.length; i++)
      expect(PAGE_START[i]).toBeGreaterThan(PAGE_START[i - 1]);
    for (let i = 1; i < JUZ_START.length; i++)
      expect(JUZ_START[i]).toBeGreaterThan(JUZ_START[i - 1]);
    expect(PAGE_START.at(-1)).toBeLessThan(TOTAL_AYAHS);
  });

  test("pages partition the ayahs and so do juz", () => {
    let next = 0;
    for (let p = 1; p <= 604; p++) {
      const r = pageRange(p);
      expect(r.start).toBe(next);
      next = r.end + 1;
    }
    expect(next).toBe(TOTAL_AYAHS);
    next = 0;
    for (let j = 1; j <= 30; j++) {
      const r = juzRange(j);
      expect(r.start).toBe(next);
      next = r.end + 1;
    }
    expect(next).toBe(TOTAL_AYAHS);
  });

  test("well-known landmarks of the Madinah mushaf", () => {
    const page = (s: number, a: number) => pageOfIndex(ayahIndex(s, a));
    expect([page(1, 1), page(2, 1), page(2, 255), page(18, 1), page(36, 1), page(67, 1)]).toEqual([
      1, 2, 42, 293, 440, 562,
    ]);
    expect([page(78, 1), page(112, 1), page(114, 6)]).toEqual([582, 604, 604]);
    expect(refOfIndex(JUZ_START[1])).toEqual({ surah: 2, ayah: 142 });
    expect(refOfIndex(JUZ_START[29])).toEqual({ surah: 78, ayah: 1 });
    expect(juzOfIndex(ayahIndex(2, 255))).toBe(3);
    expect(juzOfIndex(TOTAL_AYAHS - 1)).toBe(30);
  });

  test("index conversions round-trip and reject out-of-range input", () => {
    for (const i of [0, 6, 7, 292, 6235]) {
      const { surah, ayah } = refOfIndex(i);
      expect(ayahIndex(surah, ayah)).toBe(i);
    }
    expect(surahRange(114)).toEqual({ start: 6230, end: 6235 });
    expect(() => ayahIndex(1, 8)).toThrow(RangeError);
    expect(() => ayahIndex(115, 1)).toThrow(RangeError);
    expect(() => refOfIndex(6236)).toThrow(RangeError);
    expect(() => pageRange(605)).toThrow(RangeError);
    expect(() => juzRange(0)).toThrow(RangeError);
  });

  test("every surah has Arabic, Indonesian and English names", () => {
    for (const s of SURAHS) {
      expect(s.arabic.length).toBeGreaterThan(0);
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.en.length).toBeGreaterThan(0);
    }
    expect(surahInfo(1).id).toBe("Al-Fatihah");
    expect(surahInfo(114).id).toBe("An-Nas");
    expect(new Set(SURAHS.map((s) => s.id)).size).toBe(114);
  });
});

describe("text helpers", () => {
  test("words are the space-separated tokens", () => {
    const ayah = text[1][1];
    const words = quranWords(ayah);
    expect(words).toHaveLength(7);
    expect(words.join(" ")).toBe(ayah);
    expect(quranWords("")).toEqual([]);
  });

  test("no word is only a sign anywhere in the text", () => {
    for (const [i, list] of text.entries()) {
      for (const [a, t] of list.entries()) {
        for (const w of quranWords(splitBismillah(i + 1, a + 1, t).text)) {
          expect(/[\u0620-\u064A\u066E-\u06D3]/.test(w)).toBe(true);
        }
      }
    }
  });

  test("first letters: a plain word, the article, and a one-letter word", () => {
    // Written as code points: Arabic typed by hand can reorder shadda and vowel marks.
    expect(firstLetters("\u0631\u064E\u0628\u0650\u0651")).toBe("\u0631\u064E");
    expect(firstLetters("\u0671\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F")).toBe(
      "\u0671\u0644\u0652\u062D\u064E",
    );
    expect(firstLetters("\u0648\u064E")).toBe("\u0648\u064E");
  });
});
