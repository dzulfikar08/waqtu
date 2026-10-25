/**
 * Model download as a state machine, kept free of native code so it can be tested: the file layer
 * (`modelStore.ts`) reports what happened as events, the screen renders the state.
 *
 *   absent ─start→ downloading ─downloaded→ verifying ─verified→ ready ─deleted→ absent
 *                    │  ↑ start                 └─mismatch→ failed(checksum)
 *                    paused ─cancelled→ absent
 *   downloading ─error→ failed ─start→ downloading
 *
 * Events that do not fit the current state (a late progress report after a pause, a second
 * `start`) leave it unchanged.
 */

export type DownloadError = "network" | "checksum" | "storage";

export type DownloadState =
  | { status: "absent" }
  | { status: "downloading"; received: number; total: number }
  | { status: "paused"; received: number; total: number }
  | { status: "verifying"; checked: number; total: number }
  | { status: "ready" }
  | { status: "failed"; error: DownloadError };

export type DownloadEvent =
  /** What is on disk at launch: a verified file, a paused download, or nothing. */
  | { type: "restored"; state: DownloadState }
  | { type: "start" }
  | { type: "progress"; received: number; total: number }
  | { type: "paused" }
  | { type: "cancelled" }
  | { type: "downloaded" }
  | { type: "checked"; checked: number }
  | { type: "verified" }
  | { type: "mismatch" }
  | { type: "error"; error: Exclude<DownloadError, "checksum"> }
  | { type: "deleted" };

export const ABSENT: DownloadState = { status: "absent" };

/** `expected` is the model's size, used until the server reports a total. */
export function downloadReducer(
  state: DownloadState,
  event: DownloadEvent,
  expected: number,
): DownloadState {
  switch (event.type) {
    case "restored":
      return event.state;
    case "start":
      if (state.status === "absent" || state.status === "failed")
        return { status: "downloading", received: 0, total: expected };
      if (state.status === "paused") return { ...state, status: "downloading" };
      return state;
    case "progress":
      if (state.status !== "downloading") return state;
      return {
        status: "downloading",
        received: Math.max(0, event.received),
        total: event.total > 0 ? event.total : state.total,
      };
    case "paused":
      return state.status === "downloading" ? { ...state, status: "paused" } : state;
    case "cancelled":
      return state.status === "downloading" || state.status === "paused" ? ABSENT : state;
    case "downloaded":
      return state.status === "downloading"
        ? { status: "verifying", checked: 0, total: expected }
        : state;
    case "checked":
      return state.status === "verifying" ? { ...state, checked: event.checked } : state;
    case "verified":
      return state.status === "verifying" ? { status: "ready" } : state;
    case "mismatch":
      return state.status === "verifying" ? { status: "failed", error: "checksum" } : state;
    case "error":
      return state.status === "downloading" || state.status === "verifying"
        ? { status: "failed", error: event.error }
        : state;
    case "deleted":
      return ABSENT;
  }
}

/** Share of the current step that is done, 0–1; null when there is no step in progress. */
export function downloadFraction(state: DownloadState): number | null {
  if (state.status === "downloading" || state.status === "paused")
    return state.total > 0 ? Math.min(1, state.received / state.total) : 0;
  if (state.status === "verifying")
    return state.total > 0 ? Math.min(1, state.checked / state.total) : 0;
  return null;
}

export type NetworkWarning = "offline" | "metered" | null;

/**
 * Before a download, from expo-network's state (`NetworkStateType` values are these strings):
 * `offline` stops it, `metered` asks first (anything but Wi-Fi or Ethernet, an unknown type
 * included, may be a mobile data plan), null goes ahead.
 */
export function networkWarning(network: { type?: string; isConnected?: boolean }): NetworkWarning {
  if (network.isConnected === false || network.type === "NONE") return "offline";
  return network.type === "WIFI" || network.type === "ETHERNET" ? null : "metered";
}

/** Lower-case hex of a digest. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function sha256Matches(actualHex: string, expectedHex: string): boolean {
  return (
    /^[0-9a-f]{64}$/i.test(expectedHex) && actualHex.toLowerCase() === expectedHex.toLowerCase()
  );
}

/** Whole megabytes (10^6 bytes, as the stores and Hugging Face count them). */
export function megabytes(bytes: number): number {
  return Math.round(bytes / 1_000_000);
}
