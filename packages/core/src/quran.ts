import { AYAH_WORDS, JUZ_START, PAGE_START, SURAHS, type SurahInfo } from "./quran-data";

export { SURAHS, type SurahInfo } from "./quran-data";
export * from "./quran-text";

/** Total ayahs in the Quran (Hafs, Madinah mushaf numbering). */
export const TOTAL_AYAHS = 6236;
export const TOTAL_PAGES = PAGE_START.length;
export const TOTAL_JUZ = JUZ_START.length;
export const TOTAL_SURAHS = SURAHS.length;

export interface AyahRef {
  surah: number;
  ayah: number;
}

/** Global 0-based index of the first ayah of each surah. */
const SURAH_OFFSET: readonly number[] = (() => {
  const offsets: number[] = [];
  let total = 0;
  for (const s of SURAHS) {
    offsets.push(total);
    total += s.ayahs;
  }
  return offsets;
})();

/** Inclusive range of global ayah indexes. */
export interface IndexRange {
  start: number;
  end: number;
}

function checkInt(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in ${min}..${max}, got ${value}`);
  }
}

export function surahInfo(surah: number): SurahInfo {
  checkInt("surah", surah, 1, TOTAL_SURAHS);
  return SURAHS[surah - 1];
}

/** Global 0-based index of `surah:ayah`. */
export function ayahIndex(surah: number, ayah: number): number {
  const info = surahInfo(surah);
  checkInt("ayah", ayah, 1, info.ayahs);
  return SURAH_OFFSET[surah - 1] + ayah - 1;
}

export function refOfIndex(index: number): AyahRef {
  checkInt("ayah index", index, 0, TOTAL_AYAHS - 1);
  let lo = 0;
  let hi = SURAH_OFFSET.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SURAH_OFFSET[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return { surah: lo + 1, ayah: index - SURAH_OFFSET[lo] + 1 };
}

export function surahRange(surah: number): IndexRange {
  const info = surahInfo(surah);
  const start = SURAH_OFFSET[surah - 1];
  return { start, end: start + info.ayahs - 1 };
}

/** Ayahs that begin on `page` (1..604) of the Madinah mushaf; an ayah that runs on belongs to the page it starts on. */
export function pageRange(page: number): IndexRange {
  checkInt("page", page, 1, TOTAL_PAGES);
  return {
    start: PAGE_START[page - 1],
    end: page === TOTAL_PAGES ? TOTAL_AYAHS - 1 : PAGE_START[page] - 1,
  };
}

export function juzRange(juz: number): IndexRange {
  checkInt("juz", juz, 1, TOTAL_JUZ);
  return {
    start: JUZ_START[juz - 1],
    end: juz === TOTAL_JUZ ? TOTAL_AYAHS - 1 : JUZ_START[juz] - 1,
  };
}

/** Page (1..604) that an ayah begins on. */
export function pageOfIndex(index: number): number {
  checkInt("ayah index", index, 0, TOTAL_AYAHS - 1);
  let lo = 0;
  let hi = PAGE_START.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (PAGE_START[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export function juzOfIndex(index: number): number {
  checkInt("ayah index", index, 0, TOTAL_AYAHS - 1);
  let lo = 0;
  let hi = JUZ_START.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (JUZ_START[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** Words in the ayah at a global index (Bismillah prefix excluded). */
export function ayahWords(index: number): number {
  checkInt("ayah index", index, 0, TOTAL_AYAHS - 1);
  return AYAH_WORDS[index];
}
