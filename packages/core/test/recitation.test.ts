import { describe, expect, test } from "bun:test";

import { parseRange, surahAyahs } from "../scripts/recitation-eval";
import {
  alignRecitation,
  normalizeArabic,
  quranWords,
  sameWord,
  splitBismillah,
  SURAHS,
  wordDistance,
  type ExpectedAyah,
  type RecitationAlignment,
} from "../src/index";

const ayat = (surah: number, from: number, to = from) => parseRange(`${surah}:${from}-${to}`);

/** The ayah's words without the Bismillah prefix, as `alignRecitation` numbers them. */
const wordsOf = (a: ExpectedAyah) => quranWords(splitBismillah(a.surah, a.ayah, a.text).text);

const flagged = (r: RecitationAlignment) =>
  r.words
    .filter((w) => w.status === "skipped" || w.status === "substituted")
    .map((w) => `${w.surah}:${w.ayah}:${w.word}:${w.status}`);

// Transcripts in plain (imla'i) spelling with harakat, as the EveryAyah dataset and the Quran
// Whisper models trained on it write them.
const FATIHAH_IMLAI = [
  "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
  "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
  "الرَّحْمَنِ الرَّحِيمِ",
  "مَالِكِ يَوْمِ الدِّينِ",
  "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
  "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
  "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
];
const MULK_1_2_IMLAI = [
  "تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
  "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا وَهُوَ الْعَزِيزُ الْغَفُورُ",
];

describe("normalizeArabic", () => {
  test("strips harakat and folds letter variants", () => {
    expect(normalizeArabic("ٱلْحَمْدُ لِلَّهِ")).toBe("الحمد لله");
    expect(normalizeArabic("إِيَّاكَ")).toBe("اياك");
    expect(normalizeArabic("أَحَدٌۢ")).toBe("احد");
    expect(normalizeArabic("آمَنُوا")).toBe("امنوا");
    expect(normalizeArabic("مُؤْمِنٌ")).toBe("مومن");
    expect(normalizeArabic("بَرَآءَةٌ")).toBe("براه");
    expect(normalizeArabic("ٱلْمَلَٰٓئِكَةِ")).toBe("الملايكه");
  });

  test("dagger alef: the alef imla'i writes; after a bare waw it is that waw; after alef maqsura it goes", () => {
    expect(normalizeArabic("ٱلْعَٰلَمِينَ")).toBe("العالمين");
    expect(normalizeArabic("ٱلْعَٰلَمِينَ")).toBe(normalizeArabic("الْعَالَمِينَ"));
    expect(normalizeArabic("وَٱلْحَيَوٰةَ")).toBe(normalizeArabic("وَالْحَيَاةَ"));
    expect(normalizeArabic("ٱلصَّلَوٰةَ")).toBe(normalizeArabic("الصَّلَاةَ"));
    expect(normalizeArabic("سَمَٰوَٰتٍ")).toBe(normalizeArabic("سَمَاوَاتٍ"));
    expect(normalizeArabic("عَلَىٰ")).toBe(normalizeArabic("عَلَى"));
    expect(normalizeArabic("مُوسَىٰ")).toBe("موسي");
  });

  test("small letters, tatweel, hamza marks and sad read as seen", () => {
    expect(normalizeArabic("لَّهُۥ")).toBe("له");
    expect(normalizeArabic("بِهِۦ")).toBe("به");
    expect(normalizeArabic("يَسْـَٔلُونَ")).toBe("يسلون");
    expect(normalizeArabic("وَيَبْصُۜطُ")).toBe("ويبسط");
    expect(normalizeArabic("ٱلنَّبِيِّـۧنَ")).toBe(normalizeArabic("النَّبِيِّينَ"));
  });

  test("drops punctuation, digits and Latin; keeps one space between words", () => {
    expect(normalizeArabic("  قُلْ،  هُوَ (1) ٱللَّهُ. abc ")).toBe("قل هو الله");
    expect(normalizeArabic("٣ ؟ ...")).toBe("");
  });

  test("every word of the Uthmani text keeps at least one letter", () => {
    for (const s of SURAHS.keys()) {
      for (const text of surahAyahs(s + 1)) {
        for (const word of quranWords(text)) expect(normalizeArabic(word)).not.toBe("");
      }
    }
  });
});

describe("wordDistance / sameWord", () => {
  test("Uthmani vs imla'i spellings of the same word are the same word", () => {
    const pairs: [string, string][] = [
      ["ٱلرَّحْمَٰنِ", "الرَّحْمَنِ"],
      ["مَٰلِكِ", "مَالِكِ"],
      ["ٱلَّيْلِ", "اللَّيْلِ"],
      ["ٱلرِّبَوٰا۟", "الرِّبَا"],
      ["إِبْرَٰهِـۧمَ", "إِبْرَاهِيمَ"],
      ["دَاوُۥدَ", "دَاوُدَ"],
      ["ٱلْقُرْءَانُ", "الْقُرْآنُ"],
      ["شَىْءٍ", "شَيْءٍ"],
    ];
    for (const [a, b] of pairs) {
      expect(sameWord(normalizeArabic(a), normalizeArabic(b))).toBe(true);
    }
  });

  test("different words are not", () => {
    const pairs: [string, string][] = [
      ["يعلمون", "تعلمون"],
      ["الذين", "الذي"],
      ["لي", "الا"],
      ["من", "ما"],
      ["قدير", "بصير"],
    ];
    for (const [a, b] of pairs) expect(sameWord(a, b)).toBe(false);
  });

  test("letter edits cost 1, long vowels and doubled letters a quarter", () => {
    expect(wordDistance("كتب", "كتب")).toBe(0);
    expect(wordDistance("كتب", "كتاب")).toBe(0.25);
    expect(wordDistance("الليل", "اليل")).toBe(0.25);
    expect(wordDistance("كتب", "كسب")).toBe(1);
    expect(wordDistance("", "قل")).toBe(2);
  });
});

describe("alignRecitation: correct recitations", () => {
  test("the stored text itself aligns without a mistake", () => {
    const expected = ayat(67, 1, 5);
    const r = alignRecitation(expected, expected.map((a) => a.text).join(" "));
    expect(flagged(r)).toEqual([]);
    expect(r.inserted).toEqual([]);
    expect(r.counts).toEqual({
      words: expected.reduce((n, a) => n + wordsOf(a).length, 0),
      correct: expected.reduce((n, a) => n + wordsOf(a).length, 0),
      skipped: 0,
      substituted: 0,
      inserted: 0,
    });
    expect(r.words.filter((w) => w.bismillah).map((w) => w.status)).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  test("an imla'i transcript of Al-Fatihah aligns without a mistake", () => {
    const r = alignRecitation(ayat(1, 1, 7), FATIHAH_IMLAI.join(" "));
    expect(flagged(r)).toEqual([]);
    expect(r.inserted).toEqual([]);
    expect(r.counts.correct).toBe(29);
  });

  test("words the transcript splits or joins still count as recited", () => {
    const r = alignRecitation(
      ayat(2, 21),
      "يَا أَيُّهَا النَّاسُ اعْبُدُوا رَبَّكُمُ الَّذِي خَلَقَكُمْ وَالَّذِينَ مِنْقَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ",
    );
    expect(flagged(r)).toEqual([]);
    expect(r.words[0]).toMatchObject({
      text: wordsOf(ayat(2, 21)[0])[0],
      status: "correct",
      heard: [0, 1],
    });
    expect(r.words[7].heard).toEqual([8]);
    expect(r.words[8].heard).toEqual([8]);
  });

  test("the Bismillah before ayah 1 is optional", () => {
    const without = alignRecitation(ayat(67, 1, 2), MULK_1_2_IMLAI.join(" "));
    expect(flagged(without)).toEqual([]);
    expect(without.words.filter((w) => w.bismillah).map((w) => w.status)).toEqual([
      "omitted",
      "omitted",
      "omitted",
      "omitted",
    ]);
    const withIt = alignRecitation(
      ayat(67, 1, 2),
      `${FATIHAH_IMLAI[0]} ${MULK_1_2_IMLAI.join(" ")}`,
    );
    expect(flagged(withIt)).toEqual([]);
    expect(withIt.words.filter((w) => w.bismillah).every((w) => w.status === "correct")).toBe(true);
    expect(withIt.counts.words).toBe(without.counts.words);
  });

  test("isti'adha, a Bismillah mid-surah and the closing formula are set aside", () => {
    const transcript = [
      "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
      FATIHAH_IMLAI[0],
      MULK_1_2_IMLAI[1],
      "صَدَقَ اللَّهُ الْعَظِيمُ",
    ].join(" ");
    const r = alignRecitation(ayat(67, 2), transcript);
    expect(flagged(r)).toEqual([]);
    expect(r.formulas).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22]);
    expect(r.counts.inserted).toBe(12);
    expect(r.jumps).toEqual([]);
  });

  test("Al-Fatihah's Bismillah is its first ayah, not optional", () => {
    const r = alignRecitation(ayat(1, 1, 2), FATIHAH_IMLAI[1]);
    expect(r.skippedAyahs).toEqual([{ surah: 1, ayah: 1 }]);
    expect(r.counts.skipped).toBe(4);
  });
});

describe("alignRecitation: mistakes", () => {
  test("skipped words are reported where they were skipped", () => {
    // 67:2 without أَيُّكُمْ (word 5) and 67:1 without بِيَدِهِ (word 2).
    const transcript = [
      "تَبَارَكَ الَّذِي الْمُلْكُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
      "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَحْسَنُ عَمَلًا وَهُوَ الْعَزِيزُ الْغَفُورُ",
    ].join(" ");
    const r = alignRecitation(ayat(67, 1, 2), transcript);
    expect(flagged(r)).toEqual(["67:1:2:skipped", "67:2:5:skipped"]);
    expect(r.inserted).toEqual([]);
    expect(r.skippedAyahs).toEqual([]);
  });

  test("a word recited twice in a row in the text is skipped once", () => {
    // 67:3 has مِن twice; dropping the second (word 16) leaves ... هَلْ تَرَىٰ فُطُورٍ.
    const words = wordsOf(ayat(67, 3)[0]);
    const r = alignRecitation(ayat(67, 3), words.filter((_, k) => k !== 16).join(" "));
    expect(flagged(r)).toEqual(["67:3:16:skipped"]);
  });

  test("a whole skipped ayah is reported", () => {
    const expected = ayat(103, 1, 3);
    const transcript = [wordsOf(expected[0]), wordsOf(expected[2])].flat().join(" ");
    const r = alignRecitation(expected, transcript);
    expect(r.skippedAyahs).toEqual([{ surah: 103, ayah: 2 }]);
    expect(r.counts.skipped).toBe(4);
    expect(r.jumps).toEqual([]);
  });

  test("a different word in place of the text is a substitution", () => {
    // قَدِيرٌ → بَصِيرٌ at the end of 67:1 (word 8 after the Bismillah).
    const transcript = MULK_1_2_IMLAI[0].replace("قَدِيرٌ", "بَصِيرٌ");
    const r = alignRecitation(ayat(67, 1), transcript);
    expect(flagged(r)).toEqual(["67:1:8:substituted"]);
    expect(r.words.find((w) => w.status === "substituted")?.heard).toEqual([8]);
  });

  test("an extra word is inserted, not a mistake on the expected words", () => {
    const r = alignRecitation(ayat(112, 2), "اللَّهُ الْأَحَدُ الصَّمَدُ");
    expect(flagged(r)).toEqual([]);
    expect(r.inserted).toEqual([{ heard: 1, after: 0 }]);
  });

  test("an empty transcript skips everything", () => {
    const r = alignRecitation(ayat(112, 1, 4), "");
    expect(r.counts.skipped).toBe(r.counts.words);
    expect(r.skippedAyahs.map((a) => a.ayah)).toEqual([1, 2, 3, 4]);
    expect(r.heard).toEqual([]);
  });

  test("going back over words already recited is a repeat", () => {
    const words = wordsOf(ayat(67, 2)[0]);
    const transcript = [...words.slice(0, 8), ...words.slice(3, 8), ...words.slice(8)].join(" ");
    const r = alignRecitation(ayat(67, 2), transcript);
    expect(flagged(r)).toEqual([]);
    expect(r.jumps).toEqual([
      {
        kind: "repeat",
        heardStart: 8,
        heardEnd: 12,
        at: { surah: 67, ayah: 2 },
        start: { surah: 67, ayah: 2, word: 3 },
        end: { surah: 67, ayah: 2, word: 7 },
        matched: 5,
      },
    ]);
  });

  test("continuing with another ayah is a wrong-ayah jump; the words it replaced are skipped", () => {
    // 67:1, then the reciter goes on with 67:5 instead of 67:2.
    const expected = ayat(67, 1, 3);
    const transcript = [
      MULK_1_2_IMLAI[0],
      ...wordsOf(ayat(67, 5)[0]),
      ...wordsOf(expected[2]),
    ].join(" ");
    const r = alignRecitation(expected, transcript, { context: ayat(67, 1, 30) });
    expect(r.jumps).toEqual([
      {
        kind: "jump",
        heardStart: 9,
        heardEnd: 20,
        at: { surah: 67, ayah: 2 },
        start: { surah: 67, ayah: 5, word: 0 },
        end: { surah: 67, ayah: 5, word: 11 },
        matched: 12,
      },
    ]);
    expect(r.skippedAyahs).toEqual([{ surah: 67, ayah: 2 }]);
    expect(r.words.filter((w) => w.ayah === 2).every((w) => w.status === "skipped")).toBe(true);
    expect(r.words.filter((w) => w.ayah === 3).every((w) => w.status === "correct")).toBe(true);
  });

  test("a jump is only found in the text searched", () => {
    const expected = ayat(67, 1, 3);
    const transcript = [
      MULK_1_2_IMLAI[0],
      ...wordsOf(ayat(67, 5)[0]),
      ...wordsOf(expected[2]),
    ].join(" ");
    expect(alignRecitation(expected, transcript).jumps).toEqual([]);
  });

  test("rejects an invalid ayah or option", () => {
    expect(() => alignRecitation([{ surah: 112, ayah: 5, text: "x" }], "x")).toThrow(RangeError);
    expect(() => alignRecitation(ayat(112, 1), "x", { minJumpWords: 0 })).toThrow(RangeError);
  });
});

// A seeded generator, so the synthetic test is the same on every run.
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe("alignRecitation over the whole text", () => {
  test("every 7th ayah, recited exactly, has no mistake", () => {
    let words = 0;
    for (const [s, info] of SURAHS.entries()) {
      for (let a = 1; a <= info.ayahs; a += 7) {
        const expected = ayat(s + 1, a);
        const r = alignRecitation(expected, normalizeArabic(expected[0].text));
        expect(flagged(r)).toEqual([]);
        words += r.counts.words;
      }
    }
    expect(words).toBeGreaterThan(10_000);
  });

  test("synthetic skips and substitutions in 300 random ranges: skip recall >= 95%, false flags <= 1%", () => {
    const rnd = lcg(15);
    const allWords = SURAHS.flatMap((_, s) => surahAyahs(s + 1).flatMap((t) => quranWords(t)));
    let labelledSkips = 0;
    let found = 0;
    let clean = 0;
    let falseFlags = 0;
    for (let t = 0; t < 300; t++) {
      const surah = 1 + Math.floor(rnd() * SURAHS.length);
      const count = SURAHS[surah - 1].ayahs;
      const from = 1 + Math.floor(rnd() * count);
      const expected = ayat(surah, from, Math.min(count, from + Math.floor(rnd() * 4)));
      const skips = new Set<string>();
      const mistakes = new Set<string>();
      const heard: string[] = [];
      let previousMistake = false;
      for (const a of expected) {
        for (const [k, word] of wordsOf(a).entries()) {
          const key = `${a.surah}:${a.ayah}:${k}`;
          const roll: number = previousMistake ? 1 : rnd();
          previousMistake = roll < 0.08;
          if (roll < 0.06) {
            skips.add(key);
            mistakes.add(key);
          } else if (roll < 0.08) {
            const other = allWords[Math.floor(rnd() * allWords.length)];
            if (sameWord(normalizeArabic(other), normalizeArabic(word))) heard.push(word);
            else {
              heard.push(other);
              mistakes.add(key);
            }
          } else heard.push(word);
        }
      }
      const r = alignRecitation(expected, normalizeArabic(heard.join(" ")));
      for (const w of r.words) {
        if (w.bismillah) continue;
        const key = `${w.surah}:${w.ayah}:${w.word}`;
        if (skips.has(key)) {
          labelledSkips++;
          if (w.status === "skipped") found++;
        } else if (!mistakes.has(key)) {
          clean++;
          if (w.status === "skipped") falseFlags++;
        }
      }
    }
    expect(labelledSkips).toBeGreaterThan(50);
    expect(found / labelledSkips).toBeGreaterThanOrEqual(0.95);
    expect(falseFlags / clean).toBeLessThanOrEqual(0.01);
  });
});
