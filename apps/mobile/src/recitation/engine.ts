import { initWhisper, type WhisperContext } from "whisper.rn/index";

import { transcriptOf } from "./check";
import { modelFile } from "./modelStore";
import { DECODE_OPTIONS, MODELS, type ModelId } from "./models";

/**
 * whisper.rn on the phone. One context is kept loaded (loading the 82 MB model takes a while) and
 * released when another model is used, the model is deleted, or the check panel closes.
 */
let loaded: { id: ModelId; context: Promise<WhisperContext> } | null = null;

function contextFor(id: ModelId): Promise<WhisperContext> {
  if (loaded?.id === id) return loaded.context;
  void releaseModel();
  const context = initWhisper({
    filePath: modelFile(MODELS[id]).uri,
    // No Core ML encoder is downloaded; Metal (iOS) is used when the device has it.
    useCoreMLIos: false,
  });
  loaded = { id, context };
  // A failed load must not stay cached.
  context.catch(() => {
    if (loaded?.context === context) loaded = null;
  });
  return context;
}

export async function releaseModel(): Promise<void> {
  const current = loaded;
  loaded = null;
  if (!current) return;
  try {
    await (await current.context).release();
  } catch {
    // Never loaded, or already released.
  }
}

export interface Transcription {
  text: string;
  /** Wall-clock seconds from loading the model to the result. */
  seconds: number;
}

/**
 * Transcribes a 16-bit PCM WAV file on the device with the decoding settings of `DECODE_OPTIONS`
 * (no network). `onProgress` gets 0–100. `stop` aborts; the promise then resolves with null.
 */
export function transcribe(
  id: ModelId,
  wavUri: string,
  onProgress: (percent: number) => void,
): { stop: () => void; promise: Promise<Transcription | null> } {
  let stopped = false;
  let stopNative: (() => Promise<void>) | null = null;
  const started = Date.now();
  const promise = (async () => {
    const context = await contextFor(id);
    if (stopped) return null;
    const job = context.transcribe(wavUri, { ...DECODE_OPTIONS, onProgress });
    stopNative = job.stop;
    const result = await job.promise;
    if (result.isAborted || stopped) return null;
    return { text: transcriptOf(result), seconds: (Date.now() - started) / 1000 };
  })();
  return {
    stop: () => {
      stopped = true;
      void stopNative?.().catch(() => {});
    },
    promise,
  };
}
