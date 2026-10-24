export interface Entry {
  date: string;
  itemId: string;
  value: number;
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: number;
}

export const MAX_ENTRIES = 500;
export const MAX_SETTINGS = 100;
export const MAX_SETTING_VALUE = 16384;
export const MAX_VALUE = 1_000_000;
export const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const KEY_RE = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;

export class ValidationError extends Error {
  constructor(
    readonly status: 400 | 413,
    readonly detail: string,
  ) {
    super(detail);
  }
}

const bad = (detail: string): never => {
  throw new ValidationError(400, detail);
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function checkKeys(obj: Record<string, unknown>, allowed: string[], where: string) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) bad(`${where}: unknown field "${k}"`);
  }
}

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function checkUpdatedAt(v: unknown, where: string, now: number): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) {
    return bad(`${where}.updatedAt must be a non-negative integer (epoch ms)`);
  }
  if (v > now + MAX_FUTURE_MS) return bad(`${where}.updatedAt is more than 24h in the future`);
  return v;
}

function parseEntry(raw: unknown, i: number, now: number): Entry {
  const where = `entries[${i}]`;
  if (!isRecord(raw)) return bad(`${where} must be an object`);
  checkKeys(raw, ["date", "itemId", "value", "updatedAt"], where);
  const { date, itemId, value } = raw;
  if (typeof date !== "string" || !isRealDate(date)) {
    return bad(`${where}.date must be a valid YYYY-MM-DD date`);
  }
  if (typeof itemId !== "string" || !ITEM_RE.test(itemId)) {
    return bad(`${where}.itemId must match ${ITEM_RE}`);
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_VALUE) {
    return bad(`${where}.value must be an integer 0..${MAX_VALUE}`);
  }
  return { date, itemId, value, updatedAt: checkUpdatedAt(raw.updatedAt, where, now) };
}

function parseSetting(raw: unknown, i: number, now: number): Setting {
  const where = `settings[${i}]`;
  if (!isRecord(raw)) return bad(`${where} must be an object`);
  checkKeys(raw, ["key", "value", "updatedAt"], where);
  const { key, value } = raw;
  if (typeof key !== "string" || !KEY_RE.test(key)) {
    return bad(`${where}.key must match ${KEY_RE}`);
  }
  if (typeof value !== "string" || value.length > MAX_SETTING_VALUE) {
    return bad(`${where}.value must be a string of at most ${MAX_SETTING_VALUE} chars`);
  }
  return { key, value, updatedAt: checkUpdatedAt(raw.updatedAt, where, now) };
}

export function parseSyncBody(
  body: unknown,
  now: number,
): { entries: Entry[]; settings: Setting[] } {
  if (!isRecord(body)) return bad("body must be a JSON object");
  checkKeys(body, ["entries", "settings"], "body");
  const { entries = [], settings = [] } = body;
  if (!Array.isArray(entries)) return bad("entries must be an array");
  if (!Array.isArray(settings)) return bad("settings must be an array");
  if (entries.length > MAX_ENTRIES) {
    throw new ValidationError(413, `at most ${MAX_ENTRIES} entries per request`);
  }
  if (settings.length > MAX_SETTINGS) {
    throw new ValidationError(413, `at most ${MAX_SETTINGS} settings per request`);
  }
  return {
    entries: entries.map((e, i) => parseEntry(e, i, now)),
    settings: settings.map((s, i) => parseSetting(s, i, now)),
  };
}

export function parseSince(raw: string | null): number {
  if (raw === null) return 0;
  if (!/^\d{1,15}$/.test(raw)) return bad("since must be a non-negative integer cursor");
  return Number(raw);
}

export function parseLimit(raw: string | null): number {
  if (raw === null) return MAX_ENTRIES;
  if (!/^\d{1,4}$/.test(raw)) return bad(`limit must be an integer 1..${MAX_ENTRIES}`);
  const n = Number(raw);
  if (n < 1 || n > MAX_ENTRIES) return bad(`limit must be an integer 1..${MAX_ENTRIES}`);
  return n;
}
