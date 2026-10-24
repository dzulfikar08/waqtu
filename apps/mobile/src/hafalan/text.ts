import {
  quranWords,
  refOfIndex,
  splitBismillah,
  type AyahRef,
  type HafalanUnit,
} from "@waqtu/core";

import { SURAH_LOADERS } from "./surahLoaders";

/** Tanzil's text of one surah, ayah by ayah, exactly as shipped. Each surah is loaded when first asked for. */
export function surahAyahs(surah: number): readonly string[] {
  const load = SURAH_LOADERS[surah - 1];
  if (!load) throw new RangeError(`Invalid surah ${surah}`);
  return load().ayahs;
}

export interface UnitAyah extends AyahRef {
  /** Global ayah index. */
  index: number;
  words: string[];
}

/** The part of a unit that lies in one surah. */
export interface UnitBlock {
  surah: number;
  /** The unit begins at ayah 1, so the surah's name heading belongs above it. */
  startsSurah: boolean;
  /** The Bismillah heading when the block begins at ayah 1 of a surah that has one before its text. */
  bismillah: string | null;
  ayahs: UnitAyah[];
}

/** What a unit shows: its ayahs grouped by surah, split into words, with the Bismillah lifted out of ayah 1. */
export function unitBlocks(unit: Pick<HafalanUnit, "start" | "end">): UnitBlock[] {
  const blocks: UnitBlock[] = [];
  for (let index = unit.start; index <= unit.end; index++) {
    const { surah, ayah } = refOfIndex(index);
    let block = blocks.at(-1);
    if (!block || block.surah !== surah) {
      block = { surah, startsSurah: ayah === 1, bismillah: null, ayahs: [] };
      blocks.push(block);
    }
    const split = splitBismillah(surah, ayah, surahAyahs(surah)[ayah - 1]);
    if (split.bismillah !== null) block.bismillah = split.bismillah;
    block.ayahs.push({ surah, ayah, index, words: quranWords(split.text) });
  }
  return blocks;
}

/** Words in a unit's blocks, the count the hide-and-reveal test steps through. */
export function wordCount(blocks: readonly UnitBlock[]): number {
  return blocks.reduce((n, b) => n + b.ayahs.reduce((m, a) => m + a.words.length, 0), 0);
}

/** Key of one word in the reveal set of the hide-and-reveal test. */
export const wordKey = (ayahIndex: number, word: number) => `${ayahIndex}:${word}`;

/** Every word's key in reading order. */
export function wordKeys(blocks: readonly UnitBlock[]): string[] {
  return blocks.flatMap((b) => b.ayahs.flatMap((a) => a.words.map((_, i) => wordKey(a.index, i))));
}
