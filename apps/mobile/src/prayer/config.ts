import type { AsrMadhab, MethodId, PrayerName, PrayerOffsets } from "@waqtu/core";
import type { SQLiteDatabase } from "expo-sqlite";

export const METHOD_IDS = [
  "kemenag",
  "mwl",
  "isna",
  "ummAlQura",
  "egyptian",
  "singapore",
] as const satisfies readonly MethodId[];

export const ASR_MADHABS = ["shafii", "hanafi"] as const satisfies readonly AsrMadhab[];

/** Prayers the user can nudge by whole minutes. */
export const OFFSET_PRAYERS = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
] as const satisfies readonly PrayerName[];

export const MAX_OFFSET_MINUTES = 30;
export const MAX_HIJRI_OFFSET = 2;
export const DEFAULT_METHOD: MethodId = "kemenag";
export const DEFAULT_ASR: AsrMadhab = "shafii";

/** `settings` keys. Shared with other screens that read the prayer setup. */
export const PRAYER_KEYS = {
  lat: "lat",
  lon: "lon",
  tz: "tz",
  locationName: "locationName",
  locationAt: "locationAt",
  method: "method",
  asr: "asr",
  hijriOffset: "hijriOffset",
  offset: (prayer: PrayerName) => `offset.${prayer}`,
} as const;

export interface Location {
  latitude: number;
  longitude: number;
  /** IANA zone the prayer times and the day boundary use. */
  timeZone: string;
  name: string | null;
}

export interface PrayerSettings {
  location: Location | null;
  method: MethodId;
  asr: AsrMadhab;
  /** Moon-sighting correction in days (Indonesia often lags Umm al-Qura by 1). */
  hijriOffset: number;
  offsets: PrayerOffsets;
}

export type SettingReader = (key: string) => string | null | undefined;

function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function intIn(raw: string | null | undefined, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Raw stored strings → a validated setup. Bad or missing values fall back to Kemenag defaults. */
export function parsePrayerSettings(get: SettingReader): PrayerSettings {
  const lat = Number(get(PRAYER_KEYS.lat));
  const lon = Number(get(PRAYER_KEYS.lon));
  const tz = get(PRAYER_KEYS.tz);
  const hasLocation =
    get(PRAYER_KEYS.lat) != null &&
    get(PRAYER_KEYS.lon) != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    typeof tz === "string" &&
    validZone(tz);
  const method = get(PRAYER_KEYS.method);
  const asr = get(PRAYER_KEYS.asr);
  const offsets: PrayerOffsets = {};
  for (const prayer of OFFSET_PRAYERS) {
    const minutes = intIn(get(PRAYER_KEYS.offset(prayer)), -MAX_OFFSET_MINUTES, MAX_OFFSET_MINUTES);
    if (minutes) offsets[prayer] = minutes;
  }
  return {
    location: hasLocation
      ? {
          latitude: lat,
          longitude: lon,
          timeZone: tz as string,
          name: get(PRAYER_KEYS.locationName) || null,
        }
      : null,
    method: (METHOD_IDS as readonly string[]).includes(method ?? "")
      ? (method as MethodId)
      : DEFAULT_METHOD,
    asr: (ASR_MADHABS as readonly string[]).includes(asr ?? "") ? (asr as AsrMadhab) : DEFAULT_ASR,
    hijriOffset: intIn(get(PRAYER_KEYS.hijriOffset), -MAX_HIJRI_OFFSET, MAX_HIJRI_OFFSET) ?? 0,
    offsets,
  };
}

export async function readPrayerSettings(db: SQLiteDatabase): Promise<PrayerSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('lat','lon','tz','locationName','method','asr','hijriOffset') OR key LIKE 'offset.%'",
  );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return parsePrayerSettings((key) => map.get(key));
}
