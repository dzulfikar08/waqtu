import type { SQLiteDatabase } from "expo-sqlite";

import {
  ENTITLEMENT_CACHE_KEY,
  parseCache,
  serializeCache,
  type CachedEntitlement,
  type Entitlement,
} from "./entitlement";

let cache: CachedEntitlement | null = null;
const listeners = new Set<() => void>();

export function getCachedEntitlement(): CachedEntitlement | null {
  return cache;
}

export function onPremiumChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: CachedEntitlement | null): void {
  cache = next;
  for (const listener of listeners) listener();
}

/**
 * Reads the stored entitlement into memory. The row is device-local: written with plain SQL so it
 * never turns the settings row dirty (it is not a synced setting and must not trigger a sync).
 */
export async function loadCachedEntitlement(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ENTITLEMENT_CACHE_KEY,
  );
  publish(parseCache(row?.value ?? null));
}

/** Remembers what the server said about `userId` and tells every `usePremium` consumer. */
export async function storeEntitlement(
  db: SQLiteDatabase,
  userId: string,
  entitlement: Entitlement,
): Promise<void> {
  const next: CachedEntitlement = { userId, entitlement, fetchedAt: Date.now() };
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ENTITLEMENT_CACHE_KEY,
    serializeCache(next),
  );
  publish(next);
}
