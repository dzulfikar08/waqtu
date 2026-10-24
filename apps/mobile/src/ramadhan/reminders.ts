import type { RamadhanSpan } from "@waqtu/core";
import { addDays } from "@waqtu/core";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const REMINDER_CHANNEL_ID = "reminders";
const ZAKAT_IDENTIFIERS = ["ramadhan-zakat-early", "ramadhan-zakat-last"] as const;
const REMINDER_HOUR = 9;

export interface ReminderCopy {
  title: string;
  body: string;
  channelName: string;
}

/**
 * Schedules the zakat fitrah reminders: 09:00 two days before the last day of Ramadhan and again on
 * the last day, device-local time. Dates already past are skipped. Returns how many were scheduled.
 */
export async function scheduleZakatReminders(
  span: Pick<RamadhanSpan, "end">,
  copy: ReminderCopy,
  now = new Date(),
): Promise<number> {
  await cancelZakatReminders();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: copy.channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const days = [addDays(span.end, -2), span.end];
  let scheduled = 0;
  for (const [i, day] of days.entries()) {
    const at = new Date(day.year, day.month - 1, day.day, REMINDER_HOUR, 0, 0);
    if (at <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: ZAKAT_IDENTIFIERS[i],
      content: { title: copy.title, body: copy.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    scheduled++;
  }
  return scheduled;
}

export async function cancelZakatReminders(): Promise<void> {
  await Promise.all(
    ZAKAT_IDENTIFIERS.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
}
