import { hijriDate, type HijriDate } from "./hijri";
import {
  calculatePrayerTimes,
  type CivilDate,
  type PrayerName,
  type PrayerTimesInput,
  type PrayerTimesResult,
} from "./prayer";

/** Hijri month number of Ramadhan. */
export const RAMADHAN_MONTH = 9;

const MS_DAY = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Civil date helpers

/** `date` shifted by `days` (may be negative) on the proleptic Gregorian calendar. */
export function addDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Whole days from `from` to `to` (`to - from`); negative when `to` is earlier. */
export function diffDays(from: CivilDate, to: CivilDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / MS_DAY);
}

// ---------------------------------------------------------------------------------------------
// Hijri calendar

function compareHijri(a: Pick<HijriDate, "year" | "month" | "day">, y: number, m: number): number {
  return a.year - y || a.month - m || a.day - 1;
}

// Days from 1970-01-01 to the Islamic civil epoch (JDN 1948440 minus JDN 2440588).
const ISLAMIC_EPOCH_DAYS = 1948440 - 2440588;

/**
 * Civil date of the first day of Hijri `year`/`month`, using the same calendar and `hijriOffset`
 * as `hijriDate` so the two always agree.
 */
export function hijriMonthStart(year: number, month: number, hijriOffset = 0): CivilDate {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid Hijri month ${year}-${month}`);
  }
  // The tabular calendar is within ~2 days of any observational one: start there and walk.
  const guess = Math.floor((year - 1) * 354.367 + (month - 1) * 29.5306) + ISLAMIC_EPOCH_DAYS;
  const origin = new Date(guess * MS_DAY);
  let date: CivilDate = {
    year: origin.getUTCFullYear(),
    month: origin.getUTCMonth() + 1,
    day: origin.getUTCDate(),
  };
  for (let i = 0; i < 12; i++) {
    const cmp = compareHijri(hijriDate(date, hijriOffset), year, month);
    if (cmp === 0) return date;
    date = addDays(date, cmp < 0 ? 1 : -1);
  }
  throw new Error(`Could not locate Hijri ${year}-${month}-1`);
}

/** Number of days (29 or 30) in a Hijri month. */
export function hijriMonthLength(year: number, month: number, hijriOffset = 0): number {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return diffDays(
    hijriMonthStart(year, month, hijriOffset),
    hijriMonthStart(next.year, next.month, hijriOffset),
  );
}

/** True when `date` falls in Ramadhan under the given moon-sighting `hijriOffset` (days). */
export function isRamadhan(date: CivilDate, hijriOffset = 0): boolean {
  return hijriDate(date, hijriOffset).month === RAMADHAN_MONTH;
}

/** 1-based day of Ramadhan for `date`, or null outside Ramadhan. */
export function ramadhanDay(date: CivilDate, hijriOffset = 0): number | null {
  const h = hijriDate(date, hijriOffset);
  return h.month === RAMADHAN_MONTH ? h.day : null;
}

export interface RamadhanSpan {
  hijriYear: number;
  /** First day of fasting. */
  start: CivilDate;
  /** Last day of fasting (29th or 30th Ramadhan). */
  end: CivilDate;
  /** 1 Shawwal. */
  eid: CivilDate;
}

/** The Ramadhan that contains `date`, or else the next one to start. */
export function currentOrNextRamadhan(date: CivilDate, hijriOffset = 0): RamadhanSpan {
  const h = hijriDate(date, hijriOffset);
  const hijriYear = h.month <= RAMADHAN_MONTH ? h.year : h.year + 1;
  const start = hijriMonthStart(hijriYear, RAMADHAN_MONTH, hijriOffset);
  const eid = hijriMonthStart(hijriYear, RAMADHAN_MONTH + 1, hijriOffset);
  return { hijriYear, start, end: addDays(eid, -1), eid };
}

/**
 * Whether the Ramadhan tab should show: during Ramadhan, and `leadDays` (default 7) before it starts.
 */
export function isRamadhanSeason(date: CivilDate, hijriOffset = 0, leadDays = 7): boolean {
  return isRamadhan(date, hijriOffset) || isRamadhan(addDays(date, leadDays), hijriOffset);
}

/**
 * Last-ten-nights mode (nights 21-30, where Laylatul Qadr is sought). The Hijri day begins at
 * maghrib, so pass `afterMaghrib` once the evening has started: night 21 begins at maghrib on day 20.
 */
export function isLastTenNights(date: CivilDate, hijriOffset = 0, afterMaghrib = false): boolean {
  const h = hijriDate(afterMaghrib ? addDays(date, 1) : date, hijriOffset);
  return h.month === RAMADHAN_MONTH && h.day >= 21;
}

/** Odd nights of the last ten (21, 23, 25, 27, 29) are the likeliest for Laylatul Qadr. */
export function isOddNight(night: number): boolean {
  return night >= 21 && night <= 29 && night % 2 === 1;
}

// ---------------------------------------------------------------------------------------------
// Imsakiyah

export interface ImsakiyahInput extends Omit<PrayerTimesInput, "date"> {
  hijriYear: number;
  /** Defaults to Ramadhan (9). */
  hijriMonth?: number;
  /** Moon-sighting correction in days, as in `hijriDate`. */
  hijriOffset?: number;
}

export interface ImsakiyahRow {
  /** 1-based day of the Hijri month. */
  hijriDay: number;
  date: CivilDate;
  times: PrayerTimesResult["times"];
  /** Wall-clock "HH:mm" in the location's zone. */
  local: PrayerTimesResult["local"];
}

/** Prayer-time table for every day of a Hijri month at a location (Ramadhan by default). */
export function imsakiyahTable(input: ImsakiyahInput): ImsakiyahRow[] {
  const { hijriYear, hijriMonth = RAMADHAN_MONTH, hijriOffset = 0, ...location } = input;
  const start = hijriMonthStart(hijriYear, hijriMonth, hijriOffset);
  const length = hijriMonthLength(hijriYear, hijriMonth, hijriOffset);
  const rows: ImsakiyahRow[] = [];
  for (let i = 0; i < length; i++) {
    const date = addDays(start, i);
    const { times, local } = calculatePrayerTimes({ ...location, date });
    rows.push({ hijriDay: i + 1, date, times, local });
  }
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Sahur / iftar countdown

export interface FastingCountdown {
  /** `sahur`: eating allowed until imsak; `fasting`: waiting for maghrib. */
  phase: "sahur" | "fasting";
  target: Extract<PrayerName, "imsak" | "maghrib">;
  at: Date;
  msRemaining: number;
}

/**
 * What to count down to at `now`: imsak until it passes, then maghrib (iftar), then tomorrow's imsak.
 * `today` and `tomorrow` are the prayer times of the civil days around `now`. Null when a needed
 * time does not occur (polar latitudes).
 */
export function fastingCountdown(
  now: Date,
  today: Pick<PrayerTimesResult, "times">,
  tomorrow: Pick<PrayerTimesResult, "times">,
): FastingCountdown | null {
  const imsak = today.times.imsak;
  const maghrib = today.times.maghrib;
  const nextImsak = tomorrow.times.imsak;
  let pick: Pick<FastingCountdown, "phase" | "target"> & { at: Date | null };
  if (imsak && now < imsak) pick = { phase: "sahur", target: "imsak", at: imsak };
  else if (maghrib && now < maghrib) pick = { phase: "fasting", target: "maghrib", at: maghrib };
  else pick = { phase: "sahur", target: "imsak", at: nextImsak };
  if (!pick.at) return null;
  return { phase: pick.phase, target: pick.target, at: pick.at, msRemaining: +pick.at - +now };
}

// ---------------------------------------------------------------------------------------------
// Khatam planner

/** Pages in the standard Madinah mushaf. */
export const QURAN_PAGES = 604;
export const QURAN_JUZ = 30;

export interface KhatamPlanInput {
  /** How many full readings to finish, >= 1. */
  targetKhatam: number;
  /** First day of the plan. */
  start: CivilDate;
  /** Last day of the plan, inclusive (e.g. the last day of Ramadhan). */
  end: CivilDate;
  today: CivilDate;
  /** Total pages read since the plan began, before today. */
  pagesReadBeforeToday: number;
  /** Pages read so far today. */
  pagesReadToday?: number;
  /** Mushaf size; defaults to 604. */
  pagesPerKhatam?: number;
}

export interface KhatamPlan {
  totalPages: number;
  pagesRead: number;
  pagesRemaining: number;
  /** Days left to read, counting today (0 once the plan has ended). */
  daysLeft: number;
  /** Pages to read each remaining day, recomputed from what is left. */
  dailyTarget: number;
  /** The target the plan started with: total pages spread over the whole span. */
  originalDailyTarget: number;
  /** Pages still to read today to hit `dailyTarget`. */
  todayRemaining: number;
  /** Pages that should be read before today to be exactly on the original schedule. */
  expectedPagesBeforeToday: number;
  /** Pages short of the original schedule before today (0 when on or ahead). */
  pagesBehind: number;
  /** Rebalanced `dailyTarget` is higher than the original because of earlier shortfall. */
  rebalanced: boolean;
  completed: boolean;
  /** `dailyTarget` expressed in juz (a juz is `pagesPerKhatam / 30` pages). */
  dailyJuz: number;
}

export function khatamPlan(input: KhatamPlanInput): KhatamPlan {
  const { targetKhatam, start, end, today, pagesReadBeforeToday, pagesReadToday = 0 } = input;
  const pagesPerKhatam = input.pagesPerKhatam ?? QURAN_PAGES;
  if (!Number.isInteger(targetKhatam) || targetKhatam < 1) {
    throw new RangeError("targetKhatam must be a positive integer");
  }
  if (!Number.isInteger(pagesPerKhatam) || pagesPerKhatam < 1) {
    throw new RangeError("pagesPerKhatam must be a positive integer");
  }
  if (pagesReadBeforeToday < 0 || pagesReadToday < 0) {
    throw new RangeError("pages read cannot be negative");
  }
  const totalDays = diffDays(start, end) + 1;
  if (totalDays < 1) throw new RangeError("end is before start");

  const totalPages = targetKhatam * pagesPerKhatam;
  const before = Math.min(pagesReadBeforeToday, totalPages);
  const remaining = totalPages - before;
  const elapsed = Math.min(Math.max(diffDays(start, today), 0), totalDays);
  const daysLeft = totalDays - elapsed;
  const originalDailyTarget = Math.ceil(totalPages / totalDays);
  const expectedPagesBeforeToday = Math.min(totalPages, originalDailyTarget * elapsed);
  const dailyTarget = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const pagesRead = Math.min(before + pagesReadToday, totalPages);
  return {
    totalPages,
    pagesRead,
    pagesRemaining: totalPages - pagesRead,
    daysLeft,
    dailyTarget,
    originalDailyTarget,
    todayRemaining: Math.max(0, dailyTarget - pagesReadToday),
    expectedPagesBeforeToday,
    pagesBehind: Math.max(0, expectedPagesBeforeToday - before),
    rebalanced: dailyTarget > originalDailyTarget,
    completed: pagesRead >= totalPages,
    dailyJuz: dailyTarget / (pagesPerKhatam / QURAN_JUZ),
  };
}

// ---------------------------------------------------------------------------------------------
// Fidyah and zakat fitrah

/** One mud of staple food, ~0.75 kg of rice (Shafi'i/Maliki), as BAZNAS RI publishes it. */
export const FIDYAH_MUD_RICE_KG = 0.75;
/** Zakat fitrah per person: 2.5 kg (or 3.5 L) of rice / staple food (BAZNAS SE 2/2018). */
export const ZAKAT_FITRAH_RICE_KG = 2.5;
export const ZAKAT_FITRAH_RICE_LITERS = 3.5;

/**
 * How an obligation is settled: in rice (optionally priced per kg for a cash equivalent) or a flat
 * cash `amount` per unit (per missed day for fidyah, per person for zakat). Cash rates are set by the
 * local zakat body (BAZNAS) each year, so they are always supplied by the caller.
 */
export type Rate =
  | { kind: "rice"; kgPer?: number; pricePerKg?: number }
  | { kind: "cash"; amount: number };

export interface Settlement {
  /** Number of missed days (fidyah) or people (zakat). */
  units: number;
  /** Rice to hand over; null for a cash rate. */
  riceKg: number | null;
  /** Cash total: flat for a cash rate, `riceKg × pricePerKg` for priced rice, else null. */
  amount: number | null;
}

function checkUnits(units: number, what: string): void {
  if (!Number.isInteger(units) || units < 0) throw new RangeError(`${what} must be a whole number`);
}

function settle(units: number, rate: Rate, defaultKgPer: number): Settlement {
  if (rate.kind === "cash") {
    if (!(rate.amount >= 0)) throw new RangeError("cash amount must be >= 0");
    return { units, riceKg: null, amount: units * rate.amount };
  }
  const kgPer = rate.kgPer ?? defaultKgPer;
  if (!(kgPer > 0)) throw new RangeError("rice kg must be > 0");
  const riceKg = round3(units * kgPer);
  if (rate.pricePerKg === undefined) return { units, riceKg, amount: null };
  if (!(rate.pricePerKg >= 0)) throw new RangeError("pricePerKg must be >= 0");
  return { units, riceKg, amount: Math.round(riceKg * rate.pricePerKg) };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Fidyah for `missedDays` fasts that cannot be made up: one mud of food (default 0.75 kg of rice,
 * override `kgPer` for another madhhab's measure) or its cash value, per day.
 */
export function fidyah(missedDays: number, rate: Rate): Settlement {
  checkUnits(missedDays, "missedDays");
  return settle(missedDays, rate, FIDYAH_MUD_RICE_KG);
}

export interface ZakatFitrah extends Settlement {
  /** The volume equivalent of `riceKg`, 3.5 L per person; null for a cash rate. */
  riceLiters: number | null;
}

/** Zakat fitrah for a household: 2.5 kg of rice per person by default, or a flat cash amount. */
export function zakatFitrah(members: number, rate: Rate): ZakatFitrah {
  checkUnits(members, "members");
  const s = settle(members, rate, ZAKAT_FITRAH_RICE_KG);
  const riceLiters =
    s.riceKg === null ? null : round3((s.riceKg / ZAKAT_FITRAH_RICE_KG) * ZAKAT_FITRAH_RICE_LITERS);
  return { ...s, riceLiters };
}
