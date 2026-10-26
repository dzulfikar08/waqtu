import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { useSegments } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { API_URL } from "@/auth/config";
import { DEMO_MODE } from "@/demo/mode";

import {
  buildEvent,
  MAX_EVENTS_PER_REQUEST,
  settleBatch,
  toPayload,
  type AppMeta,
  type ErrorEvent,
} from "./report";
import { appendError, readErrorQueue, writeErrorQueue } from "./store";

/**
 * Anonymous crash reporting to our own API (`POST /v1/errors`), no third-party service. Off in
 * development, in the store-screenshot demo build and when the app has no API URL.
 */
export const REPORTING_ENABLED = !__DEV__ && !DEMO_MODE && API_URL !== null;

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

/** React Native and Hermes globals that the TypeScript types do not declare. */
interface RuntimeGlobals {
  ErrorUtils?: {
    getGlobalHandler(): GlobalHandler;
    setGlobalHandler(handler: GlobalHandler): void;
  };
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections: boolean;
      onUnhandled: (id: number, rejection: unknown) => void;
      onHandled: (id: number) => void;
    }) => void;
  };
}

let db: SQLiteDatabase | null = null;
/** Errors from before the database was open; written once it is. */
let early: ErrorEvent[] = [];
let screen: string | null = null;
let meta: AppMeta | null = null;
let installed = false;
let flushing = false;

function appMeta(): AppMeta {
  if (meta) return meta;
  const config = Constants.expoConfig;
  const build = Platform.OS === "ios" ? config?.ios?.buildNumber : config?.android?.versionCode;
  meta = {
    platform: Platform.OS === "ios" ? "ios" : "android",
    appVersion: config?.version ?? "unknown",
    buildNumber: build === undefined ? null : String(build),
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    channel: Updates.channel ?? null,
  };
  return meta;
}

/** Queues one error. Never throws: reporting must not turn one crash into two. */
export function recordError(error: unknown, fatal: boolean): void {
  if (!REPORTING_ENABLED) return;
  try {
    const event = buildEvent(error, fatal, appMeta(), screen);
    if (db) appendError(db, event, Crypto.randomUUID);
    else early.push(event);
  } catch {
    // Nothing sensible to do: the original error still reaches the default handler.
  }
}

/**
 * Chains React Native's global handler (uncaught errors; `isFatal` ends the app after our synchronous
 * write) and tracks unhandled promise rejections. Call once, as early as possible.
 */
export function installErrorHandlers(): void {
  if (!REPORTING_ENABLED || installed) return;
  installed = true;
  // The runtime provides these on React Native with Hermes; its TypeScript types do not.
  const runtime = globalThis as unknown as RuntimeGlobals;
  const errorUtils = runtime.ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      recordError(error, isFatal === true);
      previous(error, isFatal);
    });
  }
  runtime.HermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, rejection) => recordError(rejection, false),
    onHandled: () => {},
  });
}

/** Sends up to one batch of queued reports. Failures keep them for the next launch or foreground. */
export async function flushErrors(): Promise<void> {
  if (!REPORTING_ENABLED || !db || flushing) return;
  const database = db;
  flushing = true;
  try {
    const batch = readErrorQueue(database).slice(0, MAX_EVENTS_PER_REQUEST);
    if (batch.length === 0) return;
    let status: number | null = null;
    try {
      const res = await fetch(`${API_URL}/v1/errors`, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(batch)),
      });
      status = res.status;
    } catch {
      status = null;
    }
    // Read again: errors may have been queued or folded in while the request was out.
    writeErrorQueue(database, settleBatch(readErrorQueue(database), batch, status));
  } catch {
    // A broken queue or database must never surface as another error.
  } finally {
    flushing = false;
  }
}

/** Opens the queue once the database is migrated, sends what is waiting, and again on every foreground. */
export function startErrorReporting(database: SQLiteDatabase): void {
  if (!REPORTING_ENABLED || db) return;
  db = database;
  try {
    for (const event of early) appendError(database, event, Crypto.randomUUID);
  } catch {
    // Dropped: the database cannot take them.
  }
  early = [];
  void flushErrors();
  AppState.addEventListener("change", (state) => {
    if (state === "active") void flushErrors();
  });
}

/**
 * Keeps the current route pattern (`(tabs)/circles`, `circle/[id]`) for the next report. Segments,
 * not the path, so ids in the URL are never part of a report.
 */
export function useErrorScreen(): void {
  const segments = useSegments();
  const route = segments.join("/");
  useEffect(() => {
    screen = route ? `/${route}` : "/";
  }, [route]);
}
