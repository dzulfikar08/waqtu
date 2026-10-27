import type { SQLiteDatabase } from "expo-sqlite";

import type { AuthClient } from "../auth/client";
import { API_URL } from "../auth/config";
import { emitDataChanged } from "../db/events";
import { chunk } from "../mutabaah/merge";
import type { SqlDb } from "../sync/sqliteStore";
import { isUnauthorized } from "../sync/transport";
import { createMuhasabahTransport } from "./cloudTransport";
import { cleanRating, cleanText } from "./muhasabah";

/**
 * Opt-in cloud sync of the muhasabah journal. The journal is local-only until the user turns it on in Settings; the
 * switch belongs to one account on one device (`CLOUD_USER_KEY` holds the user id), so a different account signing in
 * finds it off. Whole-entry last-write-wins per day over `/v1/muhasabah`; a deletion travels as a tombstone.
 */

/** Settings keys. Neither is a synced setting (mutabaah/syncKeys.ts), so the mutabaah sync never uploads them. */
export const CLOUD_USER_KEY = "muhasabah.cloud.user";
export const CLOUD_CURSOR_KEY = "muhasabah.cloud.cursor";

export const PUSH_CHUNK = 20;
export const PULL_LIMIT = 100;

/** Foreground syncs closer together than this are skipped. */
const MIN_INTERVAL_MS = 30_000;

export interface WireFields {
  feelings?: string;
  newAction?: string;
  taqwa?: number;
  gratitude?: number;
  energy?: number;
  willingness?: number;
  continueTomorrow?: string;
}

/** `entry: null` is a tombstone: the day was deleted. */
export interface WireEntry {
  date: string;
  updatedAt: number;
  entry: WireFields | null;
}

export interface PullPage {
  entries: WireEntry[];
  cursor: string;
  hasMore: boolean;
}

export interface MuhasabahTransport {
  pull(since: string, limit: number): Promise<PullPage>;
  push(entries: WireEntry[]): Promise<void>;
}

/** Local storage the engine syncs; days the user wrote are `dirty` until the server has them. */
export interface MuhasabahStore {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  getCursor(): Promise<string>;
  setCursor(cursor: string): Promise<void>;
  /** `updated_at` of the day's row, a tombstone included; undefined when the day was never stored. */
  getUpdatedAt(date: string): Promise<number | undefined>;
  /** Stores a day that came from the server (clean). */
  putRemote(entry: WireEntry): Promise<void>;
  dirty(): Promise<WireEntry[]>;
  /** Clears `dirty` only for rows still at the pushed `updatedAt`, so an edit made mid-sync stays queued. */
  markClean(entries: readonly WireEntry[]): Promise<void>;
}

export interface MuhasabahSyncReport {
  pulled: number;
  pushed: number;
}

/**
 * Pull everything since the stored cursor, then push local changes in chunks of 20. A pulled day replaces the local
 * one only when strictly newer: on an equal timestamp the local row stays (a rare limitation of last-write-wins).
 * Pull first, so a stale local edit loses to a newer remote one before it is ever sent.
 */
export async function runMuhasabahSync(
  store: MuhasabahStore,
  transport: MuhasabahTransport,
): Promise<MuhasabahSyncReport> {
  let pulled = 0;
  let cursor = await store.getCursor();
  for (;;) {
    const page = await transport.pull(cursor, PULL_LIMIT);
    await store.transaction(async () => {
      for (const incoming of page.entries) {
        const current = await store.getUpdatedAt(incoming.date);
        if (current === undefined || incoming.updatedAt > current) {
          await store.putRemote(incoming);
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
  for (const batch of chunk(await store.dirty(), PUSH_CHUNK)) {
    await transport.push(batch);
    await store.markClean(batch);
    pushed += batch.length;
  }
  return { pulled, pushed };
}

interface Row {
  date: string;
  feelings: string | null;
  new_action: string | null;
  taqwa: number | null;
  gratitude: number | null;
  energy: number | null;
  willingness: number | null;
  continue_tomorrow: string | null;
  updated_at: number;
  deleted: number;
}

const ROW_COLUMNS =
  "date, feelings, new_action, taqwa, gratitude, energy, willingness, continue_tomorrow, updated_at, deleted";

/** The wire form of a row: absent keys mean null, and a day with nothing left is a tombstone. */
function toWire(row: Row): WireEntry {
  const fields: WireFields = {};
  if (row.feelings !== null) fields.feelings = row.feelings;
  if (row.new_action !== null) fields.newAction = row.new_action;
  if (row.taqwa !== null) fields.taqwa = row.taqwa;
  if (row.gratitude !== null) fields.gratitude = row.gratitude;
  if (row.energy !== null) fields.energy = row.energy;
  if (row.willingness !== null) fields.willingness = row.willingness;
  if (row.continue_tomorrow !== null) fields.continueTomorrow = row.continue_tomorrow;
  const empty = row.deleted === 1 || Object.keys(fields).length === 0;
  return { date: row.date, updatedAt: row.updated_at, entry: empty ? null : fields };
}

/** Pulled fields the journal cannot hold are dropped (the table refuses ratings outside 1–10); nothing left is a tombstone. */
function cleanWire(entry: WireFields | null): WireFields | null {
  if (!entry) return null;
  const fields: WireFields = {};
  for (const key of ["feelings", "newAction", "continueTomorrow"] as const) {
    const value = entry[key];
    if (typeof value === "string" && cleanText(value) !== null) fields[key] = value;
  }
  for (const key of ["taqwa", "gratitude", "energy", "willingness"] as const) {
    const value = cleanRating(entry[key]);
    if (value !== null) fields[key] = value;
  }
  return Object.keys(fields).length === 0 ? null : fields;
}

/** SQLite replica for the engine. Server rows are stored clean; the user's own writes stay `dirty`. */
export function createMuhasabahStore(db: SqlDb): MuhasabahStore {
  return {
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
    async getCursor() {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        CLOUD_CURSOR_KEY,
      );
      return row?.value ?? "0";
    },
    async setCursor(cursor) {
      await putSetting(db, CLOUD_CURSOR_KEY, cursor);
    },
    async getUpdatedAt(date) {
      const row = await db.getFirstAsync<{ updated_at: number }>(
        "SELECT updated_at FROM muhasabah WHERE date = ?",
        date,
      );
      return row?.updated_at;
    },
    async putRemote(incoming) {
      const fields = cleanWire(incoming.entry);
      await db.runAsync(
        `INSERT INTO muhasabah
           (date, feelings, new_action, taqwa, gratitude, energy, willingness, continue_tomorrow, created_at, updated_at, dirty, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(date) DO UPDATE SET
           feelings = excluded.feelings,
           new_action = excluded.new_action,
           taqwa = excluded.taqwa,
           gratitude = excluded.gratitude,
           energy = excluded.energy,
           willingness = excluded.willingness,
           continue_tomorrow = excluded.continue_tomorrow,
           updated_at = excluded.updated_at,
           dirty = 0,
           deleted = excluded.deleted`,
        incoming.date,
        fields?.feelings ?? null,
        fields?.newAction ?? null,
        fields?.taqwa ?? null,
        fields?.gratitude ?? null,
        fields?.energy ?? null,
        fields?.willingness ?? null,
        fields?.continueTomorrow ?? null,
        incoming.updatedAt,
        incoming.updatedAt,
        fields ? 0 : 1,
      );
    },
    async dirty() {
      const rows = await db.getAllAsync<Row>(
        `SELECT ${ROW_COLUMNS} FROM muhasabah WHERE dirty = 1 ORDER BY updated_at, date`,
      );
      return rows.map(toWire);
    },
    async markClean(entries) {
      await db.withTransactionAsync(async () => {
        for (const e of entries) {
          await db.runAsync(
            "UPDATE muhasabah SET dirty = 0 WHERE date = ? AND updated_at = ?",
            e.date,
            e.updatedAt,
          );
        }
      });
    },
  };
}

async function putSetting(db: SqlDb, key: string, value: string): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

/** Whether cloud sync is on for this account on this device. */
export async function isCloudEnabled(db: SqlDb, userId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    CLOUD_USER_KEY,
  );
  return row?.value === userId;
}

/** Turns cloud sync on for `userId`: pulls everything afresh and queues every local day (deletions too) for upload. */
export async function enableCloud(db: SqlDb, userId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await putSetting(db, CLOUD_USER_KEY, userId);
    await db.runAsync("DELETE FROM settings WHERE key = ?", CLOUD_CURSOR_KEY);
    await db.runAsync("UPDATE muhasabah SET dirty = 1");
  });
  emitDataChanged();
}

/** Turns cloud sync off. Local days stay; the cloud copy is the caller's to delete (`deleteCloudCopy`). */
export async function disableCloud(db: SqlDb): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM settings WHERE key IN (?, ?)", CLOUD_USER_KEY, CLOUD_CURSOR_KEY);
  });
  emitDataChanged();
}

export type MuhasabahSyncStatus = "idle" | "syncing" | "ok" | "error";

let status: MuhasabahSyncStatus = "idle";
let inFlight: Promise<void> | null = null;
let lastSyncAt: number | null = null;
const listeners = new Set<() => void>();

function set(next: MuhasabahSyncStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

export function getMuhasabahSyncStatus(): MuhasabahSyncStatus {
  return status;
}

export function onMuhasabahSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolves when no pass is running, so a cloud copy is deleted only after the last upload landed. */
export async function muhasabahSyncSettled(): Promise<void> {
  await inFlight;
}

/**
 * One sync pass of the journal for the signed-in user, if cloud sync is on for them. Concurrent calls share the running
 * pass; `force` skips the minimum interval. Never throws: failures show as `error` and retry next time, a rejected
 * session as `idle`.
 */
export function syncMuhasabah(
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
  inFlight = (async () => {
    try {
      if (!(await isCloudEnabled(db, userId))) {
        if (status !== "idle") set("idle");
        return;
      }
      set("syncing");
      const report = await runMuhasabahSync(
        createMuhasabahStore(db),
        createMuhasabahTransport(url, () => client.getCookie()),
      );
      lastSyncAt = Date.now();
      set("ok");
      if (report.pulled > 0) emitDataChanged();
    } catch (e) {
      set(isUnauthorized(e) ? "idle" : "error");
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
