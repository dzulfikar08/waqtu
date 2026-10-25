/**
 * Speech models for the on-device recitation check (DEV-15, docs/recitation/model-evaluation.md).
 *
 * Both are Tarteel AI's Whisper fine-tunes on Quran recitation (`apache-2.0`), converted to ggml
 * q8_0 for whisper.cpp. Each URL pins a Hugging Face commit, and the file must hash to `sha256`
 * (checked on 2026-10-25 by downloading the file and reading its ggml header).
 *
 * The base conversion comes from `sadrapp`: `ram-a-dhan`'s base file declares a decoder context of
 * 1024 while its positional embedding has the standard 448 rows, so whisper.cpp refuses to load it
 * ("tensor 'decoder.positional_embedding' has wrong shape"). Its tiny file is consistent.
 */

export type ModelId = "base" | "tiny";

export interface RecitationModel {
  id: ModelId;
  /** File name in the app's model folder. */
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  /** The fine-tuned model the weights come from, and the repository of the ggml conversion. */
  upstream: string;
  conversion: string;
}

export const MODELS: Readonly<Record<ModelId, RecitationModel>> = {
  base: {
    id: "base",
    file: "whisper-base-ar-quran-q8_0.bin",
    url: "https://huggingface.co/sadrapp/whisper-base-ar-quran-ggml/resolve/fa7a13981ff68f2a1af37a33e2c35e1238d922d5/ggml-model-q8_0.bin",
    sha256: "72194195f7d280adebec57acf2c6e01e209484322ec1cec21c275a3c0b1e3d77",
    bytes: 81_768_585,
    upstream: "https://huggingface.co/tarteel-ai/whisper-base-ar-quran",
    conversion: "https://huggingface.co/sadrapp/whisper-base-ar-quran-ggml",
  },
  tiny: {
    id: "tiny",
    file: "whisper-tiny-ar-quran-q8_0.bin",
    url: "https://huggingface.co/ram-a-dhan/tarteel-whisper-quran-ggml/resolve/4a96d8bb5535a4b6e6f6abd5655b8711a95ae538/tarteel-ai-whisper-tiny-ar-quran-ggml-q8_0.bin",
    sha256: "ef01ab441b004f9e6f1ea98d397b43452b3a45efab7c3928ab37af655dde8b52",
    bytes: 43_537_433,
    upstream: "https://huggingface.co/tarteel-ai/whisper-tiny-ar-quran",
    conversion: "https://huggingface.co/ram-a-dhan/tarteel-whisper-quran-ggml",
  },
};

export const MODEL_IDS: readonly ModelId[] = ["base", "tiny"];
export const DEFAULT_MODEL: ModelId = "base";

export function isModelId(value: string | null): value is ModelId {
  return value === "base" || value === "tiny";
}

/**
 * whisper.rn decoding settings (doc, "Main risk for skip detection"): Arabic, greedy at
 * temperature 0 with no fallback to higher temperatures, no initial prompt, and no text carried
 * over from the previous 30 s window, so the decoder is not nudged into writing words the reciter
 * skipped. The same as `whisper-cli -l ar -tp 0 -tpi 0 -mc 0` for desktop runs of the harness.
 */
export const DECODE_OPTIONS = {
  language: "ar",
  translate: false,
  temperature: 0,
  temperatureInc: 0,
  maxContext: 0,
} as const;
