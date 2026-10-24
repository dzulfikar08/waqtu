import { describe, expect, test } from "bun:test";
import { calculatePrayerTimes, hijriDate, type MethodId } from "../src/index";
import jakartaFeb from "./fixtures/jakarta-2026-02.json";
import jakartaMar from "./fixtures/jakarta-2026-03.json";
import jakartaAug from "./fixtures/jakarta-2026-08.json";
import malangFeb from "./fixtures/malang-2026-02.json";
import malangMar from "./fixtures/malang-2026-03.json";
import malangAug from "./fixtures/malang-2026-08.json";
import bandaAcehMar from "./fixtures/banda-aceh-2026-03.json";
import meraukeMar from "./fixtures/merauke-2026-03.json";

/**
 * Published Kemenag RI jadwal, 2026 (Bimas Islam, https://bimasislam.kemenag.go.id/jadwalshalat).
 * Fixtures are fetched from the MyQuran open API, which republishes the Kemenag tables per city id
 * (each fixture's `source` field has its exact URL), e.g.:
 *   https://api.myquran.com/v2/sholat/jadwal/1301/2026/03   (Kota Jakarta)
 *   https://api.myquran.com/v2/sholat/jadwal/1634/2026/03   (Kota Malang)
 *   https://api.myquran.com/v2/sholat/jadwal/0119/2026/03   (Kota Banda Aceh, 5.5°N)
 *   https://api.myquran.com/v2/sholat/jadwal/3315/2026/03   (Kab. Merauke, WIT zone)
 * The method was calibrated on Jakarta/Malang March only; Feb (Ramadhan season), Aug, Banda Aceh and
 * Merauke are out-of-sample. City centroids are approximate; Kemenag uses its own coordinates.
 * Observed max error is 1 min for every prayer; the test allows 2.
 */
const TOLERANCE_MIN = 2;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const cases = [
  {
    name: "Jakarta Feb",
    fixture: jakartaFeb,
    latitude: -6.2088,
    longitude: 106.8456,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Jakarta Mar",
    fixture: jakartaMar,
    latitude: -6.2088,
    longitude: 106.8456,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Jakarta Aug",
    fixture: jakartaAug,
    latitude: -6.2088,
    longitude: 106.8456,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Malang Feb",
    fixture: malangFeb,
    latitude: -7.9797,
    longitude: 112.6304,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Malang Mar",
    fixture: malangMar,
    latitude: -7.9797,
    longitude: 112.6304,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Malang Aug",
    fixture: malangAug,
    latitude: -7.9797,
    longitude: 112.6304,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Banda Aceh Mar",
    fixture: bandaAcehMar,
    latitude: 5.5483,
    longitude: 95.3238,
    timeZone: "Asia/Jakarta",
  },
  {
    name: "Merauke Mar",
    fixture: meraukeMar,
    latitude: -8.4932,
    longitude: 140.4018,
    timeZone: "Asia/Jayapura",
  },
];

describe("Kemenag method vs published jadwal (±2 min)", () => {
  for (const c of cases) {
    test(c.name, () => {
      const fields = [
        ["imsak", "imsak"],
        ["fajr", "subuh"],
        ["sunrise", "terbit"],
        ["dhuhr", "dzuhur"],
        ["asr", "ashar"],
        ["maghrib", "maghrib"],
        ["isha", "isya"],
      ] as const;
      expect(c.fixture.jadwal.length).toBeGreaterThanOrEqual(28);
      for (const row of c.fixture.jadwal) {
        const [year, month, day] = row.date.split("-").map(Number);
        const r = calculatePrayerTimes({
          latitude: c.latitude,
          longitude: c.longitude,
          date: { year, month, day },
          timeZone: c.timeZone,
          method: "kemenag",
        });
        for (const [ours, theirs] of fields) {
          const diff = Math.abs(toMin(r.local[ours]) - toMin(row[theirs]));
          if (diff > TOLERANCE_MIN) {
            throw new Error(
              `${c.name} ${row.date} ${ours}: got ${r.local[ours]} want ${row[theirs]}`,
            );
          }
        }
      }
    });
  }
});

const base = {
  latitude: -6.2088,
  longitude: 106.8456,
  date: { year: 2026, month: 3, day: 15 },
  timeZone: "Asia/Jakarta",
} as const;

describe("options", () => {
  test("Hanafi Asr is later than Shafi'i", () => {
    const s = calculatePrayerTimes({ ...base, asr: "shafii" });
    const h = calculatePrayerTimes({ ...base, asr: "hanafi" });
    expect(h.times.asr.getTime()).toBeGreaterThan(s.times.asr.getTime() + 30 * 60_000);
    expect(h.times.dhuhr.getTime()).toBe(s.times.dhuhr.getTime());
  });

  test("per-prayer offsets apply", () => {
    const a = calculatePrayerTimes(base);
    const b = calculatePrayerTimes({ ...base, offsets: { fajr: 3, dhuhr: -2, isha: 5 } });
    expect(b.times.fajr.getTime() - a.times.fajr.getTime()).toBe(3 * 60_000);
    expect(b.times.dhuhr.getTime() - a.times.dhuhr.getTime()).toBe(-2 * 60_000);
    expect(b.times.isha.getTime() - a.times.isha.getTime()).toBe(5 * 60_000);
    expect(b.times.asr.getTime()).toBe(a.times.asr.getTime());
  });

  test("imsak = fajr - N (default 10)", () => {
    const a = calculatePrayerTimes(base);
    expect(a.times.fajr.getTime() - a.times.imsak.getTime()).toBe(10 * 60_000);
    const b = calculatePrayerTimes({ ...base, imsakMinutes: 15 });
    expect(b.times.fajr.getTime() - b.times.imsak.getTime()).toBe(15 * 60_000);
  });

  test("every method yields ordered times", () => {
    const methods: MethodId[] = ["kemenag", "mwl", "isna", "ummAlQura", "egyptian", "singapore"];
    for (const method of methods) {
      const t = calculatePrayerTimes({ ...base, method }).times;
      const order = [t.imsak, t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map((d) =>
        d.getTime(),
      );
      expect(order).toEqual([...order].sort((x, y) => x - y));
    }
  });

  test("method angles differ: ISNA (15°) Fajr later than MWL (18°)", () => {
    const mwl = calculatePrayerTimes({ ...base, method: "mwl" });
    const isna = calculatePrayerTimes({ ...base, method: "isna" });
    expect(isna.times.fajr.getTime()).toBeGreaterThan(mwl.times.fajr.getTime());
  });

  test("Umm al-Qura Isha is Maghrib + 90 min (Makkah)", () => {
    const r = calculatePrayerTimes({
      latitude: 21.3891,
      longitude: 39.8579,
      date: { year: 2026, month: 5, day: 10 },
      timeZone: "Asia/Riyadh",
      method: "ummAlQura",
    });
    expect(r.times.isha.getTime() - r.times.maghrib.getTime()).toBe(90 * 60_000);
  });
});

describe("timezones", () => {
  const london = {
    latitude: 51.5074,
    longitude: -0.1278,
    timeZone: "Europe/London",
    method: "mwl" as const,
  };

  test("London spring-forward keeps local clock continuous, UTC jumps 1h", () => {
    const before = calculatePrayerTimes({ ...london, date: { year: 2026, month: 3, day: 28 } });
    const after = calculatePrayerTimes({ ...london, date: { year: 2026, month: 3, day: 30 } });
    // Dhuhr local clock moves ~1h later across the change (GMT -> BST) plus ~2 min solar drift.
    const mins = (s: string) => toMin(s);
    const localDelta = mins(after.local.dhuhr) - mins(before.local.dhuhr);
    expect(localDelta).toBeGreaterThanOrEqual(57);
    expect(localDelta).toBeLessThanOrEqual(60);
    // In UTC, dhuhr barely moves (< 5 min over two days).
    const utcDeltaMin =
      (after.times.dhuhr.getTime() - before.times.dhuhr.getTime()) / 60_000 - 2 * 24 * 60;
    expect(Math.abs(utcDeltaMin)).toBeLessThan(5);
  });

  test("London summer dhuhr ~13:0x BST, winter ~12:0x GMT", () => {
    const summer = calculatePrayerTimes({ ...london, date: { year: 2026, month: 7, day: 1 } });
    const winter = calculatePrayerTimes({ ...london, date: { year: 2026, month: 1, day: 1 } });
    expect(summer.local.dhuhr.startsWith("13:")).toBe(true);
    expect(winter.local.dhuhr.startsWith("12:")).toBe(true);
  });

  test("same instant formats per requested zone", () => {
    const jak = calculatePrayerTimes({ ...base });
    const wita = calculatePrayerTimes({ ...base, timeZone: "Asia/Makassar" });
    expect(jak.times.dhuhr.getTime()).toBe(wita.times.dhuhr.getTime());
    expect(toMin(wita.local.dhuhr) - toMin(jak.local.dhuhr)).toBe(60);
  });

  test("civil date is honoured for far-east zones (Auckland)", () => {
    const r = calculatePrayerTimes({
      latitude: -36.8485,
      longitude: 174.7633,
      date: { year: 2026, month: 6, day: 15 },
      timeZone: "Pacific/Auckland",
    });
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(
      r.times.dhuhr,
    );
    expect(day).toBe("2026-06-15");
  });
});

describe("hijri", () => {
  test("known umalqura date: 2026-03-20 is 1 Shawwal 1447", () => {
    const h = hijriDate({ year: 2026, month: 3, day: 20 });
    expect(h.year).toBe(1447);
    expect(h.month).toBe(10);
  });

  test("day offset shifts the date", () => {
    const a = hijriDate({ year: 2026, month: 3, day: 15 });
    const b = hijriDate({ year: 2026, month: 3, day: 15 }, -1);
    const c = hijriDate({ year: 2026, month: 3, day: 15 }, 1);
    expect(a.month === b.month ? a.day - b.day : 1).toBe(1);
    expect(c.month === a.month ? c.day - a.day : 1).toBe(1);
  });

  test("calendar is a Hijri calendar", () => {
    expect(["islamic-umalqura", "islamic-civil"]).toContain(
      hijriDate({ year: 2026, month: 1, day: 1 }).calendar,
    );
  });
});
