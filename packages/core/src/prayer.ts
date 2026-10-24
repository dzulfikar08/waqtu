import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  Rounding,
  PrayerTimes,
} from "adhan";

export type MethodId = "kemenag" | "mwl" | "isna" | "ummAlQura" | "egyptian" | "singapore";

export type AsrMadhab = "shafii" | "hanafi";

export type HighLatRule = "auto" | "middleOfTheNight" | "seventhOfTheNight" | "twilightAngle";

export type PrayerName = "imsak" | "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

/** Per-prayer user offsets in whole minutes (added on top of the method's own adjustments). */
export type PrayerOffsets = Partial<Record<PrayerName, number>>;

export interface CivilDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface PrayerTimesInput {
  latitude: number;
  longitude: number;
  /** Civil (calendar) date in `timeZone`. */
  date: CivilDate;
  /** IANA zone, e.g. "Asia/Jakarta". */
  timeZone: string;
  method?: MethodId;
  asr?: AsrMadhab;
  offsets?: PrayerOffsets;
  /** Imsak = Fajr - imsakMinutes (default 10). */
  imsakMinutes?: number;
  highLatitudeRule?: HighLatRule;
}

export interface PrayerTimesResult {
  date: CivilDate;
  timeZone: string;
  /** Absolute instants; null when the prayer does not occur (polar day/night). */
  times: Record<PrayerName, Date | null>;
  /** Wall-clock "HH:mm" in `timeZone`; null when the prayer does not occur. */
  local: Record<PrayerName, string | null>;
}

/**
 * Kemenag RI (Bimas Islam) parameters: Fajr 20°, Isha 18° (Pedoman Penentuan Jadwal Waktu
 * Shalat; published tables at https://bimasislam.kemenag.go.id/jadwalshalat), plus ihtiyat
 * (safety margin) of 2 minutes on Subuh/Zuhur/Ashar/Maghrib/Isya and -2 on Terbit.
 *
 * adhan computes sunrise/sunset/transit slightly differently from Kemenag's ephemeris
 * (fixed 0.833° horizon, no elevation dip, minute rounding), so the values below were
 * calibrated against the published March 2026 Jakarta and Malang tables with Rounding.Up:
 * Subuh, Ashar and Isya keep the documented +2; Zuhur/Maghrib need +3 and Terbit -4
 * (documented -2 plus the horizon difference). Residual vs the tables is within ±1 min.
 * Swift (apps/apple/parity) MUST use the same numbers.
 */
export const KEMENAG_IHTIYAT = {
  fajr: 2,
  sunrise: -4,
  dhuhr: 3,
  asr: 2,
  maghrib: 3,
  isha: 2,
} as const;

export const DEFAULT_IMSAK_MINUTES = 10;

function baseParams(method: MethodId): CalculationParameters {
  switch (method) {
    case "kemenag": {
      const p = CalculationMethod.Other();
      p.fajrAngle = 20;
      p.ishaAngle = 18;
      p.methodAdjustments = { ...KEMENAG_IHTIYAT };
      p.rounding = Rounding.Up;
      return p;
    }
    case "mwl":
      return CalculationMethod.MuslimWorldLeague();
    case "isna":
      return CalculationMethod.NorthAmerica();
    case "ummAlQura":
      return CalculationMethod.UmmAlQura();
    case "egyptian":
      return CalculationMethod.Egyptian();
    case "singapore":
      return CalculationMethod.Singapore();
  }
}

function resolveHighLat(rule: HighLatRule, c: Coordinates) {
  switch (rule) {
    case "auto":
      return HighLatitudeRule.recommended(c);
    case "middleOfTheNight":
      return HighLatitudeRule.MiddleOfTheNight;
    case "seventhOfTheNight":
      return HighLatitudeRule.SeventhOfTheNight;
    case "twilightAngle":
      return HighLatitudeRule.TwilightAngle;
  }
}

const MS_MIN = 60_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** "HH:mm" wall clock of an instant in an IANA zone. */
export function formatLocalTime(instant: Date, timeZone: string): string {
  return formatter(timeZone).format(instant);
}

export function calculatePrayerTimes(input: PrayerTimesInput): PrayerTimesResult {
  const { latitude, longitude, date, timeZone } = input;
  const coords = new Coordinates(latitude, longitude);
  const params = baseParams(input.method ?? "kemenag");
  params.madhab = input.asr === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = resolveHighLat(input.highLatitudeRule ?? "auto", coords);

  const o = input.offsets ?? {};
  params.adjustments = {
    fajr: o.fajr ?? 0,
    sunrise: o.sunrise ?? 0,
    dhuhr: o.dhuhr ?? 0,
    asr: o.asr ?? 0,
    maghrib: o.maghrib ?? 0,
    isha: o.isha ?? 0,
  };

  const run = (d: CivilDate) =>
    // adhan reads the civil date from the Date's local getters, so build it in local fields.
    new PrayerTimes(coords, new Date(d.year, d.month - 1, d.day, 12), params);

  // adhan returns UTC instants for the solar day of the date it is given; in zones far from
  // UTC (e.g. Pacific/Kiritimati) that day is a different civil day in `timeZone`. Find the
  // shift from a first pass, then recompute for the adjusted date so every astronomical input
  // (declination, equation of time, night length) belongs to the requested civil day.
  let pt = run(date);
  const dayShift = shiftToCivilDay(pt.dhuhr, date, timeZone);
  if (dayShift !== 0) {
    const adj = new Date(Date.UTC(date.year, date.month - 1, date.day + dayShift));
    pt = run({ year: adj.getUTCFullYear(), month: adj.getUTCMonth() + 1, day: adj.getUTCDate() });
  }

  // adhan-js leaves sub-second residue after minute rounding; snap to the exact minute.
  // Prayers that do not occur (polar day/night) come back as Invalid Date -> null.
  const at = (d: Date): Date | null =>
    Number.isNaN(d.getTime()) ? null : new Date(Math.round(d.getTime() / MS_MIN) * MS_MIN);

  const imsakMin = input.imsakMinutes ?? DEFAULT_IMSAK_MINUTES;
  const fajr = at(pt.fajr);
  const times: Record<PrayerName, Date | null> = {
    imsak: fajr && new Date(fajr.getTime() + ((o.imsak ?? 0) - imsakMin) * MS_MIN),
    fajr,
    sunrise: at(pt.sunrise),
    dhuhr: at(pt.dhuhr),
    asr: at(pt.asr),
    maghrib: at(pt.maghrib),
    isha: at(pt.isha),
  };
  const local = Object.fromEntries(
    (Object.keys(times) as PrayerName[]).map((k) => {
      const t = times[k];
      return [k, t && formatLocalTime(t, timeZone)];
    }),
  ) as Record<PrayerName, string | null>;
  return { date, timeZone, times, local };
}

/** Civil (calendar) date of an instant in an IANA zone. */
export function civilParts(instant: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function shiftToCivilDay(dhuhr: Date, want: CivilDate, timeZone: string): number {
  const got = civilParts(dhuhr, timeZone);
  const a = Date.UTC(got.year, got.month - 1, got.day);
  const b = Date.UTC(want.year, want.month - 1, want.day);
  return Math.round((b - a) / 86_400_000);
}
