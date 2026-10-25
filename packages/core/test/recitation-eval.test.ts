import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import {
  evaluate,
  formatReport,
  loadManifest,
  parseRange,
  parseRef,
  transcriptText,
} from "../scripts/recitation-eval";

const MANIFEST = new URL("fixtures/recitation/manifest.json", import.meta.url).pathname;

describe("recitation eval harness", () => {
  test("parses references and ranges", () => {
    expect(parseRef("67:2")).toEqual({ surah: 67, ayah: 2 });
    expect(parseRef(" 67:2:6 ")).toEqual({ surah: 67, ayah: 2, word: 6 });
    expect(() => parseRef("67:31")).toThrow();
    expect(() => parseRef("115:1")).toThrow(RangeError);
    expect(parseRange("112:1-4").map((a) => `${a.surah}:${a.ayah}`)).toEqual([
      "112:1",
      "112:2",
      "112:3",
      "112:4",
    ]);
    expect(parseRange("113:5-114:2").map((a) => `${a.surah}:${a.ayah}`)).toEqual([
      "113:5",
      "114:1",
      "114:2",
    ]);
    expect(parseRange("103:2")).toHaveLength(1);
    expect(() => parseRange("103:3-1")).toThrow();
  });

  test("reads whisper.rn results, { text } and segments", () => {
    expect(
      transcriptText({ result: " قل هو", segments: [], language: "ar", isAborted: false }),
    ).toBe(" قل هو");
    expect(transcriptText({ text: "قل" })).toBe("قل");
    expect(transcriptText({ segments: [{ text: "قل" }, { text: "هو" }] })).toBe("قل هو");
    expect(() => transcriptText({ words: [] })).toThrow();
  });

  test("scores the fixture set: every labelled mistake found, no false flag, too few recitations", () => {
    const report = evaluate(loadManifest(MANIFEST));
    expect(report.total).toMatchObject({
      recitations: 4,
      words: 96,
      labelledSkips: 17,
      detectedSkips: 17,
      labelledSubstitutions: 1,
      detectedSubstitutions: 1,
      cleanWords: 78,
      falseSkipFlags: 0,
      falseSubstitutionFlags: 0,
      labelledJumps: 1,
      detectedJumps: 1,
      extraJumps: 0,
    });
    expect(report.skipRecall).toBe(1);
    expect(report.falseFlagRate).toBe(0);
    expect(report.pass).toBe(false);
    expect(report.failures).toEqual(["4 recitations, need 50"]);
    expect(formatReport(report)).toContain("skipped-word recall: 100.0% (17/17");
  });

  test("a missed skip lowers recall and an unlabelled skip is a false flag", () => {
    const dir = mkdtempSync(join(tmpdir(), "recitation-eval-"));
    const path = join(dir, "manifest.json");
    writeFileSync(
      path,
      JSON.stringify({
        recitations: [
          {
            id: "ikhlas",
            // 112:3 recited in full although labelled as skipped; 112:2 word 2 missing, unlabelled.
            text: "قُلْ هُوَ اللَّهُ أَحَدٌ اللَّهُ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
            range: "112:1-112:4",
            mistakes: [{ type: "skip", at: "112:3:1" }],
          },
        ],
      }),
    );
    const report = evaluate(loadManifest(path));
    expect(report.total).toMatchObject({ labelledSkips: 1, detectedSkips: 0, falseSkipFlags: 1 });
    expect(report.skipRecall).toBe(0);
    expect(report.falseFlagRate).toBeCloseTo(1 / 14);
  });

  test("rejects malformed manifests and labels outside the range", () => {
    const dir = mkdtempSync(join(tmpdir(), "recitation-eval-"));
    const write = (data: unknown) => {
      const path = join(dir, `m${Math.random()}.json`);
      writeFileSync(path, JSON.stringify(data));
      return path;
    };
    expect(() => loadManifest(write({}))).toThrow("recitations");
    expect(() => loadManifest(write({ recitations: [{ id: "a", range: "1:1" }] }))).toThrow(
      "exactly one",
    );
    expect(() =>
      loadManifest(
        write({
          recitations: [
            { id: "a", text: "x", range: "1:1", mistakes: [{ type: "tajweed", at: "1:1" }] },
          ],
        }),
      ),
    ).toThrow("unknown type");
    const report = evaluate(
      loadManifest(
        write({
          recitations: [
            { id: "a", text: "x", range: "112:1", mistakes: [{ type: "skip", at: "112:2:1" }] },
          ],
        }),
      ),
    );
    expect(report.failures).toContain("a: skip at 112:2:1 is not a word of 112:1");
  });
});
