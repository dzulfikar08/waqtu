import { addDays, calculatePrayerTimes, civilParts, formatLocalTime } from "@waqtu/core";

import type { PrayerConfig } from "./prayerConfig";

/** One moment the home-screen widget counts down to; `at` is epoch ms. Labels are already translated. */
export interface WidgetEntry {
  at: number;
  title: string;
  text: string;
}

export type Translate = (key: string, options?: Record<string, string>) => string;

/** Civil days of imsak/maghrib handed to the widget, so it keeps counting while the app stays closed. */
export const WIDGET_DAYS = 30;

/**
 * Every imsak and maghrib after `now` over the next `days` civil days (today included), in time
 * order. The widget shows the first one still ahead, which is the same target `fastingCountdown`
 * picks: imsak until it passes, then maghrib, then the next day's imsak. Times that do not occur
 * (polar latitudes) are skipped.
 */
export function countdownWidgetSchedule(
  config: Omit<PrayerConfig, "locationName">,
  now: Date,
  t: Translate,
  days: number = WIDGET_DAYS,
): WidgetEntry[] {
  const today = civilParts(now, config.timeZone);
  const entries: WidgetEntry[] = [];
  for (let i = 0; i < days; i++) {
    const { times } = calculatePrayerTimes({
      latitude: config.latitude,
      longitude: config.longitude,
      timeZone: config.timeZone,
      method: config.method,
      asr: config.asr,
      offsets: config.offsets,
      date: addDays(today, i),
    });
    for (const target of ["imsak", "maghrib"] as const) {
      const at = times[target];
      if (!at || at <= now) continue;
      entries.push({
        at: +at,
        title: t(target === "imsak" ? "ramadhan.countdown.sahur" : "ramadhan.countdown.fasting"),
        text: t("ramadhan.countdown.at", {
          prayer: t(`ramadhan.countdown.${target}`),
          time: formatLocalTime(at, config.timeZone),
        }),
      });
    }
  }
  return entries;
}
