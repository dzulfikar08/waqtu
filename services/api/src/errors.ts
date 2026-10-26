import { badRequest, checkKeys, errorResponse, HttpError, json, readLimited } from "./circles/http";
import { isRecord } from "./validate";

/**
 * Anonymous crash and error reports from the phone app. `POST /v1/errors` needs no account and never
 * stores who sent a report: no user id, no location, no IP (the rate limit keys on an HMAC of the IP
 * that is deleted after two minutes). `GET /v1/admin/errors` groups them for admins.
 */

export const MAX_EVENTS = 20;
export const MAX_MESSAGE = 500;
export const MAX_STACK = 8192;
export const MAX_REPEATS = 10_000;
/** 20 events with full stacks fit with room for JSON escaping; anything larger is refused unread. */
export const MAX_ERRORS_BODY = 256 * 1024;
/** Requests per keyed IP per minute. A phone sends one batch per launch or foreground. */
export const ERRORS_RATE_LIMIT = 10;
export const ERRORS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 60_000;
const DEFAULT_SINCE_MS = 7 * 24 * 60 * 60 * 1000;
const GROUP_LIMIT = 100;
const MAX_TOP_FRAME = 200;

const PLATFORMS = ["ios", "android"] as const;
type Platform = (typeof PLATFORMS)[number];

const EVENT_KEYS = [
  "platform",
  "appVersion",
  "buildNumber",
  "runtimeVersion",
  "updateId",
  "channel",
  "fatal",
  "name",
  "message",
  "stack",
  "screen",
  "count",
] as const;

export interface ErrorEvent {
  platform: Platform;
  appVersion: string;
  buildNumber: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  channel: string | null;
  fatal: boolean;
  name: string;
  message: string;
  stack: string | null;
  screen: string | null;
  count: number;
}

function str(
  obj: Record<string, unknown>,
  key: string,
  where: string,
  max: number,
  min = 0,
): string {
  const v = obj[key];
  if (typeof v !== "string") throw badRequest(`${where}.${key} must be a string`);
  if (v.length < min || v.length > max) {
    throw badRequest(`${where}.${key} must be ${min} to ${max} characters`);
  }
  return v;
}

function optStr(
  obj: Record<string, unknown>,
  key: string,
  where: string,
  max: number,
): string | null {
  if (obj[key] === undefined || obj[key] === null) return null;
  return str(obj, key, where, max, 1);
}

function parseEvent(raw: unknown, i: number): ErrorEvent {
  const where = `events[${i}]`;
  if (!isRecord(raw)) throw badRequest(`${where} must be an object`);
  checkKeys(raw, EVENT_KEYS);
  const platform = raw.platform;
  if (typeof platform !== "string" || !(PLATFORMS as readonly string[]).includes(platform)) {
    throw badRequest(`${where}.platform must be one of ${PLATFORMS.join(", ")}`);
  }
  if (typeof raw.fatal !== "boolean") throw badRequest(`${where}.fatal must be a boolean`);
  const count = raw.count ?? 1;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_REPEATS) {
    throw badRequest(`${where}.count must be an integer from 1 to ${MAX_REPEATS}`);
  }
  return {
    platform: platform as Platform,
    appVersion: str(raw, "appVersion", where, 32, 1),
    buildNumber: optStr(raw, "buildNumber", where, 16),
    runtimeVersion: optStr(raw, "runtimeVersion", where, 128),
    updateId: optStr(raw, "updateId", where, 64),
    channel: optStr(raw, "channel", where, 32),
    fatal: raw.fatal,
    name: str(raw, "name", where, 100, 1),
    message: str(raw, "message", where, MAX_MESSAGE),
    stack: optStr(raw, "stack", where, MAX_STACK),
    screen: optStr(raw, "screen", where, 100),
    count,
  };
}

export function parseErrorBatch(body: unknown): ErrorEvent[] {
  if (!isRecord(body)) throw badRequest("body must be a JSON object");
  checkKeys(body, ["events"]);
  const { events } = body;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS) {
    throw badRequest(`events must be an array of 1 to ${MAX_EVENTS} events`);
  }
  return events.map(parseEvent);
}

/**
 * First stack frame below the message line: `at fn (file:line:col)` from Hermes/V8, `fn@file:line:col`
 * from JavaScriptCore. Empty when the stack has none.
 */
export function topFrame(stack: string | null): string {
  if (!stack) return "";
  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("at ")) return line.slice(3).slice(0, MAX_TOP_FRAME);
    if (/^[^\s]*@\S+:\d+/.test(line)) return line.slice(0, MAX_TOP_FRAME);
  }
  return "";
}

const encoder = new TextEncoder();

async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`errors:${ip}`)));
  return Array.from(sig.subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fixed one-minute window per keyed IP hash; older windows are deleted in the same batch. */
async function enforceIpRate(db: D1Database, ipHash: string, now: number): Promise<void> {
  const bucket = Math.floor(now / RATE_WINDOW_MS);
  const [, row] = await db.batch<{ hits: number }>([
    db.prepare("DELETE FROM client_error_rate WHERE bucket < ?1").bind(bucket - 1),
    db
      .prepare(
        `INSERT INTO client_error_rate (ip_hash, bucket, hits) VALUES (?1, ?2, 1)
         ON CONFLICT (ip_hash, bucket) DO UPDATE SET hits = hits + 1
         RETURNING hits`,
      )
      .bind(ipHash, bucket),
  ]);
  if ((row?.results[0]?.hits ?? 1) > ERRORS_RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * RATE_WINDOW_MS - now) / 1000));
    throw new HttpError(429, "rate_limited", undefined, { "retry-after": String(retryAfter) });
  }
}

export interface ErrorsEnv {
  APP_DB: D1Database;
  BETTER_AUTH_SECRET?: string;
}

/** `POST /v1/errors`: stores up to MAX_EVENTS anonymous reports. Answers 202 with how many were stored. */
export async function receiveErrors(
  request: Request,
  env: ErrorsEnv,
  now: number,
): Promise<Response> {
  try {
    const secret = env.BETTER_AUTH_SECRET;
    // Refuse rather than rate limit on an unkeyed (guessable) IP hash.
    if (!secret) return json({ error: "server_error" }, 500);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    await enforceIpRate(env.APP_DB, await hashIp(ip, secret), now);

    const bytes = await readLimited(request, MAX_ERRORS_BODY);
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw badRequest("body must be valid JSON");
    }
    const events = parseErrorBatch(body);
    const db = env.APP_DB;
    await db.batch(
      events.map((e) =>
        db
          .prepare(
            `INSERT INTO client_error (id, received_at, platform, app_version, build_number, runtime_version,
               update_id, channel, fatal, name, message, stack, top_frame, screen, count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
          )
          .bind(
            crypto.randomUUID(),
            now,
            e.platform,
            e.appVersion,
            e.buildNumber,
            e.runtimeVersion,
            e.updateId,
            e.channel,
            e.fatal ? 1 : 0,
            e.name,
            e.message,
            e.stack,
            topFrame(e.stack),
            e.screen,
            e.count,
          ),
      ),
    );
    return json({ accepted: events.length }, 202);
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    throw e;
  }
}

export interface ErrorGroup {
  name: string;
  message: string;
  topFrame: string;
  fatal: boolean;
  /** Reports received (rows). */
  reports: number;
  /** Times the apps saw it (sum of folded repeats). */
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  platforms: string[];
  appVersions: string[];
  screens: string[];
  /** Stack of the most recent report. */
  stack: string | null;
}

/** Reports received at or after `since`, grouped by name + message + top frame, most recent first. */
export async function readErrorGroups(db: D1Database, since: number): Promise<ErrorGroup[]> {
  const { results } = await db
    .prepare(
      `SELECT e.name, e.message, e.top_frame, MAX(e.fatal) AS fatal, COUNT(*) AS reports,
         SUM(e.count) AS occurrences, MIN(e.received_at) AS first_seen, MAX(e.received_at) AS last_seen,
         json_group_array(DISTINCT e.platform) AS platforms,
         json_group_array(DISTINCT e.app_version) AS app_versions,
         json_group_array(DISTINCT e.screen) AS screens,
         (SELECT s.stack FROM client_error s
           WHERE s.name = e.name AND s.message = e.message AND s.top_frame = e.top_frame AND s.received_at >= ?1
           ORDER BY s.received_at DESC LIMIT 1) AS stack
       FROM client_error e
       WHERE e.received_at >= ?1
       GROUP BY e.name, e.message, e.top_frame
       ORDER BY last_seen DESC
       LIMIT ?2`,
    )
    .bind(since, GROUP_LIMIT)
    .all<{
      name: string;
      message: string;
      top_frame: string;
      fatal: number;
      reports: number;
      occurrences: number;
      first_seen: number;
      last_seen: number;
      platforms: string;
      app_versions: string;
      screens: string;
      stack: string | null;
    }>();
  const list = (s: string) =>
    (JSON.parse(s) as (string | null)[]).filter((v): v is string => v !== null);
  return results.map((r) => ({
    name: r.name,
    message: r.message,
    topFrame: r.top_frame,
    fatal: r.fatal === 1,
    reports: r.reports,
    occurrences: r.occurrences,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    platforms: list(r.platforms),
    appVersions: list(r.app_versions),
    screens: list(r.screens),
    stack: r.stack,
  }));
}

/** `since` is epoch ms; it defaults to seven days ago. */
export function parseErrorsSince(raw: string | null, now: number): number {
  if (raw === null || raw === "") return now - DEFAULT_SINCE_MS;
  if (!/^\d{1,15}$/.test(raw)) throw badRequest("since must be epoch milliseconds");
  return Number(raw);
}

/** Hourly cron: drops reports past the retention window. */
export async function sweepOldErrors(db: D1Database, now: number): Promise<void> {
  await db
    .prepare("DELETE FROM client_error WHERE received_at < ?1")
    .bind(now - ERRORS_RETENTION_MS)
    .run();
}
