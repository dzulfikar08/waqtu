import { calculatePrayerTimes, type PrayerTimesResult } from "@waqtu/core";

import { addDays, civilOf, dayKeyInZone, type DayKey } from "../mutabaah/dates";
import type { FardhId } from "../mutabaah/items";

import type { Location, PrayerSettings } from "./config";

export interface PrayerSlot {
  prayer: FardhId;
  at: Date;
  /** When the prayer's window closes (sunrise for Fajr, next prayer otherwise). */
  endsAt: Date;
  /** The civil day (in the location's zone) this prayer belongs to; the checklist entry's date. */
  day: DayKey;
}

export function timesFor(
  settings: PrayerSettings,
  location: Location,
  day: DayKey,
): PrayerTimesResult {
  return calculatePrayerTimes({
    latitude: location.latitude,
    longitude: location.longitude,
    date: civilOf(day),
    timeZone: location.timeZone,
    method: settings.method,
    asr: settings.asr,
    offsets: settings.offsets,
  });
}

/** The five fardh slots of `day`. A prayer that does not occur (polar latitudes) is skipped. */
export function slotsForDay(
  settings: PrayerSettings,
  location: Location,
  day: DayKey,
): PrayerSlot[] {
  const today = timesFor(settings, location, day).times;
  const nextFajr = timesFor(settings, location, addDays(day, 1)).times.fajr;
  const chain: [FardhId, Date | null, Date | null][] = [
    ["fajr", today.fajr, today.sunrise],
    ["dhuhr", today.dhuhr, today.asr],
    ["asr", today.asr, today.maghrib],
    ["maghrib", today.maghrib, today.isha],
    ["isha", today.isha, nextFajr],
  ];
  const slots: PrayerSlot[] = [];
  for (const [prayer, at, endsAt] of chain) {
    if (at && endsAt) slots.push({ prayer, at, endsAt, day });
  }
  return slots;
}

/** Slots strictly after `now` over the next `days` days (today included), in time order. */
export function upcomingSlots(
  settings: PrayerSettings,
  location: Location,
  now: Date,
  days: number,
): PrayerSlot[] {
  const first = dayKeyInZone(now, location.timeZone);
  const out: PrayerSlot[] = [];
  for (let i = 0; i < days; i++) {
    for (const slot of slotsForDay(settings, location, addDays(first, i))) {
      if (slot.at.getTime() > now.getTime()) out.push(slot);
    }
  }
  return out;
}

export function nextSlot(
  settings: PrayerSettings,
  location: Location,
  now: Date,
): PrayerSlot | null {
  return upcomingSlots(settings, location, now, 2)[0] ?? null;
}

/** "1 j 23 m" style pieces for a countdown: whole hours and minutes (rounded up), never negative. */
export function countdownParts(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
