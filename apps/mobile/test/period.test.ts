import { describe, expect, test } from "bun:test";

import { parsePrayerSettings } from "../src/prayer/config";
import { periodAt, periodForHour, periodProgress } from "../src/prayer/period";
import { timesFor } from "../src/prayer/schedule";

const jakarta = { latitude: -6.2088, longitude: 106.8456, timeZone: "Asia/Jakarta", name: null };
const settings = parsePrayerSettings(() => null);
const day = "2027-02-12";
const times = timesFor(settings, jakarta, day).times;

function at(date: Date | null, minutes: number): Date {
  if (!date) throw new Error("missing time");
  return new Date(date.getTime() + minutes * 60_000);
}

describe("periodAt", () => {
  test("between Asr and Maghrib is the Asr part of the day", () => {
    const span = periodAt(settings, jakarta, at(times.asr, 10));
    expect(span?.period).toBe("asr");
    expect(span?.start.getTime()).toBe(times.asr?.getTime());
    expect(span?.end.getTime()).toBe(times.maghrib?.getTime());
    expect(span?.next).toBe("maghrib");
  });

  test("after sunrise, before Dhuhr is its own part", () => {
    expect(periodAt(settings, jakarta, at(times.sunrise, 1))?.period).toBe("sunrise");
    expect(periodAt(settings, jakarta, at(times.sunrise, -1))?.period).toBe("fajr");
  });

  test("the night spans midnight: Isha until the next Fajr", () => {
    const late = periodAt(settings, jakarta, at(times.isha, 60));
    const early = periodAt(settings, jakarta, at(times.fajr, -30));
    expect(late?.period).toBe("isha");
    expect(early?.period).toBe("isha");
    expect(early?.end.getTime()).toBe(times.fajr?.getTime());
  });
});

describe("periodProgress", () => {
  test("clamps to 0..1", () => {
    const span = {
      period: "dhuhr" as const,
      start: new Date(0),
      end: new Date(100),
      next: "asr" as const,
    };
    expect(periodProgress(span, new Date(-5))).toBe(0);
    expect(periodProgress(span, new Date(25))).toBe(0.25);
    expect(periodProgress(span, new Date(500))).toBe(1);
  });
});

describe("periodForHour", () => {
  test("maps the phone's clock to a rough part of the day", () => {
    expect(periodForHour(2)).toBe("isha");
    expect(periodForHour(5)).toBe("fajr");
    expect(periodForHour(9)).toBe("sunrise");
    expect(periodForHour(13)).toBe("dhuhr");
    expect(periodForHour(16)).toBe("asr");
    expect(periodForHour(18)).toBe("maghrib");
    expect(periodForHour(21)).toBe("isha");
  });
});
