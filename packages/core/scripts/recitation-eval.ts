/**
 * Acceptance harness for recitation mistake detection (DEV-15): runs `alignRecitation` over a set
 * of labelled recitations and reports skipped-word recall and the false-flag rate.
 *
 *   bun run --filter @waqtu/core eval:recitation <manifest.json> [--json] [--check]
 *
 * The manifest (paths relative to it):
 *
 *   {
 *     "recitations": [
 *       {
 *         "id": "mulk-1-5-reciter-a",
 *         "audio": "audio/mulk-1-5-a.m4a",            // optional, for reference only
 *         "transcript": "transcripts/mulk-1-5-a.json", // ASR output, or inline "text": "..."
 *         "range": "67:1-67:5",                       // or "67:1-5", or "67:3"
 *         "context": "67:1-67:30",                    // optional; default: the surahs of the range
 *         "mistakes": [
 *           { "type": "skip", "at": "67:2:6" },        // surah:ayah:word, word 1-based
 *           { "type": "skip", "at": "67:4" },          // a whole ayah skipped
 *           { "type": "substitution", "at": "67:3:2" },
 *           { "type": "jump", "at": "67:5" }           // the expected ayah where the reciter jumped
 *         ]
 *       }
 *     ]
 *   }
 *
 * Words are numbered from 1 within the ayah, without the Bismillah Tanzil stores before ayah 1.
 * A transcript file is plain text (.txt) or JSON: whisper.rn's `TranscribeResult` (`result`), an
 * object with `text`, or `segments[].text`.
 *
 * - skipped-word recall: labelled skipped words the alignment reports as skipped / labelled skips;
 * - false-flag rate: words with no labelled mistake reported as skipped / words with no labelled
 *   mistake. The "any mistake" variant also counts words reported as substituted.
 *
 * `--check` exits with status 1 unless there are at least 50 recitations, recall >= 90% and the
 * false-flag rate <= 5% (the DEV-15 acceptance criteria).
 */

import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

import { alignRecitation, surahInfo, type ExpectedAyah } from "../src/index";

export const ACCEPTANCE = { recitations: 50, skipRecall: 0.9, falseFlagRate: 0.05 } as const;

const SURAH_DIR = new URL("../../../content/quran/surah/", import.meta.url);
const surahCache = new Map<number, readonly string[]>();

/** Tanzil's stored text of a surah, ayah by ayah (content/quran/surah/NNN.json). */
export function surahAyahs(surah: number): readonly string[] {
  const cached = surahCache.get(surah);
  if (cached) return cached;
  const info = surahInfo(surah);
  const file = new URL(`${String(surah).padStart(3, "0")}.json`, SURAH_DIR);
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (
    typeof data !== "object" ||
    data === null ||
    !("ayahs" in data) ||
    !Array.isArray(data.ayahs) ||
    data.ayahs.length !== info.ayahs ||
    !data.ayahs.every((a): a is string => typeof a === "string")
  ) {
    throw new Error(`${file.pathname}: expected ${info.ayahs} ayah strings`);
  }
  const ayahs: readonly string[] = data.ayahs;
  surahCache.set(surah, ayahs);
  return ayahs;
}

export interface Ref {
  surah: number;
  ayah: number;
  /** 1-based word, when given. */
  word?: number;
}

const REF = /^(\d+):(\d+)(?::(\d+))?$/;

export function parseRef(text: string): Ref {
  const m = REF.exec(text.trim());
  if (!m) throw new Error(`Invalid reference "${text}" (want surah:ayah or surah:ayah:word)`);
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (ayah < 1 || ayah > surahInfo(surah).ayahs) throw new Error(`No ayah ${surah}:${ayah}`);
  return m[3] === undefined ? { surah, ayah } : { surah, ayah, word: Number(m[3]) };
}

/** Ayat of "S:A", "S:A-B" or "S:A-S:B" (may cross surahs), with their stored text. */
export function parseRange(text: string): ExpectedAyah[] {
  const [a, b] = text.split("-");
  const from = parseRef(a);
  const to =
    b === undefined ? from : b.includes(":") ? parseRef(b) : parseRef(`${from.surah}:${b}`);
  if (from.word !== undefined || to.word !== undefined)
    throw new Error(`Range "${text}" names a word`);
  if (to.surah < from.surah || (to.surah === from.surah && to.ayah < from.ayah)) {
    throw new Error(`Range "${text}" ends before it starts`);
  }
  const out: ExpectedAyah[] = [];
  for (let s = from.surah; s <= to.surah; s++) {
    const ayahs = surahAyahs(s);
    const first = s === from.surah ? from.ayah : 1;
    const last = s === to.surah ? to.ayah : ayahs.length;
    for (let ayah = first; ayah <= last; ayah++)
      out.push({ surah: s, ayah, text: ayahs[ayah - 1] });
  }
  return out;
}

/** The transcript text in an ASR result: whisper.rn's `result`, `text`, or joined `segments[].text`. */
export function transcriptText(data: unknown): string {
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    if ("result" in data && typeof data.result === "string") return data.result;
    if ("text" in data && typeof data.text === "string") return data.text;
    if ("segments" in data && Array.isArray(data.segments)) {
      const parts: string[] = [];
      for (const s of data.segments) {
        if (typeof s === "object" && s !== null && "text" in s && typeof s.text === "string")
          parts.push(s.text);
        else throw new Error("segments[] entries need a text string");
      }
      return parts.join(" ");
    }
  }
  throw new Error("Transcript JSON needs `result`, `text` or `segments[].text`");
}

export type MistakeType = "skip" | "substitution" | "jump";

export interface Recitation {
  id: string;
  /** Transcript text (already read from the transcript file when the manifest named one). */
  text: string;
  range: string;
  context?: string;
  mistakes: { type: MistakeType; at: string }[];
}

const MISTAKE_TYPES: readonly MistakeType[] = ["skip", "substitution", "jump"];

function isMistakeType(value: string): value is MistakeType {
  return MISTAKE_TYPES.some((t) => t === value);
}

function optionalString(entry: object, key: string, where: string): string | undefined {
  const value: unknown = Reflect.get(entry, key);
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${where}: "${key}" must be a string`);
  }
  return value;
}

function requiredString(entry: object, key: string, where: string): string {
  const value = optionalString(entry, key, where);
  if (value === undefined) throw new Error(`${where}: "${key}" is missing`);
  return value;
}

/** Reads and checks a manifest; transcripts are loaded relative to the manifest's folder. */
export function loadManifest(path: string): Recitation[] {
  const base = dirname(resolve(path));
  const data: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof data !== "object" ||
    data === null ||
    !("recitations" in data) ||
    !Array.isArray(data.recitations)
  ) {
    throw new Error(`${path}: expected { "recitations": [...] }`);
  }
  const ids = new Set<string>();
  return data.recitations.map((entry: unknown, i: number): Recitation => {
    const where = `${path} recitations[${i}]`;
    if (typeof entry !== "object" || entry === null) throw new Error(`${where}: not an object`);
    const id = requiredString(entry, "id", where);
    if (ids.has(id)) throw new Error(`${where}: duplicate id "${id}"`);
    ids.add(id);
    const transcript = optionalString(entry, "transcript", where);
    const inline = optionalString(entry, "text", where);
    if ((transcript === undefined) === (inline === undefined)) {
      throw new Error(`${where}: give exactly one of "transcript" (a file) or "text"`);
    }
    let text = inline ?? "";
    if (transcript !== undefined) {
      const file = resolve(base, transcript);
      const raw = readFileSync(file, "utf8");
      text = extname(file).toLowerCase() === ".json" ? transcriptText(JSON.parse(raw)) : raw;
    }
    const mistakesRaw: unknown = Reflect.get(entry, "mistakes") ?? [];
    if (!Array.isArray(mistakesRaw)) throw new Error(`${where}: "mistakes" must be an array`);
    const mistakes = mistakesRaw.map((m: unknown, k: number) => {
      const at = `${where}.mistakes[${k}]`;
      if (typeof m !== "object" || m === null) throw new Error(`${at}: not an object`);
      const type = requiredString(m, "type", at);
      if (!isMistakeType(type)) throw new Error(`${at}: unknown type "${type}"`);
      const ref = requiredString(m, "at", at);
      parseRef(ref);
      return { type, at: ref };
    });
    return {
      id,
      text,
      range: requiredString(entry, "range", where),
      context: optionalString(entry, "context", where),
      mistakes,
    };
  });
}

export interface Tally {
  recitations: number;
  /** Expected words (Bismillah prefix excluded). */
  words: number;
  labelledSkips: number;
  detectedSkips: number;
  /** Labelled skips reported as substituted: found as a mistake, but not as a skip. */
  skipsAsSubstitution: number;
  labelledSubstitutions: number;
  detectedSubstitutions: number;
  /** Words without a labelled mistake. */
  cleanWords: number;
  falseSkipFlags: number;
  falseSubstitutionFlags: number;
  labelledJumps: number;
  detectedJumps: number;
  /** Jumps reported where none was labelled. */
  extraJumps: number;
}

export interface RecitationResult extends Tally {
  id: string;
  /** Labelled mistakes that name a word outside the range. */
  problems: string[];
}

export interface Report {
  results: RecitationResult[];
  total: Tally;
  skipRecall: number;
  falseFlagRate: number;
  anyFalseFlagRate: number;
  substitutionRecall: number;
  pass: boolean;
  /** Why `pass` is false. */
  failures: string[];
}

const emptyTally = (): Tally => ({
  recitations: 0,
  words: 0,
  labelledSkips: 0,
  detectedSkips: 0,
  skipsAsSubstitution: 0,
  labelledSubstitutions: 0,
  detectedSubstitutions: 0,
  cleanWords: 0,
  falseSkipFlags: 0,
  falseSubstitutionFlags: 0,
  labelledJumps: 0,
  detectedJumps: 0,
  extraJumps: 0,
});

/** Context for jump search: the given range, or every surah the expected range touches. */
function contextOf(r: Recitation, expected: readonly ExpectedAyah[]): ExpectedAyah[] {
  if (r.context !== undefined) return parseRange(r.context);
  const surahs = [...new Set(expected.map((a) => a.surah))];
  return surahs.flatMap((s) => parseRange(`${s}:1-${surahInfo(s).ayahs}`));
}

export function evaluateRecitation(r: Recitation): RecitationResult {
  const expected = parseRange(r.range);
  const alignment = alignRecitation(expected, r.text, { context: contextOf(r, expected) });
  const result: RecitationResult = { id: r.id, problems: [], ...emptyTally(), recitations: 1 };

  const words = alignment.words.filter((w) => !w.bismillah);
  const key = (surah: number, ayah: number, word: number) => `${surah}:${ayah}:${word}`;
  const inRange = new Set(words.map((w) => key(w.surah, w.ayah, w.word + 1)));
  const labels = new Map<string, "skip" | "substitution">();
  const jumpAyahs: string[] = [];
  for (const m of r.mistakes) {
    const ref = parseRef(m.at);
    if (m.type === "jump") {
      jumpAyahs.push(`${ref.surah}:${ref.ayah}`);
      continue;
    }
    const targets =
      ref.word !== undefined
        ? [key(ref.surah, ref.ayah, ref.word)]
        : words
            .filter((w) => w.surah === ref.surah && w.ayah === ref.ayah)
            .map((w) => key(w.surah, w.ayah, w.word + 1));
    if (targets.length === 0 || targets.some((t) => !inRange.has(t))) {
      result.problems.push(`${m.type} at ${m.at} is not a word of ${r.range}`);
      continue;
    }
    for (const t of targets) labels.set(t, m.type);
  }

  for (const w of words) {
    result.words++;
    const label = labels.get(key(w.surah, w.ayah, w.word + 1));
    if (label === "skip") {
      result.labelledSkips++;
      if (w.status === "skipped") result.detectedSkips++;
      else if (w.status === "substituted") result.skipsAsSubstitution++;
    } else if (label === "substitution") {
      result.labelledSubstitutions++;
      if (w.status === "substituted") result.detectedSubstitutions++;
    } else {
      result.cleanWords++;
      if (w.status === "skipped") result.falseSkipFlags++;
      else if (w.status === "substituted") result.falseSubstitutionFlags++;
    }
  }

  const reported = alignment.jumps
    .filter((j) => j.kind === "jump")
    .map((j) => `${j.at.surah}:${j.at.ayah}`);
  result.labelledJumps = jumpAyahs.length;
  const unmatched = [...reported];
  for (const a of jumpAyahs) {
    const k = unmatched.indexOf(a);
    if (k < 0) continue;
    result.detectedJumps++;
    unmatched.splice(k, 1);
  }
  result.extraJumps = unmatched.length;
  return result;
}

const ratio = (n: number, d: number) => (d === 0 ? Number.NaN : n / d);

export function evaluate(recitations: readonly Recitation[]): Report {
  const results = recitations.map(evaluateRecitation);
  const total = emptyTally();
  for (const r of results) {
    for (const k of Object.keys(total) as (keyof Tally)[]) total[k] += r[k];
  }
  const skipRecall = ratio(total.detectedSkips, total.labelledSkips);
  const falseFlagRate = ratio(total.falseSkipFlags, total.cleanWords);
  const failures: string[] = [];
  if (total.recitations < ACCEPTANCE.recitations) {
    failures.push(`${total.recitations} recitations, need ${ACCEPTANCE.recitations}`);
  }
  if (!(skipRecall >= ACCEPTANCE.skipRecall)) {
    failures.push(`skipped-word recall ${pct(skipRecall)} < ${pct(ACCEPTANCE.skipRecall)}`);
  }
  if (!(falseFlagRate <= ACCEPTANCE.falseFlagRate)) {
    failures.push(`false-flag rate ${pct(falseFlagRate)} > ${pct(ACCEPTANCE.falseFlagRate)}`);
  }
  const problems = results.flatMap((r) => r.problems.map((p) => `${r.id}: ${p}`));
  failures.push(...problems);
  return {
    results,
    total,
    skipRecall,
    falseFlagRate,
    anyFalseFlagRate: ratio(total.falseSkipFlags + total.falseSubstitutionFlags, total.cleanWords),
    substitutionRecall: ratio(total.detectedSubstitutions, total.labelledSubstitutions),
    pass: failures.length === 0,
    failures,
  };
}

function pct(x: number): string {
  return Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`;
}

export function formatReport(report: Report): string {
  const t = report.total;
  const lines = [
    "id\twords\tskips found/labelled\tsubs found/labelled\tfalse skip flags\tfalse sub flags\tjumps found/labelled (+extra)",
    ...report.results.map(
      (r) =>
        `${r.id}\t${r.words}\t${r.detectedSkips}/${r.labelledSkips}\t${r.detectedSubstitutions}/${r.labelledSubstitutions}\t${r.falseSkipFlags}\t${r.falseSubstitutionFlags}\t${r.detectedJumps}/${r.labelledJumps} (+${r.extraJumps})`,
    ),
    "",
    `recitations: ${t.recitations}, expected words: ${t.words}, words without a labelled mistake: ${t.cleanWords}`,
    `skipped-word recall: ${pct(report.skipRecall)} (${t.detectedSkips}/${t.labelledSkips}; ${t.skipsAsSubstitution} more reported as substituted)`,
    `false-flag rate (skips): ${pct(report.falseFlagRate)} (${t.falseSkipFlags}/${t.cleanWords})`,
    `false-flag rate (skips + substitutions): ${pct(report.anyFalseFlagRate)}`,
    `substitution recall: ${pct(report.substitutionRecall)} (${t.detectedSubstitutions}/${t.labelledSubstitutions})`,
    `wrong-ayah jumps found: ${t.detectedJumps}/${t.labelledJumps}, reported without a label: ${t.extraJumps}`,
    `acceptance (>= ${ACCEPTANCE.recitations} recitations, recall >= ${pct(ACCEPTANCE.skipRecall)}, false flags <= ${pct(ACCEPTANCE.falseFlagRate)}): ${report.pass ? "PASS" : "FAIL"}`,
    ...report.failures.map((f) => `  - ${f}`),
  ];
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const manifest = args.find((a) => !a.startsWith("--"));
  if (manifest === undefined) {
    console.error("usage: bun scripts/recitation-eval.ts <manifest.json> [--json] [--check]");
    process.exit(2);
  }
  const report = evaluate(loadManifest(manifest));
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  if (args.includes("--check") && !report.pass) process.exit(1);
}
