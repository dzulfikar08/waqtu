import type { SQLiteDatabase } from "expo-sqlite";

import { readPrayerSettings, type PrayerSettings } from "../prayer/config";
import { addDays, dayKeyInZone, type DayKey } from "../mutabaah/dates";
import { parseItems, type ItemDef } from "../mutabaah/items";
import {
  computeStreak,
  countedDays,
  parseStreakConfig,
  type StreakConfig,
  type StreakResult,
} from "../mutabaah/streak";
import { ITEMS_KEY, STREAK_KEY } from "../mutabaah/syncKeys";
import { summarizeWeek, type WeekSummary } from "../mutabaah/week";
import { getEntriesBetween, getRecordedSince } from "./entries";
import { getSetting } from "./settings";

/** How far back streaks look. Two years is far beyond any realistic streak and keeps the query small. */
const STREAK_HISTORY_DAYS = 730;

export interface MutabaahModel {
  settings: PrayerSettings;
  items: ItemDef[];
  streakConfig: StreakConfig;
  /** Today in the prayer location's zone (device zone until a location is set). */
  today: DayKey;
  todayEntries: Map<string, number>;
  streak: StreakResult;
  week: WeekSummary;
}

export async function loadModel(db: SQLiteDatabase, now: Date): Promise<MutabaahModel> {
  const settings = await readPrayerSettings(db);
  const items = parseItems(await getSetting(db, ITEMS_KEY));
  const streakConfig = parseStreakConfig(await getSetting(db, STREAK_KEY));
  const today = dayKeyInZone(now, settings.location?.timeZone);
  const recorded = await getRecordedSince(db, addDays(today, -STREAK_HISTORY_DAYS));
  const counted = countedDays(recorded, items, streakConfig.minDone);
  const weekStart = addDays(today, -6);
  const weekEntries = await getEntriesBetween(db, weekStart, today);
  return {
    settings,
    items,
    streakConfig,
    today,
    todayEntries: new Map(
      weekEntries.filter((e) => e.date === today).map((e) => [e.itemId, e.value]),
    ),
    streak: computeStreak(counted, today, streakConfig),
    week: summarizeWeek(weekEntries, items, today, streakConfig.minDone),
  };
}
