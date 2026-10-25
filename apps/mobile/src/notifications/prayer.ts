import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";

import { i18n } from "@/i18n/core";
import { readPrayerSettings } from "@/prayer/config";
import { upcomingSlots } from "@/prayer/schedule";
import { dayKeyInZone } from "@/mutabaah/dates";
import { formatLocalTime } from "@waqtu/core";

import { canScheduleExactAlarms } from "../../modules/exact-alarm";
import { halaqahNudgeRequests } from "./halaqah";
import { ADHAN_CHANNEL_ID, HALAQAH_CHANNEL_ID } from "./setup";

/** iOS caps pending local notifications at 64; seven days of five prayers and one halaqah nudge is 42. */
const DAYS_AHEAD = 7;

export const PRAYER_CATEGORY = "prayer";
export const ACTION_DONE = "done";

/** Payload on every prayer notification; the "Sudah sholat" action reads it with the app closed. */
export interface PrayerNotificationData {
  kind: "prayer";
  prayer: string;
  /** Checklist date (YYYY-MM-DD) the prayer belongs to. */
  day: string;
  /** Epoch ms when the prayer's window closes; a tap before it records "on time". */
  endsAt: number;
}

export function isPrayerNotificationData(data: unknown): data is PrayerNotificationData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.kind === "prayer" &&
    typeof d.prayer === "string" &&
    typeof d.day === "string" &&
    typeof d.endsAt === "number"
  );
}

/** Registers the "Sudah sholat ✓" action. Re-run when the language changes: the label is baked in. */
export async function setupPrayerCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(PRAYER_CATEGORY, [
    {
      identifier: ACTION_DONE,
      buttonTitle: i18n.t("notify.done"),
      options: { opensAppToForeground: false },
    },
  ]);
}

let queue: Promise<void> = Promise.resolve();
let lastKey: string | null = null;

/**
 * Replaces the pending local notifications (prayers and the daily halaqah nudge) with the next seven
 * days. Skips the work when nothing that affects them changed since the last run (same day, setup,
 * language, permission, planned nudges). Calls are serialized so two overlapping runs cannot leave
 * duplicates.
 */
export function reschedulePrayerNotifications(db: SQLiteDatabase): Promise<void> {
  const run = queue.then(() => scheduleAll(db));
  queue = run.catch(() => {});
  return run;
}

async function scheduleAll(db: SQLiteDatabase): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  const settings = await readPrayerSettings(db);
  const now = new Date();
  const location = settings.location;
  const allowed = permission.status === "granted";
  const nudges = allowed ? await halaqahNudgeRequests(db, settings, now, DAYS_AHEAD) : [];
  const key = JSON.stringify([
    allowed,
    canScheduleExactAlarms(),
    settings,
    i18n.language,
    location ? dayKeyInZone(now, location.timeZone) : null,
    nudges,
  ]);
  if (key === lastKey) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const nudge of nudges) {
    await Notifications.scheduleNotificationAsync({
      content: { title: nudge.title, body: nudge.body, data: { ...nudge.data }, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nudge.at,
        channelId: HALAQAH_CHANNEL_ID,
      },
    });
  }
  if (!allowed || location === null) {
    lastKey = key;
    return;
  }
  const places = location.name ? ` · ${location.name}` : "";
  for (const slot of upcomingSlots(settings, location, now, DAYS_AHEAD)) {
    const data: PrayerNotificationData = {
      kind: "prayer",
      prayer: slot.prayer,
      day: slot.day,
      endsAt: slot.endsAt.getTime(),
    };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notify.title", { prayer: i18n.t(`prayers.${slot.prayer}`) }),
        body: `${formatLocalTime(slot.at, location.timeZone)}${places}`,
        categoryIdentifier: PRAYER_CATEGORY,
        data: { ...data },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: slot.at,
        channelId: ADHAN_CHANNEL_ID,
      },
    });
  }
  lastKey = key;
}
