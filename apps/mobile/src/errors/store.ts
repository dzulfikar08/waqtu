import type { SQLiteDatabase } from "expo-sqlite";

import { addToQueue, parseQueue, QUEUE_KEY, type ErrorEvent, type QueuedError } from "./report";

/**
 * The crash report queue in the device-local `settings` table. Synchronous on purpose: a fatal error
 * is written before React Native's default handler ends the app.
 */
export function readErrorQueue(db: SQLiteDatabase): QueuedError[] {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    QUEUE_KEY,
  );
  return parseQueue(row?.value ?? null);
}

export function writeErrorQueue(db: SQLiteDatabase, queue: readonly QueuedError[]): void {
  if (queue.length === 0) {
    db.runSync("DELETE FROM settings WHERE key = ?", QUEUE_KEY);
    return;
  }
  db.runSync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    QUEUE_KEY,
    JSON.stringify(queue),
  );
}

export function appendError(db: SQLiteDatabase, event: ErrorEvent, newId: () => string): void {
  writeErrorQueue(db, addToQueue(readErrorQueue(db), event, newId));
}
