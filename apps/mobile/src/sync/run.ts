import type { SQLiteDatabase } from "expo-sqlite";

import { emitDataChanged } from "../db/events";
import { runSync } from "../mutabaah/syncEngine";
import { API_URL } from "../auth/config";
import type { AuthClient } from "../auth/client";
import { createSqliteStore, prepareAccount } from "./sqliteStore";
import { createTransport, isUnauthorized } from "./transport";

/** Foreground syncs closer together than this are skipped. */
const MIN_INTERVAL_MS = 30_000;

export type SyncStatus = "idle" | "syncing" | "ok" | "error";

let status: SyncStatus = "idle";
let lastSyncAt: number | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SyncStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
}

export function getSyncState(): SyncState {
  return { status, lastSyncAt };
}

export function onSyncState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One sync pass for the signed-in user. Concurrent calls share the running pass; `force` skips the
 * minimum interval (manual "Sync now"). Never throws: failures show as `error` and retry next time.
 */
export function syncNow(
  db: SQLiteDatabase,
  client: AuthClient,
  userId: string,
  force = false,
): Promise<void> {
  if (!API_URL) return Promise.resolve();
  if (inFlight) return inFlight;
  if (!force && lastSyncAt !== null && Date.now() - lastSyncAt < MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  const url = API_URL;
  set("syncing");
  inFlight = (async () => {
    try {
      await prepareAccount(db, userId);
      const report = await runSync(
        createSqliteStore(db, userId),
        createTransport(url, () => client.getCookie()),
      );
      lastSyncAt = Date.now();
      set("ok");
      if (report.pulled > 0) emitDataChanged();
    } catch (e) {
      // A rejected session ends in a sign-in prompt in Settings, not a retry loop.
      set(isUnauthorized(e) ? "idle" : "error");
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
