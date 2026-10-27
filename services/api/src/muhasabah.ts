import { isRecord, MAX_FUTURE_MS, ValidationError } from "./validate";

/**
 * Opt-in cloud copy of the muhasabah journal: one row per user and day, the whole entry
 * last-write-wins. The apps only call this after the user turns on "Sync muhasabah to the cloud".
 */

export const MAX_MUHASABAH_PUSH = 20;
export const MAX_MUHASABAH_PULL = 100;
/** A full push is 20 entries of up to 3 × 16000 chars, beyond the 1 MB of the other routes. */
export const MAX_MUHASABAH_BODY_BYTES = 4_000_000;
export const MAX_TEXT = 16000;

const TEXT_FIELDS = ["feelings", "newAction", "continueTomorrow"] as const;
/** Key order of the canonical JSON stored in `data`: what the equal-timestamp tie-break compares. */
const FIELD_ORDER = [
  "feelings",
  "newAction",
  "taqwa",
  "gratitude",
  "energy",
  "willingness",
  "continueTomorrow",
] as const;

type Field = (typeof FIELD_ORDER)[number];
export type MuhasabahBody = Partial<Record<Field, string | number>>;

export interface MuhasabahWire {
  date: string;
  updatedAt: number;
  /** null deletes the day. */
  entry: MuhasabahBody | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (detail: string): never => {
  throw new ValidationError(400, detail);
};

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseBody(raw: unknown, where: string): MuhasabahBody {
  if (!isRecord(raw)) return bad(`${where} must be an object or null`);
  for (const k of Object.keys(raw)) {
    if (!(FIELD_ORDER as readonly string[]).includes(k)) bad(`${where}: unknown field "${k}"`);
  }
  const out: MuhasabahBody = {};
  for (const field of FIELD_ORDER) {
    const v = raw[field];
    if (v === undefined) continue;
    if ((TEXT_FIELDS as readonly string[]).includes(field)) {
      if (typeof v !== "string" || v.length === 0 || v.length > MAX_TEXT) {
        return bad(`${where}.${field} must be a non-empty string of at most ${MAX_TEXT} chars`);
      }
    } else if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 10) {
      return bad(`${where}.${field} must be an integer 1..10`);
    }
    out[field] = v;
  }
  if (Object.keys(out).length === 0) return bad(`${where} must have at least one answer`);
  return out;
}

function parseWire(raw: unknown, i: number, now: number): MuhasabahWire {
  const where = `entries[${i}]`;
  if (!isRecord(raw)) return bad(`${where} must be an object`);
  for (const k of Object.keys(raw)) {
    if (k !== "date" && k !== "updatedAt" && k !== "entry") bad(`${where}: unknown field "${k}"`);
  }
  const { date, updatedAt, entry } = raw;
  if (typeof date !== "string" || !isRealDate(date)) {
    return bad(`${where}.date must be a valid YYYY-MM-DD date`);
  }
  if (typeof updatedAt !== "number" || !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    return bad(`${where}.updatedAt must be a non-negative integer (epoch ms)`);
  }
  if (updatedAt > now + MAX_FUTURE_MS)
    return bad(`${where}.updatedAt is more than 24h in the future`);
  if (entry === undefined) return bad(`${where}.entry is required (null deletes the day)`);
  return {
    date,
    updatedAt,
    entry: entry === null ? null : parseBody(entry, `${where}.entry`),
  };
}

export function parseMuhasabahPush(body: unknown, now: number): MuhasabahWire[] {
  if (!isRecord(body)) return bad("body must be a JSON object");
  for (const k of Object.keys(body)) if (k !== "entries") bad(`body: unknown field "${k}"`);
  const { entries } = body;
  if (!Array.isArray(entries)) return bad("entries must be an array");
  if (entries.length > MAX_MUHASABAH_PUSH) {
    throw new ValidationError(413, `at most ${MAX_MUHASABAH_PUSH} entries per request`);
  }
  return entries.map((e, i) => parseWire(e, i, now));
}

export function parseMuhasabahLimit(raw: string | null): number {
  if (raw === null) return MAX_MUHASABAH_PULL;
  const n = /^\d{1,4}$/.test(raw) ? Number(raw) : 0;
  if (n < 1 || n > MAX_MUHASABAH_PULL) {
    return bad(`limit must be an integer 1..${MAX_MUHASABAH_PULL}`);
  }
  return n;
}

/** Canonical JSON of an entry (fixed key order), '' for a deleted day. */
export function encodeData(entry: MuhasabahBody | null): string {
  if (entry === null) return "";
  const ordered: MuhasabahBody = {};
  for (const field of FIELD_ORDER) if (entry[field] !== undefined) ordered[field] = entry[field];
  return JSON.stringify(ordered);
}

/** Same last-write-wins rule as the store: the later edit wins, an equal timestamp the greater data. */
export function mergeMuhasabah(entries: MuhasabahWire[]): MuhasabahWire[] {
  const merged = new Map<string, { wire: MuhasabahWire; data: string }>();
  for (const wire of entries) {
    const data = encodeData(wire.entry);
    const cur = merged.get(wire.date);
    if (
      !cur ||
      wire.updatedAt > cur.wire.updatedAt ||
      (wire.updatedAt === cur.wire.updatedAt && data > cur.data)
    ) {
      merged.set(wire.date, { wire, data });
    }
  }
  return [...merged.values()].map((m) => m.wire);
}

/**
 * Applies the writes atomically in one D1 batch, with the counter bump + upsert pairing of
 * `applyWrites` in sync.ts: a losing or identical row changes nothing, so the revision only
 * advances on real writes.
 */
export async function applyMuhasabah(
  db: D1Database,
  userId: string,
  raw: MuhasabahWire[],
): Promise<{ applied: number; cursor: string }> {
  const entries = mergeMuhasabah(raw);
  const stmts: D1PreparedStatement[] = [
    db.prepare("INSERT OR IGNORE INTO muhasabah_state (user_id, rev) VALUES (?1, 0)").bind(userId),
  ];
  for (const e of entries) {
    const data = encodeData(e.entry);
    stmts.push(
      db
        .prepare(
          `UPDATE muhasabah_state SET rev = rev + 1
           WHERE user_id = ?1 AND NOT EXISTS (
             SELECT 1 FROM muhasabah_entry
             WHERE user_id = ?1 AND date = ?2
               AND NOT (?4 > updated_at OR (?4 = updated_at AND ?3 > data)))`,
        )
        .bind(userId, e.date, data, e.updatedAt),
      db
        .prepare(
          `INSERT INTO muhasabah_entry (user_id, date, data, updated_at, rev)
           SELECT ?1, ?2, ?3, ?4, rev FROM muhasabah_state WHERE user_id = ?1
           ON CONFLICT (user_id, date) DO UPDATE SET
             data = excluded.data, updated_at = excluded.updated_at, rev = excluded.rev
           WHERE excluded.updated_at > muhasabah_entry.updated_at
              OR (excluded.updated_at = muhasabah_entry.updated_at AND excluded.data > muhasabah_entry.data)`,
        )
        .bind(userId, e.date, data, e.updatedAt),
    );
  }
  stmts.push(db.prepare("SELECT rev FROM muhasabah_state WHERE user_id = ?1").bind(userId));

  const results = await db.batch(stmts);
  let applied = 0;
  for (let i = 0; i < entries.length; i++) applied += results[2 + i * 2]!.meta.changes;
  // The last statement is `SELECT rev`, so its one row has that shape.
  const revRow = results[results.length - 1]!.results[0] as { rev: number };
  return { applied, cursor: String(revRow.rev) };
}

export async function readMuhasabah(
  db: D1Database,
  userId: string,
  since: number,
  limit: number,
): Promise<{ entries: MuhasabahWire[]; cursor: string; hasMore: boolean }> {
  const { results } = await db
    .prepare(
      `SELECT date, data, updated_at, rev FROM muhasabah_entry
       WHERE user_id = ?1 AND rev > ?2 ORDER BY rev ASC LIMIT ?3`,
    )
    .bind(userId, since, limit + 1)
    .all<{ date: string; data: string; updated_at: number; rev: number }>();

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const entries = page.map((r) => ({
    date: r.date,
    updatedAt: r.updated_at,
    entry: r.data === "" ? null : (JSON.parse(r.data) as MuhasabahBody),
  }));
  const last = page[page.length - 1];
  return { entries, cursor: String(last ? last.rev : since), hasMore };
}

/** Removes the user's whole cloud journal, tombstones included. The rev counter keeps counting. */
export async function deleteMuhasabah(db: D1Database, userId: string): Promise<number> {
  const res = await db.prepare("DELETE FROM muhasabah_entry WHERE user_id = ?1").bind(userId).run();
  return res.meta.changes;
}
