import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Android channel prayer-time (adhan) notifications post to. */
export const ADHAN_CHANNEL_ID = "adhan";
/** Android channel for the daily halaqah nudge: default importance, never a heads-up alarm. */
export const HALAQAH_CHANNEL_ID = "halaqah";

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL_ID, {
    name: "Adhan",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(HALAQAH_CHANNEL_ID, {
    name: "Halaqah",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

export type NotificationStatus = "granted" | "denied" | "undetermined";

export async function getNotificationStatus(): Promise<NotificationStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Shows the system prompt when the answer is still open; returns the resulting status. */
export async function requestNotificationPermission(): Promise<NotificationStatus> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== "undetermined") return current.status;
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}
