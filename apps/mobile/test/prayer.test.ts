import { describe, expect, test } from "bun:test";

import { parsePrayerSettings } from "../src/prayer/config";
import { countdownParts, nextSlot, slotsForDay, upcomingSlots } from "../src/prayer/schedule";

const jakarta = { latitude: -6.2088, longitude: 106.8456, timeZone: "Asia/Jakarta", name: null };

describe("parsePrayerSettings", () => {
  test("empty store: Kemenag defaults, no location", () => {
    const p = parsePrayerSettings(() => null);
    expect(p).toEqual({
      location: null,
      method: "kemenag",
      asr: "shafii",
      hijriOffset: 0,
      offsets: {},
    });
  });

  test("reads a full setup and rejects out-of-range values", () => {
    const store: Record<string, string> = {
      lat: "-6.2088",
      lon: "106.8456",
      tz: "Asia/Jakarta",
      locationName: "Jakarta",
      method: "mwl",
      asr: "hanafi",
      hijriOffset: "-1",
      "offset.fajr": "2",
      "offset.isha": "99",
      "offset.dhuhr": "x",
    };
    const p = parsePrayerSettings((k) => store[k]);
    expect(p.location).toEqual({ ...jakarta, name: "Jakarta" });
    expect(p.method).toBe("mwl");
    expect(p.asr).toBe("hanafi");
    expect(p.hijriOffset).toBe(-1);
    expect(p.offsets).toEqual({ fajr: 2 });
  });

  test("an invalid time zone or coordinate means no location", () => {
    expect(
      parsePrayerSettings((k) => ({ lat: "1", lon: "1", tz: "Mars/Base" })[k]).location,
    ).toBeNull();
    expect(parsePrayerSettings((k) => ({ lat: "95", lon: "1", tz: "UTC" })[k]).location).toBeNull();
    expect(parsePrayerSettings((k) => ({ lat: "1", tz: "UTC" })[k]).location).toBeNull();
  });
});

describe("schedule", () => {
  const settings = parsePrayerSettings(() => null);

  test("five slots a day in order, each window closing at the next event", () => {
    const slots = slotsForDay(settings, jakarta, "2026-03-02");
    expect(slots.map((s) => s.prayer)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].endsAt.getTime()).toBeGreaterThan(slots[i].at.getTime());
      if (i > 0) expect(slots[i].at.getTime()).toBeGreaterThan(slots[i - 1].at.getTime());
    }
    expect(slots[1].endsAt.getTime()).toBe(slots[2].at.getTime());
    expect(slots[4].endsAt.getTime()).toBeGreaterThan(slots[4].at.getTime());
    expect(slots.every((s) => s.day === "2026-03-02")).toBe(true);
  });

  test("upcoming slots start strictly after now and cover several days", () => {
    const now = new Date("2026-03-02T05:00:00Z"); // 12:00 in Jakarta, around Dhuhr
    const slots = upcomingSlots(settings, jakarta, now, 7);
    expect(slots.every((s) => s.at.getTime() > now.getTime())).toBe(true);
    const days = new Set(slots.map((s) => s.day));
    expect(days.size).toBe(7);
    expect(slots[0].prayer === "dhuhr" || slots[0].prayer === "asr").toBe(true);
  });

  test("after Isha the next prayer is tomorrow's Fajr", () => {
    const now = new Date("2026-03-02T16:30:00Z"); // 23:30 in Jakarta
    const next = nextSlot(settings, jakarta, now);
    expect(next?.prayer).toBe("fajr");
    expect(next?.day).toBe("2026-03-03");
  });

  test("countdown rounds up to whole minutes", () => {
    expect(countdownParts(83 * 60_000 - 1)).toEqual({ hours: 1, minutes: 23 });
    expect(countdownParts(-5)).toEqual({ hours: 0, minutes: 0 });
    expect(countdownParts(60_000)).toEqual({ hours: 0, minutes: 1 });
  });
});
