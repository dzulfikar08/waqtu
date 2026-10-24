export const GENDERS = ["ikhwan", "akhwat"] as const;
export type Gender = (typeof GENDERS)[number];

export const LANGUAGES = ["id", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/** A circle closes to newcomers at MAX_MEMBERS. Auto-match packs the fullest open circle first, so a circle reaches MIN_MEMBERS before a new one opens. */
export const MIN_MEMBERS = 8;
export const MAX_MEMBERS = 12;

/** Auto-match only pairs people whose UTC offsets are at most this many hours apart. */
export const MAX_TZ_DISTANCE_HOURS = 4;

export const MAX_PRIVATE_CIRCLES = 5;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_NOTE_LENGTH = 500;
export const MAX_NAME_LENGTH = 40;

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 180;
/** Lowercase, parameters stripped. m4a/aac is what expo-audio records on both platforms. */
export const AUDIO_MIME_TYPES = [
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/3gpp",
] as const;

/** The one reaction set. Stored and returned exactly as written here. */
export const REACTIONS = ["\u2764\uFE0F", "\u{1F932}", "\u2728"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Distinct pending reports that hide a post until an admin reviews it. */
export const AUTO_HIDE_REPORTS = 3;

export const FEED_PAGE_DEFAULT = 30;
export const FEED_PAGE_MAX = 50;

const HOUR = 3_600_000;

/** Mutations allowed per user per window. Reads are not limited. */
export const RATE_LIMITS = {
  profile: { limit: 20, windowMs: HOUR },
  join: { limit: 30, windowMs: HOUR },
  post: { limit: 12, windowMs: HOUR },
  upload: { limit: 12, windowMs: HOUR },
  react: { limit: 200, windowMs: HOUR },
  report: { limit: 12, windowMs: HOUR },
  block: { limit: 30, windowMs: HOUR },
  state: { limit: 60, windowMs: HOUR },
} as const;
export type RateBucket = keyof typeof RATE_LIMITS;
