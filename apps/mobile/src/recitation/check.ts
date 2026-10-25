/**
 * From a transcript to what the hafalan screen shows: the unit's ayat aligned with
 * `alignRecitation` (packages/core/src/recitation.ts), the words to highlight in `UnitText`, and
 * the record kept for the evaluation harness (packages/core/scripts/recitation-eval.ts).
 */

import {
  alignRecitation,
  ayahIndex,
  refOfIndex,
  surahInfo,
  type AyahRef,
  type ExpectedAyah,
  type HafalanUnit,
  type RecitationAlignment,
  type RecitationCounts,
} from "@waqtu/core";

import { surahAyahs, wordKey } from "../hafalan/text";
import type { ModelId } from "./models";

type UnitRange = Pick<HafalanUnit, "start" | "end">;

/** The unit's ayat with Tanzil's stored text, in reading order. */
export function expectedAyat(unit: UnitRange): ExpectedAyah[] {
  const out: ExpectedAyah[] = [];
  for (let index = unit.start; index <= unit.end; index++) {
    const { surah, ayah } = refOfIndex(index);
    out.push({ surah, ayah, text: surahAyahs(surah)[ayah - 1] });
  }
  return out;
}

/** Where wrong-ayah jumps are looked for: every ayah of the surahs the unit touches (the harness default). */
export function contextAyat(unit: UnitRange): ExpectedAyah[] {
  const first = refOfIndex(unit.start).surah;
  const last = refOfIndex(unit.end).surah;
  const out: ExpectedAyah[] = [];
  for (let surah = first; surah <= last; surah++) {
    const ayahs = surahAyahs(surah);
    for (let ayah = 1; ayah <= surahInfo(surah).ayahs; ayah++)
      out.push({ surah, ayah, text: ayahs[ayah - 1] });
  }
  return out;
}

/**
 * The transcript of a whisper.rn result. Its `result` is the segments glued together with no
 * separator, so a word that ends one 30 s window runs into the first word of the next
 * (طِبَاقًامَا); the segments are joined with a space instead.
 */
export function transcriptOf(result: {
  result: string;
  segments: readonly { text: string }[];
}): string {
  const parts = result.segments.map((s) => s.text.trim()).filter((s) => s !== "");
  return parts.length > 0 ? parts.join(" ") : result.result.trim();
}

export function checkRecitation(unit: UnitRange, transcript: string): RecitationAlignment {
  return alignRecitation(expectedAyat(unit), transcript, { context: contextAyat(unit) });
}

export type WordFlag = "skipped" | "substituted";

export interface CheckJump {
  /** The ayah of the unit the reciter should have been reciting. */
  at: AyahRef;
  /** Where the heard words come from. */
  from: AyahRef;
}

/** What `UnitText` and the check panel draw from an alignment. */
export interface CheckView {
  /** Flagged words by `wordKey(ayahIndex, word)`, the keys of `unitBlocks`. */
  words: ReadonlyMap<string, WordFlag>;
  /** Global indexes of the ayat where the reciter jumped elsewhere. */
  jumpAyahs: ReadonlySet<number>;
  jumps: CheckJump[];
  counts: RecitationCounts;
}

/**
 * Maps an alignment onto the unit's words. The optional Bismillah heading is never flagged (its
 * words are `omitted` when not recited); `repeat`s, going back over what was already recited, are
 * not mistakes and are left out.
 */
export function checkView(alignment: RecitationAlignment): CheckView {
  const words = new Map<string, WordFlag>();
  for (const w of alignment.words) {
    if (w.bismillah) continue;
    if (w.status === "skipped" || w.status === "substituted")
      words.set(wordKey(ayahIndex(w.surah, w.ayah), w.word), w.status);
  }
  const jumps: CheckJump[] = [];
  const jumpAyahs = new Set<number>();
  for (const j of alignment.jumps) {
    if (j.kind !== "jump") continue;
    jumps.push({
      at: { surah: j.at.surah, ayah: j.at.ayah },
      from: { surah: j.start.surah, ayah: j.start.ayah },
    });
    jumpAyahs.add(ayahIndex(j.at.surah, j.at.ayah));
  }
  return { words, jumpAyahs, jumps, counts: alignment.counts };
}

/** The unit as a harness range: "67:1-67:5", or "67:3" for one ayah. */
export function rangeOf(unit: UnitRange): string {
  const a = refOfIndex(unit.start);
  const b = refOfIndex(unit.end);
  const from = `${a.surah}:${a.ayah}`;
  return unit.start === unit.end ? from : `${from}-${b.surah}:${b.ayah}`;
}

/** One check, kept on the phone until exported or cleared. */
export interface CheckRecord {
  id: string;
  /** Unit index in the plan, for the screen. */
  unit: number;
  range: string;
  /** The transcript that was aligned (`transcriptOf` the whisper.rn result). */
  text: string;
  model: ModelId;
  seconds: number;
  /** ISO time of the recording. */
  recordedAt: string;
  /** Wall-clock seconds the transcription took on this phone. */
  transcribeSeconds: number;
}

export function checkId(unit: number, at: Date): string {
  return `unit-${unit}-${at
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")}`;
}

/** A labelled mistake in the harness format (`S:A:W` with W 1-based, or `S:A`). */
export interface ManifestMistake {
  type: "skip" | "substitution" | "jump";
  at: string;
}

export interface ManifestEntry {
  id: string;
  range: string;
  text: string;
  mistakes: ManifestMistake[];
  model: ModelId;
  seconds: number;
  recordedAt: string;
  transcribeSeconds: number;
}

/**
 * The records as a harness manifest (format at the top of recitation-eval.ts): the transcript
 * inline as `text`, the expected `range`, and an empty `mistakes` list to be filled in by someone
 * who listens to the recording. The other keys are ignored by the harness and kept for reference.
 */
export function manifestOf(records: readonly CheckRecord[]): { recitations: ManifestEntry[] } {
  return {
    recitations: records.map((r) => ({
      id: r.id,
      range: r.range,
      text: r.text,
      mistakes: [],
      model: r.model,
      seconds: r.seconds,
      recordedAt: r.recordedAt,
      transcribeSeconds: r.transcribeSeconds,
    })),
  };
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";

/** Stored records (a JSON list); anything malformed is dropped rather than failing the screen. */
export function parseRecords(data: unknown): CheckRecord[] {
  if (!Array.isArray(data)) return [];
  const out: CheckRecord[] = [];
  const ids = new Set<string>();
  for (const r of data) {
    if (typeof r !== "object" || r === null) continue;
    const { id, unit, range, text, model, seconds, recordedAt, transcribeSeconds } = r as Record<
      string,
      unknown
    >;
    if (!str(id) || ids.has(id) || !num(unit) || !str(range) || !str(text) || !str(recordedAt))
      continue;
    if ((model !== "base" && model !== "tiny") || !num(seconds) || !num(transcribeSeconds))
      continue;
    ids.add(id);
    out.push({ id, unit, range, text, model, seconds, recordedAt, transcribeSeconds });
  }
  return out;
}
