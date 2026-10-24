import type { AsrMadhab, MethodId, PrayerOffsets } from "@waqtu/core";
import type { SQLiteDatabase } from "expo-sqlite";

import { readPrayerSettings } from "@/prayer/config";

export interface PrayerConfig {
  latitude: number;
  longitude: number;
  timeZone: string;
  method: MethodId;
  asr: AsrMadhab;
  offsets: PrayerOffsets;
  locationName: string | null;
}

/** The shared prayer setup (see `@/prayer/config`) in the flat shape the Ramadhan screens use; null while no location is set. */
export async function readPrayerConfig(db: SQLiteDatabase): Promise<PrayerConfig | null> {
  const { location, method, asr, offsets } = await readPrayerSettings(db);
  if (!location) return null;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    timeZone: location.timeZone,
    method,
    asr,
    offsets,
    locationName: location.name,
  };
}

/** Moon-sighting correction in whole days (the `hijriOffset` setting), 0 when unset. */
export async function readHijriOffset(db: SQLiteDatabase): Promise<number> {
  return (await readPrayerSettings(db)).hijriOffset;
}
