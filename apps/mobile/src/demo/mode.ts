/**
 * Store-screenshot build. `EXPO_PUBLIC_DEMO_MODE=1` is set only by the `store-screenshots` workflow; it is inlined at
 * bundle time and absent from every EAS profile and every release build, where the demo route redirects home.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

/** Fixed "now" of the demo build: Friday 12 Feb 2027, 17:00 in Jakarta (day 5 of Ramadan 1448H, Maghrib still ahead). */
export const DEMO_NOW_MS = Date.UTC(2027, 1, 12, 10, 0, 0);
export const DEMO_TIME_ZONE = "Asia/Jakarta";
