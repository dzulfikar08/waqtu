import type { WeekSummary } from "../mutabaah/week";
import type { Circle, CircleLanguage, Post, WeeklySummary } from "./types";

/** Same rule as the server (services/api/src/circles/validate.ts): 3-24 letters, digits, dot, dash, underscore. */
const HANDLE_RE = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,23}$/u;

export const MAX_VOICE_SECONDS = 120;
/** Server limit on a voice note's declared length (services/api MAX_AUDIO_SECONDS). */
export const SERVER_MAX_VOICE_SECONDS = 180;

/** Whole seconds within what the server accepts, whatever the recorder reported. */
export function clampVoiceSeconds(seconds: number): number {
  const whole = Math.round(Number.isFinite(seconds) ? seconds : 1);
  return Math.max(1, Math.min(SERVER_MAX_VOICE_SECONDS, whole));
}

export type HandleProblem = "short" | "long" | "chars";

export function handleProblem(raw: string): HandleProblem | null {
  const handle = raw.trim();
  if (handle.length < 3) return "short";
  if (handle.length > 24) return "long";
  return HANDLE_RE.test(handle) ? null : "chars";
}

const WORDS: Record<CircleLanguage, { first: string[]; second: string[] }> = {
  id: {
    first: ["Sabar", "Tenang", "Syukur", "Ikhlas", "Teduh", "Istiqomah", "Lembut", "Jernih"],
    second: ["Pagi", "Fajar", "Senja", "Embun", "Langit", "Bintang", "Telaga", "Cahaya"],
  },
  en: {
    first: ["Calm", "Patient", "Grateful", "Gentle", "Quiet", "Steady", "Humble", "Bright"],
    second: ["Dawn", "Dusk", "Dew", "Sky", "Star", "Lake", "Light", "Breeze"],
  },
};

/**
 * An anonymous handle such as `Sabar_Embun_482`. Circles are anonymous by default: nothing in it
 * comes from the account name or email. `rand` is injectable for tests.
 */
export function suggestHandle(language: CircleLanguage, rand: () => number = Math.random): string {
  const { first, second } = WORDS[language];
  const pick = (list: string[]) =>
    list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const digits = 100 + Math.min(899, Math.floor(rand() * 900));
  return `${pick(first)}_${pick(second)}_${digits}`;
}

/** Whole hours from UTC, e.g. 7 for WIB. A coarse bucket for matching, never a location. */
export function tzOffsetHours(date: Date): number {
  const hours = Math.round(-date.getTimezoneOffset() / 60) || 0;
  return Math.max(-12, Math.min(14, hours));
}

export function circleLanguage(locale: string): CircleLanguage {
  return locale.toLowerCase().startsWith("en") ? "en" : "id";
}

const clampInt = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * The only mutabaah data circles ever see: counts for one week. No practice names, no days, no
 * streak. Clamped to the server's accepted ranges.
 */
export function summaryFromWeek(week: WeekSummary, weekEnd: string): WeeklySummary {
  return {
    weekEnd,
    countedDays: clampInt(week.countedDays, 0, 7),
    fardhOnTime: clampInt(week.fardhOnTime, 0, 35),
    fardhJamaah: clampInt(week.fardhJamaah, 0, 35),
    pages: clampInt(week.pages, 0, 10_000),
  };
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** Appends an older page, dropping posts already shown (a refresh and a page can overlap). */
export function appendPage(shown: readonly Post[], page: readonly Post[]): Post[] {
  const seen = new Set(shown.map((p) => p.id));
  return [...shown, ...page.filter((p) => !seen.has(p.id))];
}

/** A fresh first page replaces what is shown but keeps older pages already loaded below it. */
export function refreshFeed(shown: readonly Post[], first: readonly Post[]): Post[] {
  const fresh = new Set(first.map((p) => p.id));
  const oldest = first[first.length - 1];
  const older = oldest
    ? shown.filter((p) => !fresh.has(p.id) && p.createdAt <= oldest.createdAt)
    : [];
  return [...first, ...older];
}

export const canPost = (circle: Pick<Circle, "myStatus">): boolean => circle.myStatus === "active";

export function groupCircles(circles: readonly Circle[]): {
  publicCircle: Circle | null;
  privateCircles: Circle[];
} {
  return {
    publicCircle: circles.find((c) => c.kind === "public") ?? null,
    privateCircles: circles.filter((c) => c.kind === "private"),
  };
}

/** `ABCD2345` → `ABCD-2345` for reading aloud; the server ignores the dash. */
export function displayInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export type ErrorKey =
  | "profileRequired"
  | "handleTaken"
  | "genderLocked"
  | "notFound"
  | "circleFull"
  | "tooManyPrivate"
  | "paused"
  | "rateLimited"
  | "suspended"
  | "summaryOptIn"
  | "tooLarge"
  | "premiumRequired"
  | "network"
  | "generic";

/** Maps a server error code to a copy key under `circles.errors`. */
export function errorKey(status: number | null, code: string | null): ErrorKey {
  if (status === null) return "network";
  switch (code) {
    case "profile_required":
      return "profileRequired";
    case "handle_taken":
      return "handleTaken";
    case "gender_locked":
      return "genderLocked";
    case "circle_full":
      return "circleFull";
    case "too_many_private_circles":
      return "tooManyPrivate";
    case "circle_paused":
      return "paused";
    case "rate_limited":
      return "rateLimited";
    case "suspended":
      return "suspended";
    case "summary_opt_in_required":
      return "summaryOptIn";
    case "premium_required":
      return "premiumRequired";
    case "payload_too_large":
      return "tooLarge";
    case "not_found":
      return "notFound";
    default:
      return status === 404 ? "notFound" : status === 413 ? "tooLarge" : "generic";
  }
}
