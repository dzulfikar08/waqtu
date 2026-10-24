/**
 * Helpers for the Tanzil Uthmani text (see content/quran/README.md). They only read the text; the
 * stored text itself is never changed.
 */

/** Tanzil's text for 1:1 (as code points, so no editor can reorder its marks), also the prefix it puts in front of ayah 1 of every surah except 1 and 9. */
export const BISMILLAH =
  "\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u0651\u064E\u0647\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0670\u0646\u0650 \u0671\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650";

// Arabic letters (not the combining marks, waqf signs and ayah/sajdah symbols around them).
const LETTER = /[\u0620-\u064A\u066E-\u06D3\u06D5\u06FA-\u06FF]/;

/** Surah 9 has no Bismillah; in surah 1 it is ayah 1 itself. */
export function hasSeparateBismillah(surah: number): boolean {
  return surah !== 1 && surah !== 9;
}

/** Letters only: Tanzil spells the marks of the Bismillah differently in a few surahs (95, 97). */
function letters(text: string): string {
  let out = "";
  for (const ch of text) if (LETTER.test(ch)) out += ch;
  return out;
}

const BISMILLAH_WORDS = BISMILLAH.split(" ").length;
const BISMILLAH_LETTERS = letters(BISMILLAH);

/**
 * Tanzil stores the Bismillah of a surah in front of its first ayah. For display it is shown as a
 * heading line: `bismillah` is that prefix exactly as stored (null when the ayah has none) and
 * `text` is what follows it.
 */
export function splitBismillah(
  surah: number,
  ayah: number,
  text: string,
): { bismillah: string | null; text: string } {
  if (ayah !== 1 || !hasSeparateBismillah(surah)) return { bismillah: null, text };
  const tokens = text.split(" ");
  const head = tokens.slice(0, BISMILLAH_WORDS).join(" ");
  if (tokens.length <= BISMILLAH_WORDS || letters(head) !== BISMILLAH_LETTERS) {
    return { bismillah: null, text };
  }
  return { bismillah: head, text: tokens.slice(BISMILLAH_WORDS).join(" ") };
}

/**
 * Words of an ayah. Tanzil attaches waqf and sajdah signs to the word before them, so a plain
 * split on spaces never leaves a sign on its own (checked over the whole text in the tests).
 */
export function quranWords(text: string): string[] {
  return text.split(" ").filter((word) => word !== "");
}

function clusters(word: string): string[] {
  const out: string[] = [];
  for (const ch of word) {
    if (LETTER.test(ch) || out.length === 0) out.push(ch);
    else out[out.length - 1] += ch;
  }
  return out;
}

const ALEF_WASLA = "\u0671";
const LAM = "\u0644";

/**
 * The beginning of a word as a self-test hint: its first letter with its marks. For a word that
 * starts with the article (alef wasla + lam) the first letter of the noun is included too.
 */
export function firstLetters(word: string): string {
  const parts = clusters(word);
  if (parts.length <= 1) return word;
  const article = parts[0][0] === ALEF_WASLA && parts[1][0] === LAM && parts.length > 2;
  return parts.slice(0, article ? 3 : 1).join("");
}
