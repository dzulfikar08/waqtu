import { describe, expect, test } from "bun:test";
import {
  addDays,
  calculatePrayerTimes,
  civilParts,
  fastingCountdown,
  formatLocalTime,
} from "@waqtu/core";

import { countdownWidgetSchedule } from "../src/ramadhan/widgetSchedule";

const config = {
  latitude: -6.2088,
  longitude: 106.8456,
  timeZone: "Asia/Jakarta",
  method: "kemenag",
  asr: "shafii",
  offsets: {},
} as const;
const t = (key: string, options?: Record<string, string>) =>
  options ? `${key}${JSON.stringify(options)}` : key;
const day = { year: 2026, month: 2, day: 20 };
const today = calculatePrayerTimes({ ...config, date: day });
const tomorrow = calculatePrayerTimes({ ...config, date: addDays(day, 1) });

describe("countdownWidgetSchedule", () => {
  test("alternates imsak and maghrib in time order, all after now", () => {
    const now = new Date(+today.times.imsak! - 60_000);
    const entries = countdownWidgetSchedule(config, now, t, 3);
    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.title)).toEqual([
      "ramadhan.countdown.sahur",
      "ramadhan.countdown.fasting",
      "ramadhan.countdown.sahur",
      "ramadhan.countdown.fasting",
      "ramadhan.countdown.sahur",
      "ramadhan.countdown.fasting",
    ]);
    for (let i = 1; i < entries.length; i++)
      expect(entries[i]!.at).toBeGreaterThan(entries[i - 1]!.at);
    expect(entries[0]!.text).toBe(
      `ramadhan.countdown.at${JSON.stringify({
        prayer: "ramadhan.countdown.imsak",
        time: formatLocalTime(today.times.imsak!, config.timeZone),
      })}`,
    );
  });

  test("first entry is the fastingCountdown target at any moment of the day", () => {
    const moments = [
      +today.times.imsak! - 60_000,
      +today.times.imsak!,
      +today.times.maghrib! - 1,
      +today.times.maghrib!,
      +today.times.isha!,
    ];
    for (const ms of moments) {
      const now = new Date(ms);
      expect(civilParts(now, config.timeZone)).toEqual(day);
      const first = countdownWidgetSchedule(config, now, t, 2)[0]!;
      expect(first.at).toBe(+fastingCountdown(now, today, tomorrow)!.at);
    }
  });

  test("covers the requested number of days", () => {
    const now = new Date(+today.times.imsak! - 60_000);
    expect(countdownWidgetSchedule(config, now, t)).toHaveLength(60);
  });
});
