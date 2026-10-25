import { sha256 } from "@noble/hashes/sha2.js";

import { sha256Matches, toHex } from "./download";

/** Bytes hashed between progress reports and yields to the UI thread. */
export const HASH_CHUNK = 4 * 1024 * 1024;

/**
 * SHA-256 of a file read in chunks, so an 82 MB model never sits in memory whole. `read` returns
 * the next chunk (empty at the end of the file); `onProgress` gets the bytes hashed so far.
 * Resolves early with null when `isCancelled` turns true.
 */
export async function sha256OfChunks(
  read: (length: number) => Uint8Array,
  onProgress: (hashed: number) => void,
  isCancelled: () => boolean = () => false,
): Promise<string | null> {
  const hash = sha256.create();
  let hashed = 0;
  for (;;) {
    if (isCancelled()) return null;
    const chunk = read(HASH_CHUNK);
    if (chunk.length === 0) break;
    hash.update(chunk);
    hashed += chunk.length;
    onProgress(hashed);
    // Let the screen redraw the progress bar between chunks.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return toHex(hash.digest());
}

/** Whether a file read through `read` hashes to `expected`; null when cancelled. */
export async function verifySha256(
  read: (length: number) => Uint8Array,
  expected: string,
  onProgress: (hashed: number) => void,
  isCancelled?: () => boolean,
): Promise<boolean | null> {
  const actual = await sha256OfChunks(read, onProgress, isCancelled);
  return actual === null ? null : sha256Matches(actual, expected);
}
