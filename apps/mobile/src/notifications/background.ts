import * as Notifications from "expo-notifications";
import { openDatabaseAsync } from "expo-sqlite";
import * as TaskManager from "expo-task-manager";

import { recordPrayerDone } from "@/db/entries";
import { DATABASE_NAME, migrate } from "@/db/migrations";

import { ACTION_DONE, isPrayerNotificationData } from "./prayer";

/**
 * Imported by the root layout so this runs when the app's JS starts, including the headless start
 * Android does for a notification action tap with the app closed.
 */
const TASK_NAME = "waqtu-notification-response";

/**
 * "Sudah sholat ✓": records the prayer in SQLite. Idempotent, so receiving it twice is harmless.
 * Returns false for any other response (e.g. a tapped halaqah nudge, which the app handles once
 * its screens exist), so that response is left in place for it.
 */
async function handleResponse(response: Notifications.NotificationResponse): Promise<boolean> {
  if (response.actionIdentifier !== ACTION_DONE) return false;
  const data = response.notification.request.content.data;
  if (!isPrayerNotificationData(data)) return false;
  const db = await openDatabaseAsync(DATABASE_NAME);
  try {
    await migrate(db);
    await recordPrayerDone(db, data.day, data.prayer, Date.now() < data.endsAt);
  } finally {
    await db.closeAsync();
  }
  return true;
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  TASK_NAME,
  async ({ data, error }) => {
    if (error || !data || !("actionIdentifier" in data)) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }
    try {
      await handleResponse(data);
      return Notifications.BackgroundNotificationTaskResult.NewData;
    } catch {
      return Notifications.BackgroundNotificationTaskResult.Failed;
    }
  },
);

void Notifications.registerTaskAsync(TASK_NAME).catch(() => {});

// App alive (foreground, or iOS waking it for the action): the response arrives as an event.
Notifications.addNotificationResponseReceivedListener((response) => {
  void handleResponse(response)
    .then((handled) => {
      if (handled) Notifications.clearLastNotificationResponse();
    })
    .catch(() => {});
});

// iOS cold start into the background delivers the response before any listener exists.
const pending = Notifications.getLastNotificationResponse();
if (pending) {
  void handleResponse(pending)
    .then((handled) => {
      if (handled) Notifications.clearLastNotificationResponse();
    })
    .catch(() => {});
}
