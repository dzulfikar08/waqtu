import { chunk, entryWins, settingWins, type SyncEntry, type SyncSetting } from "./merge";

export const PUSH_ENTRIES = 500;
export const PUSH_SETTINGS = 100;
export const PULL_LIMIT = 500;

export interface PullPage {
  entries: SyncEntry[];
  settings: SyncSetting[];
  cursor: string;
  hasMore: boolean;
}

export interface SyncTransport {
  pull(since: string, limit: number): Promise<PullPage>;
  push(entries: SyncEntry[], settings: SyncSetting[]): Promise<void>;
}

/** Local storage the engine syncs. Rows written by the user are `dirty` until the server has them. */
export interface SyncStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  getCursor(): Promise<string>;
  setCursor(cursor: string): Promise<void>;
  getEntry(date: string, itemId: string): Promise<SyncEntry | undefined>;
  getSetting(key: string): Promise<SyncSetting | undefined>;
  /** Stores a row that came from the server (clean). */
  putRemoteEntry(entry: SyncEntry): Promise<void>;
  putRemoteSetting(setting: SyncSetting): Promise<void>;
  dirtyEntries(): Promise<SyncEntry[]>;
  dirtySettings(): Promise<SyncSetting[]>;
  /** Clears `dirty` only for rows still at the pushed `updatedAt`, so an edit made mid-sync stays queued. */
  markEntriesClean(entries: readonly SyncEntry[]): Promise<void>;
  markSettingsClean(settings: readonly SyncSetting[]): Promise<void>;
}

export interface SyncReport {
  pulled: number;
  pushed: number;
}

/**
 * Pull everything since the stored cursor (merging last-write-wins), then push local changes.
 * Pull first, so a stale local edit loses to a newer remote one before it is ever sent. Safe to
 * run twice in a row: the second run pushes nothing.
 */
export async function runSync(store: SyncStore, transport: SyncTransport): Promise<SyncReport> {
  let pulled = 0;
  let cursor = await store.getCursor();
  for (;;) {
    const page = await transport.pull(cursor, PULL_LIMIT);
    await store.transaction(async () => {
      for (const incoming of page.entries) {
        const current = await store.getEntry(incoming.date, incoming.itemId);
        if (entryWins(incoming, current)) {
          await store.putRemoteEntry(incoming);
          pulled++;
        }
      }
      for (const incoming of page.settings) {
        const current = await store.getSetting(incoming.key);
        if (settingWins(incoming, current)) {
          await store.putRemoteSetting(incoming);
          pulled++;
        }
      }
      await store.setCursor(page.cursor);
    });
    // A server that claims more but does not advance would loop forever.
    if (!page.hasMore || page.cursor === cursor) break;
    cursor = page.cursor;
  }

  let pushed = 0;
  const entries = chunk(await store.dirtyEntries(), PUSH_ENTRIES);
  const settings = chunk(await store.dirtySettings(), PUSH_SETTINGS);
  const rounds = Math.max(entries.length, settings.length);
  for (let i = 0; i < rounds; i++) {
    const e = entries[i] ?? [];
    const s = settings[i] ?? [];
    await transport.push(e, s);
    await store.markEntriesClean(e);
    await store.markSettingsClean(s);
    pushed += e.length + s.length;
  }
  return { pulled, pushed };
}
