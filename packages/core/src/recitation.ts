/**
 * Word-level checking of a recitation against the Quran text: a speech-recognition transcript of
 * what the reciter said is aligned to the ayat they meant to recite, and every word of those ayat
 * is reported as recited, skipped or replaced, plus the heard words that belong nowhere and runs
 * of heard words that come from another place in the Quran (a jump to the wrong ayah).
 *
 * Only words are compared, after both sides are reduced to bare letters (`normalizeArabic`), so
 * tajweed, harakat and pronunciation are out of scope. The expected text is Tanzil's Uthmani text
 * as stored (content/quran); it is only read, never changed. The transcript is expected in the
 * plain (imla'i) spelling Quran ASR models write, with or without harakat.
 */

import { ayahIndex, type AyahRef } from "./quran";
import { BISMILLAH, hasSeparateBismillah, quranWords, splitBismillah } from "./quran-text";

// ---------------------------------------------------------------------------------------------
// Normalisation

/** Letters folded together: hamza seats, alef forms, alef maqsura, ta marbuta, Persian forms. */
const FOLD: Readonly<Record<string, string>> = {
  "\u0622": "\u0627", // alef with madda
  "\u0623": "\u0627", // alef with hamza above
  "\u0625": "\u0627", // alef with hamza below
  "\u0671": "\u0627", // alef wasla
  "\u0672": "\u0627",
  "\u0673": "\u0627",
  "\u0624": "\u0648", // waw with hamza
  "\u0626": "\u064A", // ya with hamza
  "\u0649": "\u064A", // alef maqsura
  "\u06CC": "\u064A", // Persian ya
  "\u0629": "\u0647", // ta marbuta
  "\u06C1": "\u0647",
  "\u06A9": "\u0643", // Persian kaf
  "\u06E7": "\u064A", // small high ya: the ya imla'i writes in e.g. ٱلنَّبِيِّـۧنَ
};

const ALEF = "\u0627";
const WAW = "\u0648";
const SAD = "\u0635";
const SEEN = "\u0633";
/** Small high seen: the sad under it is read, and written in imla'i, as seen (يَبْصُۜطُ → يبسط). */
const SMALL_HIGH_SEEN = "\u06DC";
const ALEF_MAQSURA = "\u0649";
const DAGGER_ALEF = "\u0670";

/** Base letters that survive normalisation (after `FOLD`). */
function isBaseLetter(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (c >= 0x0627 && c <= 0x063a) || (c >= 0x0641 && c <= 0x064a);
}

/** Harakat, shadda, sukun and hamza marks: they end a "bare letter" (see the dagger alef rule). */
function isVowelMark(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x064b && c <= 0x0655;
}

/**
 * Reduces Arabic text to bare letters so the Uthmani text and an ASR transcript in imla'i
 * spelling compare word by word. Removes harakat, shadda, sukun, Quranic annotation marks, tatweel,
 * standalone and combining hamza, punctuation, digits and anything that is not an Arabic letter;
 * folds alef forms (أ إ آ ٱ) to ا, ؤ to و, ئ and ى to ي, ة to ه. The Uthmani dagger alef becomes
 * the alef imla'i writes (ٱلْعَٰلَمِينَ → العالمين); after a bare waw it replaces the waw
 * (ٱلصَّلَوٰةَ → الصلاه, like الصلاة), after alef maqsura it is dropped (عَلَىٰ → علي). The small
 * waw and ya of a lengthened pronoun (بِهِۦ, لَهُۥ) are dropped, as imla'i does not write them; a
 * sad under a small high seen becomes seen (وَيَبْصُۜطُ → ويبسط).
 * Words stay separated by single spaces; the result has no leading or trailing space.
 */
export function normalizeArabic(text: string): string {
  const words: string[] = [];
  let word = "";
  let lastBase = "";
  let marked = false;
  const flush = () => {
    if (word !== "") words.push(word);
    word = "";
    lastBase = "";
  };
  for (const ch of text) {
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (ch === DAGGER_ALEF) {
      if (lastBase === ALEF_MAQSURA && !marked) {
        // ىٰ is written ى in imla'i.
      } else if (lastBase === WAW && !marked && word.endsWith(WAW)) {
        word = word.slice(0, -1) + ALEF;
      } else {
        word += ALEF;
      }
      lastBase = ALEF;
      marked = true;
      continue;
    }
    if (ch === SMALL_HIGH_SEEN) {
      if (lastBase === SAD && word.endsWith(SAD)) word = word.slice(0, -1) + SEEN;
      continue;
    }
    const folded = FOLD[ch] ?? ch;
    if (isBaseLetter(folded)) {
      word += folded;
      lastBase = ch;
      marked = false;
    } else if (isVowelMark(ch)) {
      marked = true;
    }
    // Everything else (tatweel, hamza ء, Quranic marks, punctuation, digits, Latin) is dropped.
  }
  flush();
  return words.join(" ");
}

// ---------------------------------------------------------------------------------------------
// Word comparison

/** ا و ي */
function isSoft(code: number): boolean {
  return code === 0x0627 || code === 0x0648 || code === 0x064a;
}
/** Cost of a long-vowel letter (ا و ي) or of one letter of a doubled pair, where the spellings differ. */
const SOFT_COST = 0.25;
/**
 * Words whose weighted distance is at most this count as the same word: two long-vowel edits.
 * A word of one or two letters allows one (so لِى is not إلا).
 */
const SAME_WORD = 0.5;

function tolerance(a: string, b: string): number {
  return Math.min(a.length, b.length) <= 2 ? SOFT_COST : SAME_WORD;
}

let rowA = new Float64Array(32);
let rowB = new Float64Array(32);
let gapsB = new Float64Array(32);

function gapCost(s: string, k: number): number {
  const code = s.charCodeAt(k);
  if (isSoft(code)) return SOFT_COST;
  if ((k > 0 && s.charCodeAt(k - 1) === code) || s.charCodeAt(k + 1) === code) return SOFT_COST;
  return 1;
}

/**
 * Edit distance between two normalised words where the differences between Uthmani and imla'i
 * spelling are cheap: adding, dropping or swapping a long-vowel letter (ا و ي), and writing a
 * doubled letter once (ٱلَّيْلِ → اليل vs الليل), cost `SOFT_COST`; any other letter costs 1.
 */
export function wordDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = b.length;
  if (rowA.length <= m) {
    rowA = new Float64Array(m + 1);
    rowB = new Float64Array(m + 1);
    gapsB = new Float64Array(m + 1);
  }
  let prev = rowA;
  let cur = rowB;
  prev[0] = 0;
  for (let j = 1; j <= m; j++) {
    gapsB[j] = gapCost(b, j - 1);
    prev[j] = prev[j - 1] + gapsB[j];
  }
  for (let i = 1; i <= a.length; i++) {
    const ai = a.charCodeAt(i - 1);
    const aiSoft = isSoft(ai);
    const del = gapCost(a, i - 1);
    cur[0] = prev[0] + del;
    for (let j = 1; j <= m; j++) {
      const bj = b.charCodeAt(j - 1);
      const sub = ai === bj ? 0 : aiSoft && isSoft(bj) ? SOFT_COST : 1;
      cur[j] = Math.min(prev[j - 1] + sub, prev[j] + del, cur[j - 1] + gapsB[j]);
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[m];
}

/** Whether two normalised words are the same word, allowing for Uthmani vs imla'i spelling. */
export function sameWord(a: string, b: string): boolean {
  return wordDistance(a, b) <= tolerance(a, b);
}

// ---------------------------------------------------------------------------------------------
// Alignment

/** An ayah to recite: its reference and Tanzil's text exactly as stored (Bismillah prefix included). */
export interface ExpectedAyah extends AyahRef {
  text: string;
}

/** A word of the Quran: `word` is 0-based among the ayah's words without the Bismillah prefix. */
export interface WordRef extends AyahRef {
  word: number;
}

/**
 * - `correct`: recited (spelling differences only in ا و ي are not counted as mistakes);
 * - `skipped`: not recited;
 * - `substituted`: something else was heard in its place;
 * - `omitted`: an optional word (the Bismillah before ayah 1) that was not recited; not a mistake.
 */
export type RecitedWordStatus = "correct" | "skipped" | "substituted" | "omitted";

export interface RecitedWord extends WordRef {
  /**
   * Part of the Bismillah Tanzil stores before ayah 1, which the app shows as a heading (see
   * `splitBismillah`); `word` then counts within the Bismillah. Reciting it is optional.
   */
  bismillah: boolean;
  /** The word as stored in the Uthmani text. */
  text: string;
  status: RecitedWordStatus;
  /**
   * Indexes into `RecitationAlignment.heard` of what was heard for this word: none when skipped,
   * two when the transcript split the word (يَٰٓأَيُّهَا heard as يا أيها), and one heard word is
   * shared by two expected words when the transcript joined them.
   */
  heard: number[];
}

/** A heard word that matches no expected word. */
export interface InsertedWord {
  heard: number;
  /** Index into `words` of the expected word it comes after; -1 when it comes before all of them. */
  after: number;
}

/**
 * A run of heard words found elsewhere in the Quran text that was searched. `repeat`: the
 * reciter went back over words of the expected range already recited (not a mistake). `jump`:
 * the words come from an ayah outside the range or from further on in it (a wrong-ayah mistake,
 * e.g. continuing with the ending of a similar ayah).
 */
export interface AyahJump {
  kind: "jump" | "repeat";
  /** Indexes into `heard`, inclusive. */
  heardStart: number;
  heardEnd: number;
  /** The expected ayah the reciter should have been reciting. */
  at: AyahRef;
  /** First and last word of the text the heard words were found in. */
  start: WordRef;
  end: WordRef;
  /** Heard words of the run that match that text. */
  matched: number;
}

export interface RecitationCounts {
  /** Expected words (Bismillah prefix excluded) and their outcome. */
  words: number;
  correct: number;
  skipped: number;
  substituted: number;
  /** Heard words that match no expected word (formulas and repeats included). */
  inserted: number;
}

export interface RecitationAlignment {
  /** Words of the transcript, as written in it, that contain at least one Arabic letter. */
  heard: string[];
  /** Heard words recognised as the isti'adha, a Bismillah or the closing formula; not compared. */
  formulas: number[];
  /** Every expected word in reading order. */
  words: RecitedWord[];
  inserted: InsertedWord[];
  jumps: AyahJump[];
  /** Ayahs none of whose words were recited. */
  skippedAyahs: AyahRef[];
  counts: RecitationCounts;
}

export interface AlignOptions {
  /**
   * More ayat to look in for heard words that match nothing expected, e.g. the rest of the surah or
   * the ayat that resemble the expected ones. The expected ayat are always searched.
   */
  context?: readonly ExpectedAyah[];
  /** A wrong-ayah jump needs at least this many heard words matching the other text. Default 3. */
  minJumpWords?: number;
}

interface Slot {
  ref: AyahRef;
  word: number;
  bismillah: boolean;
  text: string;
  key: string;
}

const COST_SKIP = 1;
const COST_INSERT = 1;
/** Substitution costs between these, more for less similar words: always below skip + insert. */
const COST_SUB_MIN = 0.6;
const COST_SUB_SPAN = 0.4;
/** Matching weight of the spelling distance; keeps exact matches preferred to near ones. */
const COST_MATCH_PER_DISTANCE = 0.1;
const COST_MERGE = 0.1;

const enum Op {
  None,
  Match,
  Sub,
  Skip,
  Insert,
  /** Two heard words make one expected word. */
  SplitWord,
  /** One heard word makes two expected words. */
  JoinedWords,
}

function keyOf(word: string): string {
  return normalizeArabic(word).replaceAll(" ", "");
}

const keysOf = (text: string) =>
  normalizeArabic(text)
    .split(" ")
    .filter((w) => w !== "");

const ISTIADHA = keysOf("أعوذ بالله من الشيطان الرجيم");
const ISTIADHA_LONG = keysOf("أعوذ بالله السميع العليم من الشيطان الرجيم");
const BISMILLAH_KEYS = keysOf(BISMILLAH);
const CLOSING = keysOf("صدق الله العظيم");

/** Length of `phrase` heard at `heard[at..]`, or 0. */
function phraseAt(heard: readonly string[], at: number, phrase: readonly string[]): number {
  if (at < 0 || at + phrase.length > heard.length) return 0;
  for (let k = 0; k < phrase.length; k++) if (!sameWord(heard[at + k], phrase[k])) return 0;
  return phrase.length;
}

function expectedSlots(expected: readonly ExpectedAyah[]): { slots: Slot[]; optional: boolean[] } {
  const slots: Slot[] = [];
  const optional: boolean[] = [];
  for (const a of expected) {
    ayahIndex(a.surah, a.ayah);
    const ref = { surah: a.surah, ayah: a.ayah };
    const split = splitBismillah(a.surah, a.ayah, a.text);
    if (split.bismillah !== null) {
      for (const [word, text] of quranWords(split.bismillah).entries()) {
        slots.push({ ref, word, bismillah: true, text, key: keyOf(text) });
        optional.push(true);
      }
    }
    for (const [word, text] of quranWords(split.text).entries()) {
      slots.push({ ref, word, bismillah: false, text, key: keyOf(text) });
      optional.push(false);
    }
  }
  return { slots, optional };
}

interface Step {
  op: Op;
  /** Expected slots consumed: [i0, i1). */
  i0: number;
  i1: number;
  /** Heard keys consumed: [j0, j1) (indexes into the compared list). */
  j0: number;
  j1: number;
}

/** Each distinct word of `keys` once, and the position of every key in that list. */
function intern(keys: readonly string[]): { ids: Int32Array; distinct: string[] } {
  const index = new Map<string, number>();
  const distinct: string[] = [];
  const ids = new Int32Array(keys.length);
  for (const [k, key] of keys.entries()) {
    let id = index.get(key);
    if (id === undefined) {
      id = distinct.length;
      index.set(key, id);
      distinct.push(key);
    }
    ids[k] = id;
  }
  return { ids, distinct };
}

/** Two words joined can only be the same word as a third if their lengths differ by two letters at most. */
const MAX_SAME_WORD_LENGTH_GAP = SAME_WORD / SOFT_COST;

/** Global alignment of expected slots to heard keys (dynamic programming, O(n·m) time and memory). */
function alignWords(
  slots: readonly Slot[],
  optional: readonly boolean[],
  keys: readonly string[],
): Step[] {
  const n = slots.length;
  const m = keys.length;
  const w = m + 1;
  const cost = new Float64Array((n + 1) * w);
  const back = new Uint8Array((n + 1) * w);
  // Recitations repeat words a lot: each distinct pair's distance is computed once.
  const rows = intern(slots.map((s) => s.key));
  const cols = intern(keys);
  const cols0 = cols.distinct.length;
  const distances = new Float64Array(rows.distinct.length * cols0).fill(-1);
  for (let j = 1; j <= m; j++) {
    cost[j] = j * COST_INSERT;
    back[j] = Op.Insert;
  }
  for (let i = 1; i <= n; i++) {
    const row = i * w;
    const skip = optional[i - 1] ? 0 : COST_SKIP;
    cost[row] = cost[row - w] + skip;
    back[row] = Op.Skip;
    const e = slots[i - 1].key;
    const rowBase = rows.ids[i - 1] * cols0;
    for (let j = 1; j <= m; j++) {
      const cell = rowBase + cols.ids[j - 1];
      let d = distances[cell];
      if (d < 0) {
        d = wordDistance(e, keys[j - 1]);
        distances[cell] = d;
      }
      let best: number;
      let op: Op;
      if (d <= tolerance(e, keys[j - 1])) {
        best = cost[row - w + j - 1] + d * COST_MATCH_PER_DISTANCE;
        op = Op.Match;
      } else {
        const sim = Math.max(0, 1 - d / Math.max(e.length, keys[j - 1].length));
        best = cost[row - w + j - 1] + COST_SUB_MIN + COST_SUB_SPAN * (1 - sim);
        op = Op.Sub;
      }
      let c = cost[row - w + j] + skip;
      if (c < best) {
        best = c;
        op = Op.Skip;
      }
      // On a tie the later heard word is the extra one, so a repeated phrase is reported where
      // the reciter went back, after the words were first recited.
      c = cost[row + j - 1] + COST_INSERT;
      if (c <= best) {
        best = c;
        op = Op.Insert;
      }
      if (
        j >= 2 &&
        d > 0 &&
        Math.abs(e.length - keys[j - 2].length - keys[j - 1].length) <= MAX_SAME_WORD_LENGTH_GAP
      ) {
        const dj = wordDistance(e, keys[j - 2] + keys[j - 1]);
        c = cost[row - w + j - 2] + COST_MERGE + dj * COST_MATCH_PER_DISTANCE;
        if (dj <= SAME_WORD && c < best) {
          best = c;
          op = Op.SplitWord;
        }
      }
      if (
        i >= 2 &&
        d > 0 &&
        optional[i - 2] === optional[i - 1] &&
        Math.abs(slots[i - 2].key.length + e.length - keys[j - 1].length) <=
          MAX_SAME_WORD_LENGTH_GAP
      ) {
        const dj = wordDistance(slots[i - 2].key + e, keys[j - 1]);
        c = cost[row - 2 * w + j - 1] + COST_MERGE + dj * COST_MATCH_PER_DISTANCE;
        if (dj <= SAME_WORD && c < best) {
          best = c;
          op = Op.JoinedWords;
        }
      }
      cost[row + j] = best;
      back[row + j] = op;
    }
  }
  const steps: Step[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const op = back[i * w + j] as Op;
    const di = op === Op.Insert ? 0 : op === Op.JoinedWords ? 2 : 1;
    const dj = op === Op.Skip ? 0 : op === Op.SplitWord ? 2 : 1;
    steps.push({ op, i0: i - di, i1: i, j0: j - dj, j1: j });
    i -= di;
    j -= dj;
  }
  return steps.reverse();
}

/** The text searched for jumps: its words in Quran order, with interned keys. */
interface Context {
  words: WordRef[];
  /** Per word, its key's index in `distinct`. */
  ids: Int32Array;
  distinct: string[];
}

function contextOf(expected: readonly ExpectedAyah[], extra: readonly ExpectedAyah[]): Context {
  const byIndex = new Map<number, ExpectedAyah>();
  for (const a of [...expected, ...extra]) byIndex.set(ayahIndex(a.surah, a.ayah), a);
  const words: WordRef[] = [];
  const keys: string[] = [];
  for (const index of [...byIndex.keys()].sort((x, y) => x - y)) {
    const a = byIndex.get(index)!;
    for (const [word, text] of quranWords(splitBismillah(a.surah, a.ayah, a.text).text).entries()) {
      words.push({ surah: a.surah, ayah: a.ayah, word });
      keys.push(keyOf(text));
    }
  }
  return { words, ...intern(keys) };
}

interface Found {
  /** Range in the run, inclusive. */
  runStart: number;
  runEnd: number;
  /** Range in the context, inclusive. */
  start: number;
  end: number;
  matched: number;
}

/** Best place in `context` for `run` (free start and end in the context, every run word consumed). */
function locate(run: readonly string[], context: Context): Found | null {
  const r = run.length;
  const c = context.words.length;
  if (r === 0 || c === 0) return null;
  // Which distinct context words each run word is: computed once per distinct word, not per position.
  const same = run.map((key) => {
    const row = new Uint8Array(context.distinct.length);
    for (const [id, other] of context.distinct.entries()) {
      if (Math.abs(key.length - other.length) <= MAX_SAME_WORD_LENGTH_GAP && sameWord(key, other)) {
        row[id] = 1;
      }
    }
    return row;
  });
  const w = c + 1;
  const cost = new Float64Array((r + 1) * w);
  const back = new Uint8Array((r + 1) * w);
  for (let i = 1; i <= r; i++) {
    const row = i * w;
    const isSame = same[i - 1];
    cost[row] = i;
    back[row] = Op.Insert;
    for (let k = 1; k <= c; k++) {
      let best = cost[row - w + k - 1] + (isSame[context.ids[k - 1]] === 1 ? 0 : 1);
      let op = best === cost[row - w + k - 1] ? Op.Match : Op.Sub;
      const ins = cost[row - w + k] + 1;
      if (ins < best) {
        best = ins;
        op = Op.Insert;
      }
      const skip = cost[row + k - 1] + 1;
      if (skip < best) {
        best = skip;
        op = Op.Skip;
      }
      cost[row + k] = best;
      back[row + k] = op;
    }
  }
  let endK = 1;
  for (let k = 2; k <= c; k++) if (cost[r * w + k] < cost[r * w + endK]) endK = k;
  let i = r;
  let k = endK;
  let matched = 0;
  let found: Found | null = null;
  while (i > 0) {
    const op = back[i * w + k] as Op;
    if (op === Op.Match) {
      matched++;
      if (found === null)
        found = { runStart: i - 1, runEnd: i - 1, start: k - 1, end: k - 1, matched: 0 };
      found.runStart = i - 1;
      found.start = k - 1;
    }
    if (op === Op.Match || op === Op.Sub) {
      i--;
      k--;
    } else if (op === Op.Insert) i--;
    else k--;
  }
  if (found !== null) found.matched = matched;
  return found;
}

/**
 * Aligns a transcript of a recitation to the ayat that were meant to be recited, word by word.
 *
 * `expected` lists the ayat in reading order with Tanzil's stored text; the Bismillah prefix of an
 * ayah 1 may be recited or not. A leading isti'adha, a leading Bismillah (when the range does not
 * start at an ayah 1 that carries one) and a closing "صدق الله العظيم" are recognised and set aside.
 * Runs of at least `minJumpWords` heard words that match nothing expected are looked up in the
 * expected ayat and `options.context` to report repeats and wrong-ayah jumps.
 *
 * Cost is O(n·m) for n expected and m heard words; align one hafalan unit (about half a page) at a
 * time rather than a whole juz.
 */
export function alignRecitation(
  expected: readonly ExpectedAyah[],
  transcript: string,
  options: AlignOptions = {},
): RecitationAlignment {
  const minJumpWords = options.minJumpWords ?? 3;
  if (!Number.isInteger(minJumpWords) || minJumpWords < 1) {
    throw new RangeError(`minJumpWords must be a positive integer, got ${minJumpWords}`);
  }
  const heard: string[] = [];
  const heardKeys: string[] = [];
  for (const raw of transcript.split(/\s+/)) {
    const key = keyOf(raw);
    if (key === "") continue;
    heard.push(raw);
    heardKeys.push(key);
  }

  const { slots, optional } = expectedSlots(expected);
  const first = expected[0];
  const startsWithBismillah =
    first !== undefined &&
    first.ayah === 1 &&
    (first.surah === 1 || hasSeparateBismillah(first.surah));

  // Formulas around the recitation: isti'adha, then a Bismillah; "sadaqallahul 'azim" at the end.
  const formulas: number[] = [];
  let from = 0;
  const istiadha = phraseAt(heardKeys, 0, ISTIADHA_LONG) || phraseAt(heardKeys, 0, ISTIADHA);
  from += istiadha;
  if (!startsWithBismillah) from += phraseAt(heardKeys, from, BISMILLAH_KEYS);
  let to = heardKeys.length;
  const closing = phraseAt(heardKeys, to - CLOSING.length, CLOSING);
  if (closing > 0 && to - closing >= from) to -= closing;
  for (let j = 0; j < from; j++) formulas.push(j);
  for (let j = to; j < heardKeys.length; j++) formulas.push(j);

  const steps = alignWords(slots, optional, heardKeys.slice(from, to));

  const words: RecitedWord[] = slots.map((s, i) => ({
    surah: s.ref.surah,
    ayah: s.ref.ayah,
    word: s.word,
    bismillah: s.bismillah,
    text: s.text,
    status: optional[i] ? "omitted" : "skipped",
    heard: [],
  }));
  const inserted: InsertedWord[] = [];
  // Per heard index: matched to no expected word; the slot it substitutes (-1 if none); the last
  // slot consumed before it.
  const unmatched: boolean[] = Array.from({ length: heard.length }, () => false);
  const substitutes: number[] = Array.from({ length: heard.length }, () => -1);
  const lastSlotBefore: number[] = Array.from({ length: heard.length }, () => -1);
  let lastSlot = -1;
  for (const s of steps) {
    const heardIdx = Array.from({ length: s.j1 - s.j0 }, (_, k) => from + s.j0 + k);
    for (const h of heardIdx) lastSlotBefore[h] = lastSlot;
    switch (s.op) {
      case Op.Match:
      case Op.SplitWord:
      case Op.JoinedWords:
        for (let i = s.i0; i < s.i1; i++) {
          words[i].status = "correct";
          words[i].heard = heardIdx;
        }
        break;
      case Op.Sub:
        words[s.i0].status = "substituted";
        words[s.i0].heard = heardIdx;
        unmatched[heardIdx[0]] = true;
        substitutes[heardIdx[0]] = s.i0;
        break;
      case Op.Insert:
        inserted.push({ heard: heardIdx[0], after: lastSlot });
        unmatched[heardIdx[0]] = true;
        break;
      case Op.Skip:
      case Op.None:
        break;
    }
    if (s.i1 > s.i0) lastSlot = s.i1 - 1;
  }
  for (const f of formulas) inserted.push({ heard: f, after: f < from ? -1 : slots.length - 1 });

  // Runs of unmatched heard words: repeats and wrong-ayah jumps. An expected word "substituted" by
  // a word of such a run was not recited at all: it becomes skipped and the heard word inserted.
  const jumps: AyahJump[] = [];
  let context: Context | undefined;
  const slotOf = new Map<string, number>();
  for (const [i, s] of slots.entries()) {
    if (!s.bismillah) slotOf.set(`${s.ref.surah}:${s.ref.ayah}:${s.word}`, i);
  }
  let runStart = from;
  for (let h = from; h <= to; h++) {
    if (h < to && unmatched[h]) continue;
    if (h - runStart >= minJumpWords) {
      context ??= contextOf(expected, options.context ?? []);
      const found = locate(heardKeys.slice(runStart, h), context);
      if (found !== null && found.matched >= minJumpWords && found.matched * 2 > h - runStart) {
        const start = context.words[found.start];
        const end = context.words[found.end];
        const before = lastSlotBefore[runStart + found.runStart];
        const endSlot = slotOf.get(`${end.surah}:${end.ayah}:${end.word}`);
        const atSlot = slots[Math.min(before + 1, slots.length - 1)];
        const jump: AyahJump = {
          kind: endSlot !== undefined && endSlot <= before ? "repeat" : "jump",
          heardStart: runStart + found.runStart,
          heardEnd: runStart + found.runEnd,
          at: atSlot ? { ...atSlot.ref } : { surah: start.surah, ayah: start.ayah },
          start: { surah: start.surah, ayah: start.ayah, word: start.word },
          end: { surah: end.surah, ayah: end.ayah, word: end.word },
          matched: found.matched,
        };
        jumps.push(jump);
        for (let j = jump.heardStart; j <= jump.heardEnd; j++) {
          const slot = substitutes[j];
          if (slot < 0) continue;
          words[slot].status = "skipped";
          words[slot].heard = [];
          inserted.push({ heard: j, after: lastSlotBefore[j] });
        }
      }
    }
    runStart = h + 1;
  }
  inserted.sort((a, b) => a.heard - b.heard);

  const skippedAyahs: AyahRef[] = [];
  const counts: RecitationCounts = {
    words: 0,
    correct: 0,
    skipped: 0,
    substituted: 0,
    inserted: inserted.length,
  };
  let ayahStart = 0;
  for (let i = 0; i <= words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (i > 0 && (w === undefined || w.surah !== prev.surah || w.ayah !== prev.ayah)) {
      const ayahWords = words.slice(ayahStart, i).filter((x) => !x.bismillah);
      if (ayahWords.length > 0 && ayahWords.every((x) => x.status === "skipped")) {
        skippedAyahs.push({ surah: prev.surah, ayah: prev.ayah });
      }
      ayahStart = i;
    }
    if (w === undefined || w.bismillah) continue;
    counts.words++;
    if (w.status === "correct") counts.correct++;
    else if (w.status === "skipped") counts.skipped++;
    else if (w.status === "substituted") counts.substituted++;
  }

  return { heard, formulas, words, inserted, jumps, skippedAyahs, counts };
}
