import type { SQLiteDatabase } from "expo-sqlite";

import { emitDataChanged } from "@/db/events";
import { setLocalePref } from "@/db/settings";
import type { Locale } from "@/i18n/locale";
import { addDays, dayKeyInZone, type DayKey } from "@/mutabaah/dates";
import { PRAYER_KEYS } from "@/prayer/config";
import { CITIES } from "@/prayer/cities";
import { FLAG } from "@/mutabaah/items";

import { DEMO_NOW_MS, DEMO_TIME_ZONE } from "./mode";

const RAMADHAN_1448_START: DayKey = "2027-02-08";
const HIJRI_YEAR = 1448;
const DONE = FLAG.DONE | FLAG.ONTIME;
const DONE_JAMAAH = DONE | FLAG.JAMAAH;

/** Per day, back from today: the five prayers plus the optional practices a typical user ticks. */
const PAST_DAYS: readonly Record<string, number>[] = [
  {
    fajr: DONE_JAMAAH,
    dhuhr: DONE,
    asr: DONE_JAMAAH,
    maghrib: DONE_JAMAAH,
    isha: DONE_JAMAAH,
    rawatib: 1,
    dhuha: 1,
    tilawah: 22,
    dzikir_pagi: 1,
    dzikir_petang: 1,
    puasa: 1,
  },
  {
    fajr: DONE,
    dhuhr: DONE_JAMAAH,
    asr: DONE,
    maghrib: DONE_JAMAAH,
    isha: DONE,
    rawatib: 1,
    tilawah: 18,
    dzikir_pagi: 1,
    puasa: 1,
    sedekah: 1,
  },
  {
    fajr: DONE_JAMAAH,
    dhuhr: DONE,
    asr: DONE,
    maghrib: DONE_JAMAAH,
    isha: DONE_JAMAAH,
    dhuha: 1,
    tilawah: 20,
    dzikir_petang: 1,
    puasa: 1,
  },
  {
    fajr: DONE,
    dhuhr: DONE,
    asr: DONE_JAMAAH,
    maghrib: DONE_JAMAAH,
    isha: DONE,
    rawatib: 1,
    tilawah: 21,
    puasa: 1,
  },
  {
    fajr: DONE_JAMAAH,
    dhuhr: DONE_JAMAAH,
    asr: DONE,
    maghrib: DONE,
    isha: DONE_JAMAAH,
    dhuha: 1,
    tilawah: 10,
    dzikir_pagi: 1,
  },
  {
    fajr: DONE,
    dhuhr: DONE,
    asr: DONE,
    maghrib: DONE_JAMAAH,
    isha: DONE,
    tilawah: 5,
  },
];

const TODAY: Record<string, number> = {
  fajr: DONE_JAMAAH,
  dhuhr: DONE,
  asr: DONE_JAMAAH,
  dhuha: 1,
  tilawah: 12,
  dzikir_pagi: 1,
  puasa: 1,
};

/** Pages read per Ramadhan day, from day 1. */
const KHATAM_PAGES = [22, 18, 20, 21];

/**
 * Replaces everything on the device with deterministic demo data: Jakarta prayer times, a week of mutabaah ticks, Ramadhan day 5
 * with fasting/tarawih/tadarus checks and a khatam plan. Nothing is read from or sent to the network.
 */
export async function seedDemo(db: SQLiteDatabase, locale: Locale): Promise<void> {
  const jakarta = CITIES.find((c) => c.id === "jakarta");
  if (!jakarta) throw new Error("Jakarta missing from CITIES");
  const today = dayKeyInZone(new Date(DEMO_NOW_MS), DEMO_TIME_ZONE);

  const settings: Record<string, string> = {
    [PRAYER_KEYS.lat]: String(jakarta.latitude),
    [PRAYER_KEYS.lon]: String(jakarta.longitude),
    [PRAYER_KEYS.tz]: jakarta.timeZone,
    [PRAYER_KEYS.locationName]: jakarta.name,
    [PRAYER_KEYS.locationAt]: String(DEMO_NOW_MS),
    [PRAYER_KEYS.method]: "kemenag",
    locationSource: "manual",
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of [
      "entries",
      "settings",
      "ramadhan_daily",
      "ramadhan_khatam",
      "ramadhan_khatam_log",
      "ramadhan_qadha",
    ]) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }

    const put = async (day: DayKey, itemId: string, value: number) =>
      tx.runAsync(
        "INSERT INTO entries (date, item_id, value, updated_at, dirty) VALUES (?, ?, ?, ?, 0)",
        day,
        itemId,
        value,
        DEMO_NOW_MS,
      );
    for (const [item, value] of Object.entries(TODAY)) await put(today, item, value);
    for (const [i, ticks] of PAST_DAYS.entries()) {
      for (const [item, value] of Object.entries(ticks))
        await put(addDays(today, -(i + 1)), item, value);
    }

    for (let i = 0; i < 5; i++) {
      const day = addDays(RAMADHAN_1448_START, i);
      const past = day !== today;
      await tx.runAsync(
        "INSERT INTO ramadhan_daily (date, puasa, tarawih, tadarus, itikaf) VALUES (?, 1, ?, ?, 0)",
        day,
        past && i !== 2 ? 1 : 0,
        past || i === 4 ? 1 : 0,
      );
    }
    await tx.runAsync(
      "INSERT INTO ramadhan_khatam (hijri_year, target, start_date) VALUES (?, 1, ?)",
      HIJRI_YEAR,
      RAMADHAN_1448_START,
    );
    for (const [i, pages] of KHATAM_PAGES.entries()) {
      await tx.runAsync(
        "INSERT INTO ramadhan_khatam_log (date, pages) VALUES (?, ?)",
        addDays(RAMADHAN_1448_START, i),
        pages,
      );
    }
    await tx.runAsync(
      "INSERT INTO ramadhan_qadha (kind, count, date) VALUES ('owed', 3, '2027-01-20')",
    );
    await tx.runAsync(
      "INSERT INTO ramadhan_qadha (kind, count, date) VALUES ('made_up', 1, '2027-01-28')",
    );
    for (const [key, value] of Object.entries(settings)) {
      await tx.runAsync(
        "INSERT INTO settings (key, value, updated_at, dirty) VALUES (?, ?, ?, 0)",
        key,
        value,
        DEMO_NOW_MS,
      );
    }
  });

  await setLocalePref(db, locale);
  emitDataChanged();
}
