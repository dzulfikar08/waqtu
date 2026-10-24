import type { AsrMadhab, MethodId, PrayerName, PrayerOffsets } from "@waqtu/core";
import type { SQLiteDatabase } from "expo-sqlite";

import { getSetting } from "./settings";

const METHODS: readonly MethodId[] = [
  "kemenag",
  "mwl",
  "isna",
  "ummAlQura",
  "egyptian",
  "singapore",
];
const OFFSET_PRAYERS: readonly PrayerName[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export interface PrayerConfig {
  latitude: number;
  longitude: number;
  timeZone: string;
  method: MethodId;
  asr: AsrMadhab;
  offsets: PrayerOffsets;
  locationName: string | null;
}

/**
 * The user's prayer settings, read from the shared `settings` table (keys `lat`, `lon`, `tz`, `method`,
 * `asr`, `offset.<prayer>`, `locationName`). Null while no location is set.
 * Repoint this at `readPrayerConfig` of the prayer-settings module once both features share a branch.
 */
export async function readPrayerConfig(db: SQLiteDatabase): Promise<PrayerConfig | null> {
  const [lat, lon, tz, method, asr, locationName] = await Promise.all(
    ["lat", "lon", "tz", "method", "asr", "locationName"].map((k) => getSetting(db, k)),
  );
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (
    lat === null ||
    lon === null ||
    !tz ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  const offsets: PrayerOffsets = {};
  for (const prayer of OFFSET_PRAYERS) {
    const minutes = Number(await getSetting(db, `offset.${prayer}`));
    if (Number.isInteger(minutes) && minutes !== 0) offsets[prayer] = minutes;
  }
  return {
    latitude,
    longitude,
    timeZone: tz,
    method: METHODS.find((m) => m === method) ?? "kemenag",
    asr: asr === "hanafi" ? "hanafi" : "shafii",
    offsets,
    locationName: locationName || null,
  };
}

/** Moon-sighting correction in whole days (the `hijriOffset` setting), 0 when unset. */
export async function readHijriOffset(db: SQLiteDatabase): Promise<number> {
  const value = Number(await getSetting(db, "hijriOffset"));
  return Number.isInteger(value) ? value : 0;
}
