import { OFFSET_PRAYERS, PRAYER_KEYS } from "../prayer/config";

export const ITEMS_KEY = "items";
export const STREAK_KEY = "streak";

const SYNCED = new Set<string>([
  ITEMS_KEY,
  STREAK_KEY,
  PRAYER_KEYS.method,
  PRAYER_KEYS.asr,
  PRAYER_KEYS.hijriOffset,
  ...OFFSET_PRAYERS.map(PRAYER_KEYS.offset),
]);

/**
 * Settings that follow the account. Location, time zone and language stay on the device: where
 * someone prays is not ours to upload, and each phone has its own language.
 */
export function isSyncedSettingKey(key: string): boolean {
  return SYNCED.has(key);
}
