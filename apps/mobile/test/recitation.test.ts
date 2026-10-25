import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ayahIndex } from "@waqtu/core";

import { evaluate, loadManifest } from "../../../packages/core/scripts/recitation-eval";
import { unitBlocks, wordKeys } from "../src/hafalan/text";
import {
  checkId,
  checkRecitation,
  checkView,
  contextAyat,
  expectedAyat,
  manifestOf,
  parseRecords,
  rangeOf,
  transcriptOf,
  type CheckRecord,
} from "../src/recitation/check";
import { recitationCheckEnabled } from "../src/recitation/dev";
import {
  ABSENT,
  downloadFraction,
  downloadReducer,
  megabytes,
  networkWarning,
  sha256Matches,
  toHex,
  type DownloadEvent,
  type DownloadState,
} from "../src/recitation/download";
import { DECODE_OPTIONS, MODEL_IDS, MODELS } from "../src/recitation/models";
import { HASH_CHUNK, sha256OfChunks, verifySha256 } from "../src/recitation/verify";
import { pcmSeconds, wavFile } from "../src/recitation/wav";

const SIZE = 1000;
const run = (events: DownloadEvent[], from: DownloadState = ABSENT) =>
  events.reduce((s, e) => downloadReducer(s, e, SIZE), from);

describe("model download state machine", () => {
  test("download, verify, ready, delete", () => {
    let s = run([{ type: "start" }]);
    expect(s).toEqual({ status: "downloading", received: 0, total: SIZE });
    s = run([{ type: "progress", received: 400, total: SIZE }], s);
    expect(downloadFraction(s)).toBe(0.4);
    s = run([{ type: "downloaded" }], s);
    expect(s).toEqual({ status: "verifying", checked: 0, total: SIZE });
    s = run([{ type: "checked", checked: 500 }], s);
    expect(downloadFraction(s)).toBe(0.5);
    s = run([{ type: "verified" }], s);
    expect(s).toEqual({ status: "ready" });
    expect(downloadFraction(s)).toBeNull();
    expect(run([{ type: "deleted" }], s)).toEqual(ABSENT);
  });

  test("pause keeps the progress, start resumes from it", () => {
    const paused = run([
      { type: "start" },
      { type: "progress", received: 300, total: SIZE },
      { type: "paused" },
    ]);
    expect(paused).toEqual({ status: "paused", received: 300, total: SIZE });
    // A late progress report from the native task does not move a paused download.
    expect(run([{ type: "progress", received: 350, total: SIZE }], paused)).toBe(paused);
    expect(run([{ type: "start" }], paused)).toEqual({
      status: "downloading",
      received: 300,
      total: SIZE,
    });
  });

  test("cancel from downloading or paused goes back to absent; not from ready", () => {
    expect(run([{ type: "start" }, { type: "cancelled" }])).toEqual(ABSENT);
    expect(run([{ type: "start" }, { type: "paused" }, { type: "cancelled" }])).toEqual(ABSENT);
    const ready: DownloadState = { status: "ready" };
    expect(run([{ type: "cancelled" }], ready)).toBe(ready);
  });

  test("checksum mismatch and errors fail; start retries from zero", () => {
    const bad = run([{ type: "start" }, { type: "downloaded" }, { type: "mismatch" }]);
    expect(bad).toEqual({ status: "failed", error: "checksum" });
    expect(run([{ type: "start" }], bad)).toEqual({
      status: "downloading",
      received: 0,
      total: SIZE,
    });
    expect(run([{ type: "start" }, { type: "error", error: "network" }])).toEqual({
      status: "failed",
      error: "network",
    });
    expect(
      run([{ type: "start" }, { type: "downloaded" }, { type: "error", error: "storage" }]),
    ).toEqual({ status: "failed", error: "storage" });
  });

  test("events out of order are ignored", () => {
    const ready: DownloadState = { status: "ready" };
    for (const e of [
      { type: "start" },
      { type: "progress", received: 1, total: 2 },
      { type: "paused" },
      { type: "downloaded" },
      { type: "mismatch" },
      { type: "error", error: "network" },
    ] satisfies DownloadEvent[])
      expect(run([e], ready)).toBe(ready);
    // `verified` only counts after a download was checked.
    expect(run([{ type: "verified" }])).toEqual(ABSENT);
    // A second start while downloading changes nothing.
    const s = run([{ type: "start" }, { type: "progress", received: 10, total: SIZE }]);
    expect(run([{ type: "start" }], s)).toBe(s);
  });

  test("unknown server size keeps the expected one; restore replaces the state", () => {
    const s = run([{ type: "start" }, { type: "progress", received: 10, total: -1 }]);
    expect(s).toEqual({ status: "downloading", received: 10, total: SIZE });
    expect(run([{ type: "restored", state: { status: "ready" } }], s)).toEqual({ status: "ready" });
  });

  test("Wi-Fi warning", () => {
    expect(networkWarning({ type: "WIFI", isConnected: true })).toBeNull();
    expect(networkWarning({ type: "ETHERNET", isConnected: true })).toBeNull();
    expect(networkWarning({ type: "CELLULAR", isConnected: true })).toBe("metered");
    expect(networkWarning({ type: "UNKNOWN", isConnected: true })).toBe("metered");
    expect(networkWarning({ type: "VPN" })).toBe("metered");
    expect(networkWarning({ type: "NONE", isConnected: false })).toBe("offline");
    expect(networkWarning({ type: "WIFI", isConnected: false })).toBe("offline");
  });

  test("megabytes as Hugging Face counts them", () => {
    expect(megabytes(MODELS.base.bytes)).toBe(82);
    expect(megabytes(MODELS.tiny.bytes)).toBe(44);
  });
});

describe("SHA-256 check", () => {
  const reader = (data: Uint8Array) => {
    let at = 0;
    return (length: number) => {
      const out = data.subarray(at, Math.min(data.length, at + length));
      at += out.length;
      return out;
    };
  };
  // Three chunks and a bit, so the incremental hash crosses chunk edges.
  const data = new Uint8Array(HASH_CHUNK * 3 + 12345);
  for (let i = 0; i < data.length; i++) data[i] = (i * 2654435761) >>> 24;
  const expected = createHash("sha256").update(data).digest("hex");

  test("chunked hash equals the one-shot hash, with progress", async () => {
    const progress: number[] = [];
    expect(await sha256OfChunks(reader(data), (n) => progress.push(n))).toBe(expected);
    expect(progress).toEqual([HASH_CHUNK, 2 * HASH_CHUNK, 3 * HASH_CHUNK, data.length]);
  });

  test("verify accepts the right digest in either case and rejects any other", async () => {
    expect(await verifySha256(reader(data), expected.toUpperCase(), () => {})).toBe(true);
    const tampered = data.slice();
    tampered[HASH_CHUNK + 1] ^= 1;
    expect(await verifySha256(reader(tampered), expected, () => {})).toBe(false);
    expect(await verifySha256(reader(new Uint8Array(0)), expected, () => {})).toBe(false);
  });

  test("cancel stops before the end", async () => {
    let calls = 0;
    expect(
      await verifySha256(
        reader(data),
        expected,
        () => calls++,
        () => calls >= 1,
      ),
    ).toBeNull();
    expect(calls).toBe(1);
  });

  test("hex and digest comparison", () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
    const empty = createHash("sha256").update("").digest("hex");
    expect(sha256Matches(empty, empty.toUpperCase())).toBe(true);
    expect(sha256Matches(empty, "abc")).toBe(false);
    expect(sha256Matches("", "")).toBe(false);
  });

  test("models are pinned: commit in the URL, 64-hex digest, apache-2.0 upstream", () => {
    for (const id of MODEL_IDS) {
      const m = MODELS[id];
      expect(m.url).toMatch(
        /^https:\/\/huggingface\.co\/[\w-]+\/[\w.-]+\/resolve\/[0-9a-f]{40}\/[\w.-]+\.bin$/,
      );
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.upstream).toMatch(
        /^https:\/\/huggingface\.co\/tarteel-ai\/whisper-(base|tiny)-ar-quran$/,
      );
      expect(m.url.startsWith(`${m.conversion}/resolve/`)).toBe(true);
    }
    expect(MODELS.base.sha256).toBe(
      "72194195f7d280adebec57acf2c6e01e209484322ec1cec21c275a3c0b1e3d77",
    );
  });

  test("decoding settings: Arabic, temperature 0 without fallback, no prompt, no carried context", () => {
    expect(DECODE_OPTIONS).toEqual({
      language: "ar",
      translate: false,
      temperature: 0,
      temperatureInc: 0,
      maxContext: 0,
    });
    expect("prompt" in DECODE_OPTIONS).toBe(false);
  });
});

describe("WAV for whisper.rn", () => {
  test("header and samples", () => {
    const wav = wavFile([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])], 16_000, 1);
    const view = new DataView(wav.buffer);
    const ascii = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(view.getUint32(4, true)).toBe(36 + 4);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    // Five bytes are two whole samples; the odd byte is dropped.
    expect(view.getUint32(40, true)).toBe(4);
    expect([...wav.subarray(44)]).toEqual([1, 2, 3, 4]);
  });

  test("stereo frames and duration", () => {
    const wav = wavFile([new Uint8Array(4 * 48_000)], 48_000, 2);
    expect(new DataView(wav.buffer).getUint32(28, true)).toBe(48_000 * 4);
    expect(pcmSeconds(4 * 48_000, 48_000, 2)).toBe(1);
    expect(pcmSeconds(32_000, 16_000, 1)).toBe(1);
    expect(() => wavFile([], 0, 1)).toThrow();
  });
});

// Real whisper.cpp output of the pinned base model (see the fixture's `source`).
const whisper = JSON.parse(
  readFileSync(new URL("./fixtures/recitation/whisper-mulk.json", import.meta.url), "utf8"),
) as {
  recordings: Record<string, { result: string; segments: { text: string }[] }>;
};
const MULK_1_3 = { start: ayahIndex(67, 1), end: ayahIndex(67, 3) };

describe("transcript to alignment to UnitText", () => {
  test("segments are joined with a space, not glued", () => {
    expect(transcriptOf({ result: "ab", segments: [{ text: " a" }, { text: "b " }] })).toBe("a b");
    expect(transcriptOf({ result: " only ", segments: [] })).toBe("only");
  });

  test("a clean recitation flags nothing", () => {
    const view = checkView(checkRecitation(MULK_1_3, transcriptOf(whisper.recordings["mulk-1-3"])));
    expect(view.counts).toMatchObject({ skipped: 0, substituted: 0 });
    expect(view.counts.correct).toBe(view.counts.words);
    expect(view.words.size).toBe(0);
    expect(view.jumps).toEqual([]);
  });

  test("a skipped ayah is flagged word by word, on the keys UnitText draws", () => {
    const alignment = checkRecitation(
      MULK_1_3,
      transcriptOf(whisper.recordings["mulk-1-3-without-2"]),
    );
    const view = checkView(alignment);
    const keys = new Set(wordKeys(unitBlocks(MULK_1_3)));
    const ayah2 = unitBlocks(MULK_1_3)[0].ayahs[1];
    expect([...view.words.keys()].sort()).toEqual(
      ayah2.words.map((_, i) => `${ayah2.index}:${i}`).sort(),
    );
    for (const [key, flag] of view.words) {
      expect(keys.has(key)).toBe(true);
      expect(flag).toBe("skipped");
    }
    expect(view.counts.skipped).toBe(ayah2.words.length);
    expect(alignment.skippedAyahs).toEqual([{ surah: 67, ayah: 2 }]);
  });

  test("a replaced word is flagged as substituted; the Bismillah heading never is", () => {
    const text = expectedAyat(MULK_1_3)
      .map((a) => a.text)
      .join(" ")
      .replace("ٱلْمُلْكُ", "ٱلْحَمْدُ");
    const view = checkView(checkRecitation(MULK_1_3, text));
    const ayah1 = ayahIndex(67, 1);
    expect([...view.words]).toEqual([[`${ayah1}:3`, "substituted"]]);
    // Tanzil stores the Bismillah before 67:1; without it in the transcript nothing is flagged.
    const plain = checkView(checkRecitation(MULK_1_3, text.replace(/^.*?ٱلرَّحِيمِ /, "")));
    expect([...plain.words.keys()]).toEqual([`${ayah1}:3`]);
  });

  test("a wrong-ayah jump marks the ayah and names where the words came from", () => {
    const [a1, , a3] = expectedAyat(MULK_1_3);
    const a5 = contextAyat(MULK_1_3).find((a) => a.ayah === 5);
    if (!a5) throw new Error("67:5 missing");
    // Ayah 1, then (instead of ayah 2) the opening of ayah 5, then ayah 3.
    const fiveWords = a5.text.split(" ").slice(0, 6).join(" ");
    const view = checkView(checkRecitation(MULK_1_3, `${a1.text} ${fiveWords} ${a3.text}`));
    expect(view.jumps).toEqual([{ at: { surah: 67, ayah: 2 }, from: { surah: 67, ayah: 5 } }]);
    expect([...view.jumpAyahs]).toEqual([ayahIndex(67, 2)]);
    expect(view.counts.skipped).toBeGreaterThan(0);
  });

  test("ranges in the harness format", () => {
    expect(rangeOf(MULK_1_3)).toBe("67:1-67:3");
    expect(rangeOf({ start: ayahIndex(67, 3), end: ayahIndex(67, 3) })).toBe("67:3");
    expect(rangeOf({ start: ayahIndex(113, 5), end: ayahIndex(114, 2) })).toBe("113:5-114:2");
    expect(contextAyat({ start: ayahIndex(113, 5), end: ayahIndex(114, 2) })).toHaveLength(5 + 6);
  });
});

describe("manifest export", () => {
  const records: CheckRecord[] = [
    {
      id: checkId(4, new Date("2026-10-25T08:30:05.123Z")),
      unit: 4,
      range: rangeOf(MULK_1_3),
      text: transcriptOf(whisper.recordings["mulk-1-3"]),
      model: "base",
      seconds: 60,
      recordedAt: "2026-10-25T08:30:05.123Z",
      transcribeSeconds: 12.5,
    },
    {
      id: checkId(4, new Date("2026-10-25T08:35:00.000Z")),
      unit: 4,
      range: rangeOf(MULK_1_3),
      text: transcriptOf(whisper.recordings["mulk-1-3-without-2"]),
      model: "tiny",
      seconds: 40,
      recordedAt: "2026-10-25T08:35:00.000Z",
      transcribeSeconds: 6,
    },
  ];

  test("ids are stable and unique per recording", () => {
    expect(records[0].id).toBe("unit-4-20261025T083005Z");
    expect(records[1].id).not.toBe(records[0].id);
  });

  test("the harness loads the export and evaluates it once labelled", () => {
    const dir = mkdtempSync(join(tmpdir(), "waqtu-manifest-"));
    try {
      const manifest = manifestOf(records);
      const path = join(dir, "manifest.json");
      writeFileSync(path, JSON.stringify(manifest));
      const loaded = loadManifest(path);
      expect(loaded.map((r) => [r.id, r.range, r.text, r.mistakes])).toEqual(
        records.map((r) => [r.id, r.range, r.text, []]),
      );

      // A labeller listens and adds the mistake; the harness then scores the check.
      manifest.recitations[1].mistakes.push({ type: "skip", at: "67:2" });
      writeFileSync(path, JSON.stringify(manifest));
      const report = evaluate(loadManifest(path));
      expect(report.total.recitations).toBe(2);
      expect(report.total.labelledSkips).toBeGreaterThan(0);
      expect(report.total.detectedSkips).toBe(report.total.labelledSkips);
      expect(report.skipRecall).toBe(1);
      expect(report.falseFlagRate).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stored records survive a round trip; malformed ones are dropped", () => {
    expect(parseRecords(JSON.parse(JSON.stringify(records)))).toEqual(records);
    expect(
      parseRecords([
        ...records,
        records[0],
        { ...records[0], id: "x", model: "large" },
        { ...records[0], id: "y", seconds: "60" },
        null,
        "text",
      ]),
    ).toEqual(records);
    expect(parseRecords({ recitations: [] })).toEqual([]);
  });
});

describe("developer switch", () => {
  test("off in release builds until switched on; on in development builds until switched off", () => {
    expect(recitationCheckEnabled(null, false)).toBe(false);
    expect(recitationCheckEnabled("1", false)).toBe(true);
    expect(recitationCheckEnabled(null, true)).toBe(true);
    expect(recitationCheckEnabled("0", true)).toBe(false);
  });
});
