import { describe, expect, test } from "bun:test";
import {
  addDays,
  calculatePrayerTimes,
  currentOrNextRamadhan,
  diffDays,
  fastingCountdown,
  fidyah,
  hijriMonthLength,
  hijriMonthStart,
  imsakiyahTable,
  isLastTenNights,
  isOddNight,
  isRamadhan,
  isRamadhanSeason,
  khatamPlan,
  ramadhanDay,
  zakatFitrah,
  type CivilDate,
  type KhatamPlanInput,
} from "../src/index";

const d = (year: number, month: number, day: number): CivilDate => ({ year, month, day });

// Umm al-Qura: 1 Ramadhan 1447 = 18 Feb 2026, 1 Shawwal = 20 Mar 2026; 1 Ramadhan 1448 = 8 Feb 2027.
describe("civil date helpers", () => {
  test("addDays crosses month, year and leap day", () => {
    expect(addDays(d(2026, 12, 31), 1)).toEqual(d(2027, 1, 1));
    expect(addDays(d(2028, 2, 28), 1)).toEqual(d(2028, 2, 29));
    expect(addDays(d(2026, 3, 1), -1)).toEqual(d(2026, 2, 28));
  });
  test("diffDays is signed", () => {
    expect(diffDays(d(2026, 2, 18), d(2026, 3, 20))).toBe(30);
    expect(diffDays(d(2026, 3, 20), d(2026, 2, 18))).toBe(-30);
    expect(diffDays(d(2026, 3, 8), d(2026, 3, 8))).toBe(0);
  });
});

describe("isRamadhan boundaries", () => {
  test("first and last day of Ramadhan 1447, and the days around them", () => {
    expect(isRamadhan(d(2026, 2, 17))).toBe(false);
    expect(isRamadhan(d(2026, 2, 18))).toBe(true);
    expect(isRamadhan(d(2026, 3, 19))).toBe(true);
    expect(isRamadhan(d(2026, 3, 20))).toBe(false);
  });
  test("a -1 offset (Indonesia lagging Umm al-Qura) shifts both boundaries by one day", () => {
    expect(isRamadhan(d(2026, 2, 18), -1)).toBe(false);
    expect(isRamadhan(d(2026, 2, 19), -1)).toBe(true);
    expect(isRamadhan(d(2026, 3, 20), -1)).toBe(true);
    expect(isRamadhan(d(2026, 3, 21), -1)).toBe(false);
  });
  test("a 29-day Ramadhan 1448 ends 8 Mar 2027", () => {
    expect(isRamadhan(d(2027, 2, 7))).toBe(false);
    expect(isRamadhan(d(2027, 2, 8))).toBe(true);
    expect(isRamadhan(d(2027, 3, 8))).toBe(true);
    expect(isRamadhan(d(2027, 3, 9))).toBe(false);
  });
  test("ramadhanDay numbers the days, null outside", () => {
    expect(ramadhanDay(d(2026, 2, 18))).toBe(1);
    expect(ramadhanDay(d(2026, 3, 19))).toBe(30);
    expect(ramadhanDay(d(2026, 3, 20))).toBeNull();
  });
});

describe("hijri month helpers", () => {
  test("month start agrees with hijriDate and offsets", () => {
    expect(hijriMonthStart(1447, 9)).toEqual(d(2026, 2, 18));
    expect(hijriMonthStart(1447, 9, -1)).toEqual(d(2026, 2, 19));
    expect(hijriMonthStart(1448, 9)).toEqual(d(2027, 2, 8));
  });
  test("month lengths", () => {
    expect(hijriMonthLength(1447, 9)).toBe(30);
    expect(hijriMonthLength(1448, 9)).toBe(29);
    // December month wraps into the next Hijri year.
    expect([29, 30]).toContain(hijriMonthLength(1447, 12));
  });
  test("rejects an invalid month", () => {
    expect(() => hijriMonthStart(1447, 13)).toThrow(RangeError);
  });
  test("currentOrNextRamadhan before, during and after", () => {
    const next = currentOrNextRamadhan(d(2026, 10, 24));
    expect(next).toEqual({
      hijriYear: 1448,
      start: d(2027, 2, 8),
      end: d(2027, 3, 8),
      eid: d(2027, 3, 9),
    });
    expect(currentOrNextRamadhan(d(2026, 3, 1)).start).toEqual(d(2026, 2, 18));
    expect(currentOrNextRamadhan(d(2026, 3, 20)).hijriYear).toBe(1448);
  });
});

describe("isRamadhanSeason", () => {
  test("starts 7 days before Ramadhan and ends with it", () => {
    expect(isRamadhanSeason(d(2027, 1, 31))).toBe(false); // 8 days before
    expect(isRamadhanSeason(d(2027, 2, 1))).toBe(true); // 7 days before
    expect(isRamadhanSeason(d(2027, 2, 8))).toBe(true);
    expect(isRamadhanSeason(d(2027, 3, 8))).toBe(true);
    expect(isRamadhanSeason(d(2027, 3, 9))).toBe(false);
  });
  test("honours the offset", () => {
    expect(isRamadhanSeason(d(2027, 2, 1), -1)).toBe(false);
    expect(isRamadhanSeason(d(2027, 2, 2), -1)).toBe(true);
  });
});

describe("last ten nights", () => {
  test("day 20 daytime is outside, day 20 after maghrib is night 21", () => {
    const day20 = addDays(hijriMonthStart(1447, 9), 19);
    expect(isLastTenNights(day20)).toBe(false);
    expect(isLastTenNights(day20, 0, true)).toBe(true);
    expect(isLastTenNights(addDays(day20, 1))).toBe(true);
  });
  test("the evening of the last day is Eid night, not a Ramadhan night", () => {
    const last = d(2026, 3, 19);
    expect(isLastTenNights(last)).toBe(true);
    expect(isLastTenNights(last, 0, true)).toBe(false);
  });
  test("outside Ramadhan is false", () => {
    expect(isLastTenNights(d(2026, 6, 1))).toBe(false);
  });
  test("odd nights", () => {
    expect([20, 21, 22, 23, 25, 27, 29, 30].filter(isOddNight)).toEqual([21, 23, 25, 27, 29]);
  });
});

describe("imsakiyahTable", () => {
  const jakarta = {
    latitude: -6.2088,
    longitude: 106.8456,
    timeZone: "Asia/Jakarta",
    hijriYear: 1447,
  };
  const rows = imsakiyahTable(jakarta);

  test("covers every day of Ramadhan 1447, numbered 1..30", () => {
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.hijriDay)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(rows[0].date).toEqual(d(2026, 2, 18));
    expect(rows[29].date).toEqual(d(2026, 3, 19));
  });
  test("each row equals calculatePrayerTimes for that civil date", () => {
    const direct = calculatePrayerTimes({ ...jakarta, date: rows[9].date });
    expect(rows[9].local).toEqual(direct.local);
    expect(rows[9].times.maghrib).toEqual(direct.times.maghrib);
  });
  test("imsak precedes fajr by 10 minutes", () => {
    for (const r of rows) {
      expect(+r.times.fajr! - +r.times.imsak!).toBe(600_000);
    }
  });
  test("offset moves the table and a 29-day month has 29 rows", () => {
    expect(imsakiyahTable({ ...jakarta, hijriOffset: -1 })[0].date).toEqual(d(2026, 2, 19));
    expect(imsakiyahTable({ ...jakarta, hijriYear: 1448 })).toHaveLength(29);
  });
  test("other Hijri months work", () => {
    const shawwal = imsakiyahTable({ ...jakarta, hijriMonth: 10 });
    expect(shawwal[0].date).toEqual(d(2026, 3, 20));
  });
});

describe("fastingCountdown", () => {
  const loc = { latitude: -6.2088, longitude: 106.8456, timeZone: "Asia/Jakarta" };
  const today = calculatePrayerTimes({ ...loc, date: d(2026, 2, 20) });
  const tomorrow = calculatePrayerTimes({ ...loc, date: d(2026, 2, 21) });
  const at = (ms: number) => new Date(ms);

  test("before imsak: sahur countdown to imsak", () => {
    const now = at(+today.times.imsak! - 5 * 60_000);
    expect(fastingCountdown(now, today, tomorrow)).toEqual({
      phase: "sahur",
      target: "imsak",
      at: today.times.imsak!,
      msRemaining: 300_000,
    });
  });
  test("at imsak exactly: switches to fasting until maghrib", () => {
    const r = fastingCountdown(today.times.imsak!, today, tomorrow)!;
    expect(r.phase).toBe("fasting");
    expect(r.target).toBe("maghrib");
    expect(r.at).toEqual(today.times.maghrib!);
  });
  test("after maghrib: counts to tomorrow's imsak", () => {
    const r = fastingCountdown(at(+today.times.maghrib! + 1), today, tomorrow)!;
    expect(r.phase).toBe("sahur");
    expect(r.at).toEqual(tomorrow.times.imsak!);
  });
  test("null when a needed time does not occur", () => {
    const polar = { times: { ...today.times, maghrib: null, imsak: null } };
    expect(fastingCountdown(at(+today.times.dhuhr!), polar, { times: polar.times })).toBeNull();
  });
});

describe("khatamPlan", () => {
  const start = d(2027, 2, 8);
  const end = d(2027, 3, 8); // 29 days
  const plan = (over: Partial<KhatamPlanInput>) =>
    khatamPlan({
      targetKhatam: 1,
      start,
      end,
      today: start,
      pagesReadBeforeToday: 0,
      ...over,
    });

  test("one khatam over 29 days is 21 pages a day (604 / 29, rounded up)", () => {
    const p = plan({});
    expect(p.totalPages).toBe(604);
    expect(p.daysLeft).toBe(29);
    expect(p.dailyTarget).toBe(21);
    expect(p.originalDailyTarget).toBe(21);
    expect(p.pagesBehind).toBe(0);
    expect(p.rebalanced).toBe(false);
    expect(p.dailyJuz).toBeCloseTo(21 / (604 / 30));
  });
  test("target scales with the number of khatam", () => {
    expect(plan({ targetKhatam: 3 }).dailyTarget).toBe(Math.ceil(1812 / 29));
  });
  test("on schedule keeps the target", () => {
    const p = plan({ today: addDays(start, 10), pagesReadBeforeToday: 210 });
    expect(p.daysLeft).toBe(19);
    expect(p.pagesBehind).toBe(0);
    expect(p.dailyTarget).toBe(21);
    expect(p.rebalanced).toBe(false);
  });
  test("behind schedule rebalances the remaining days", () => {
    // Day 11 of 29, only 100 of the expected 210 pages read.
    const p = plan({ today: addDays(start, 10), pagesReadBeforeToday: 100 });
    expect(p.pagesRemaining).toBe(504);
    expect(p.daysLeft).toBe(19);
    expect(p.dailyTarget).toBe(Math.ceil(504 / 19)); // 27
    expect(p.expectedPagesBeforeToday).toBe(210);
    expect(p.pagesBehind).toBe(110);
    expect(p.rebalanced).toBe(true);
  });
  test("ahead of schedule lowers the daily target", () => {
    const p = plan({ today: addDays(start, 10), pagesReadBeforeToday: 400 });
    expect(p.dailyTarget).toBe(Math.ceil(204 / 19));
    expect(p.pagesBehind).toBe(0);
    expect(p.rebalanced).toBe(false);
  });
  test("today's progress reduces what is left today without moving the target", () => {
    const p = plan({ today: addDays(start, 10), pagesReadBeforeToday: 100, pagesReadToday: 10 });
    expect(p.dailyTarget).toBe(27);
    expect(p.todayRemaining).toBe(17);
    expect(p.pagesRead).toBe(110);
    expect(p.pagesRemaining).toBe(494);
    expect(plan({ pagesReadToday: 50 }).todayRemaining).toBe(0);
  });
  test("last day: everything left is due today", () => {
    const p = plan({ today: end, pagesReadBeforeToday: 560 });
    expect(p.daysLeft).toBe(1);
    expect(p.dailyTarget).toBe(44);
  });
  test("plan over: no days left, remaining pages are the shortfall", () => {
    const p = plan({ today: addDays(end, 1), pagesReadBeforeToday: 600 });
    expect(p.daysLeft).toBe(0);
    expect(p.dailyTarget).toBe(4);
    expect(p.completed).toBe(false);
  });
  test("before the start date the whole span is still ahead", () => {
    const p = plan({ today: addDays(start, -3) });
    expect(p.daysLeft).toBe(29);
    expect(p.pagesBehind).toBe(0);
  });
  test("completed once all pages are read, never negative", () => {
    const p = plan({ today: addDays(start, 5), pagesReadBeforeToday: 700 });
    expect(p.completed).toBe(true);
    expect(p.pagesRemaining).toBe(0);
    expect(p.dailyTarget).toBe(0);
  });
  test("rejects bad input", () => {
    expect(() => plan({ targetKhatam: 0 })).toThrow(RangeError);
    expect(() => plan({ targetKhatam: 1.5 })).toThrow(RangeError);
    expect(() => plan({ pagesReadBeforeToday: -1 })).toThrow(RangeError);
    expect(() => plan({ end: addDays(start, -1) })).toThrow(RangeError);
  });
});

describe("fidyah", () => {
  test("defaults to one mud (0.75 kg) of rice per missed day", () => {
    expect(fidyah(10, { kind: "rice" })).toEqual({ units: 10, riceKg: 7.5, amount: null });
  });
  test("rice with a price gives a cash equivalent", () => {
    expect(fidyah(4, { kind: "rice", pricePerKg: 15_000 })).toEqual({
      units: 4,
      riceKg: 3,
      amount: 45_000,
    });
  });
  test("custom measure (Hanafi, 2 mud)", () => {
    expect(fidyah(3, { kind: "rice", kgPer: 1.5 }).riceKg).toBe(4.5);
  });
  test("flat cash per day", () => {
    expect(fidyah(7, { kind: "cash", amount: 60_000 })).toEqual({
      units: 7,
      riceKg: null,
      amount: 420_000,
    });
  });
  test("zero days is zero", () => {
    expect(fidyah(0, { kind: "cash", amount: 60_000 }).amount).toBe(0);
  });
  test("rejects bad input", () => {
    expect(() => fidyah(-1, { kind: "rice" })).toThrow(RangeError);
    expect(() => fidyah(1.5, { kind: "rice" })).toThrow(RangeError);
    expect(() => fidyah(1, { kind: "cash", amount: -5 })).toThrow(RangeError);
    expect(() => fidyah(1, { kind: "rice", kgPer: 0 })).toThrow(RangeError);
  });
});

describe("zakatFitrah", () => {
  test("2.5 kg or 3.5 L of rice per person", () => {
    expect(zakatFitrah(4, { kind: "rice" })).toEqual({
      units: 4,
      riceKg: 10,
      riceLiters: 14,
      amount: null,
    });
  });
  test("rice priced per kg", () => {
    const z = zakatFitrah(5, { kind: "rice", pricePerKg: 20_000 });
    expect(z.riceKg).toBe(12.5);
    expect(z.amount).toBe(250_000);
  });
  test("flat cash per person (BAZNAS Rp50.000)", () => {
    expect(zakatFitrah(3, { kind: "cash", amount: 50_000 })).toEqual({
      units: 3,
      riceKg: null,
      riceLiters: null,
      amount: 150_000,
    });
  });
  test("a single member and an empty household", () => {
    expect(zakatFitrah(1, { kind: "rice" }).riceLiters).toBe(3.5);
    expect(zakatFitrah(0, { kind: "rice" }).riceKg).toBe(0);
  });
  test("rejects a fractional household", () => {
    expect(() => zakatFitrah(2.5, { kind: "rice" })).toThrow(RangeError);
  });
});
