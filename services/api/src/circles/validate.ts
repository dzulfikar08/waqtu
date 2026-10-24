import {
  AUDIO_MIME_TYPES,
  GENDERS,
  LANGUAGES,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TEXT_LENGTH,
  REACTIONS,
  REPORT_REASONS,
  type Gender,
  type Language,
  type Reaction,
  type ReportReason,
} from "./constants";
import { badRequest, checkKeys } from "./http";

const HANDLE_RE = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,23}$/u;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const REF_RE = /^[A-Za-z0-9._:-]{1,64}$/;
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const MS_DAY = 86_400_000;

export interface ProfileInput {
  handle: string;
  gender: Gender | undefined;
  language: Language;
  tzOffsetHours: number;
  summaryOptIn: boolean | undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function parseProfile(body: Record<string, unknown>): ProfileInput {
  checkKeys(body, ["handle", "gender", "language", "tzOffsetHours", "summaryOptIn"]);
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  if (!HANDLE_RE.test(handle)) {
    throw badRequest("handle must be 3-24 letters, digits, dot, dash or underscore");
  }
  const tz = body.tzOffsetHours;
  if (typeof tz !== "number" || !Number.isInteger(tz) || tz < -12 || tz > 14) {
    throw badRequest("tzOffsetHours must be a whole number of hours from -12 to 14");
  }
  if (body.summaryOptIn !== undefined && typeof body.summaryOptIn !== "boolean") {
    throw badRequest("summaryOptIn must be a boolean");
  }
  return {
    handle,
    gender: body.gender === undefined ? undefined : oneOf(body.gender, GENDERS, "gender"),
    language: oneOf(body.language, LANGUAGES, "language"),
    tzOffsetHours: tz,
    summaryOptIn: body.summaryOptIn,
  };
}

export function parsePrivateCircle(body: Record<string, unknown>): { name: string | null } {
  checkKeys(body, ["name"]);
  if (body.name === undefined || body.name === null) return { name: null };
  if (typeof body.name !== "string") throw badRequest("name must be a string");
  const name = body.name.trim();
  if (name.length > MAX_NAME_LENGTH) throw badRequest(`name is at most ${MAX_NAME_LENGTH} chars`);
  return { name: name || null };
}

/** Upper-cases and drops separators so "abcd-2345" and "ABCD2345" are the same code. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseJoinPrivate(body: Record<string, unknown>): { code: string } {
  checkKeys(body, ["code"]);
  if (typeof body.code !== "string") throw badRequest("code must be a string");
  const code = normalizeInviteCode(body.code);
  if (code.length < 6 || code.length > 16) throw badRequest("code is not valid");
  return { code };
}

export interface PostInput {
  text: string | null;
  mediaId: string | null;
  halaqahDayId: string | null;
}

export function parsePost(body: Record<string, unknown>): PostInput {
  checkKeys(body, ["text", "mediaId", "halaqahDayId"]);
  let text: string | null = null;
  if (body.text !== undefined && body.text !== null) {
    if (typeof body.text !== "string") throw badRequest("text must be a string");
    text = body.text.trim();
    if (text.length > MAX_TEXT_LENGTH) throw badRequest(`text is at most ${MAX_TEXT_LENGTH} chars`);
    if (text === "") text = null;
  }
  let mediaId: string | null = null;
  if (body.mediaId !== undefined && body.mediaId !== null) {
    if (typeof body.mediaId !== "string" || !ID_RE.test(body.mediaId)) {
      throw badRequest("mediaId is not valid");
    }
    mediaId = body.mediaId;
  }
  let halaqahDayId: string | null = null;
  if (body.halaqahDayId !== undefined && body.halaqahDayId !== null) {
    if (typeof body.halaqahDayId !== "string" || !REF_RE.test(body.halaqahDayId)) {
      throw badRequest(`halaqahDayId must match ${REF_RE}`);
    }
    halaqahDayId = body.halaqahDayId;
  }
  if (text === null && mediaId === null) throw badRequest("a post needs text or a voice note");
  return { text, mediaId, halaqahDayId };
}

export interface SummaryInput {
  weekEnd: string;
  countedDays: number;
  fardhOnTime: number;
  fardhJamaah: number;
  pages: number;
}

function intIn(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw badRequest(`${field} must be an integer ${min}..${max}`);
  }
  return value;
}

/** Aggregate only: counts for one week, never which practices or on which days. */
export function parseSummary(body: Record<string, unknown>, now: number): SummaryInput {
  checkKeys(body, ["weekEnd", "countedDays", "fardhOnTime", "fardhJamaah", "pages"]);
  const weekEnd = body.weekEnd;
  if (typeof weekEnd !== "string" || !DAY_RE.test(weekEnd)) {
    throw badRequest("weekEnd must be a YYYY-MM-DD date");
  }
  const ms = Date.parse(`${weekEnd}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== weekEnd) {
    throw badRequest("weekEnd must be a real date");
  }
  if (ms > now + 2 * MS_DAY || ms < now - 8 * MS_DAY) {
    throw badRequest("weekEnd must be within the last week");
  }
  return {
    weekEnd,
    countedDays: intIn(body.countedDays, 0, 7, "countedDays"),
    fardhOnTime: intIn(body.fardhOnTime, 0, 35, "fardhOnTime"),
    fardhJamaah: intIn(body.fardhJamaah, 0, 35, "fardhJamaah"),
    pages: intIn(body.pages, 0, 10_000, "pages"),
  };
}

const stripVariation = (s: string) => s.replaceAll("\uFE0F", "");

export function parseReaction(body: Record<string, unknown>): Reaction {
  checkKeys(body, ["emoji"]);
  const emoji = typeof body.emoji === "string" ? stripVariation(body.emoji) : null;
  const match = REACTIONS.find((r) => stripVariation(r) === emoji);
  if (!match) throw badRequest(`emoji must be one of ${REACTIONS.join(" ")}`);
  return match;
}

export interface ReportInput {
  target: "post" | "user";
  reason: ReportReason;
  note: string | null;
}

export function parseReport(body: Record<string, unknown>): ReportInput {
  checkKeys(body, ["target", "reason", "note"]);
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") throw badRequest("note must be a string");
    note = body.note.trim().slice(0, MAX_NOTE_LENGTH + 1);
    if (note.length > MAX_NOTE_LENGTH) throw badRequest(`note is at most ${MAX_NOTE_LENGTH} chars`);
    if (note === "") note = null;
  }
  return {
    target: oneOf(body.target, ["post", "user"] as const, "target"),
    reason: oneOf(body.reason, REPORT_REASONS, "reason"),
    note,
  };
}

export function parseAction<T extends string>(
  body: Record<string, unknown>,
  allowed: readonly T[],
): T {
  checkKeys(body, ["action"]);
  return oneOf(body.action, allowed, "action");
}

export function isAudioMime(mime: string): boolean {
  return (AUDIO_MIME_TYPES as readonly string[]).includes(mime);
}

export const isId = (s: string): boolean => ID_RE.test(s);
