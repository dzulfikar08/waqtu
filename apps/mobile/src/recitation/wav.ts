/**
 * A RIFF/WAVE file of 16-bit little-endian PCM, the only audio whisper.rn reads from a file (it
 * resamples to 16 kHz and averages the channels itself).
 */
export function wavFile(
  chunks: readonly Uint8Array[],
  sampleRate: number,
  channels: number,
): Uint8Array {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) throw new RangeError("sampleRate");
  if (!Number.isInteger(channels) || channels <= 0) throw new RangeError("channels");
  let length = 0;
  for (const c of chunks) length += c.length;
  // A sample is two bytes: drop a stray odd byte rather than shift every later sample.
  length -= length % (2 * channels);
  const out = new Uint8Array(44 + length);
  const view = new DataView(out.buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, length, true);
  let at = 44;
  for (const c of chunks) {
    const n = Math.min(c.length, out.length - at);
    if (n <= 0) break;
    out.set(n === c.length ? c : c.subarray(0, n), at);
    at += n;
  }
  return out;
}

/** Seconds of audio in `bytes` of 16-bit PCM. */
export function pcmSeconds(bytes: number, sampleRate: number, channels: number): number {
  return sampleRate > 0 && channels > 0 ? bytes / (2 * channels * sampleRate) : 0;
}
