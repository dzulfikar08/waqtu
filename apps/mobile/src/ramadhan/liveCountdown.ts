import { ExtensionStorage } from "@bacons/apple-targets";
import type { FastingCountdown } from "@waqtu/core";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import WaqtuCountdown from "../../modules/waqtu-countdown";
import { readPrayerConfig } from "./prayerConfig";
import { KEYS } from "./settings";
import { countdownWidgetSchedule } from "./widgetSchedule";
import { getSetting, setSetting } from "@/db/settings";
import { i18n } from "@/i18n/core";

export interface LiveCountdownCopy {
  /** e.g. "Menuju berbuka". */
  title: string;
  /** e.g. "Maghrib 18:12". */
  text: string;
  /** Android notification channel name. */
  channelName: string;
}

const LIVE_ACTIVITY_STYLE = {
  backgroundColor: "#1A2E25",
  titleColor: "#FFFFFF",
  subtitleColor: "#A8C9B8",
  progressViewTint: "#6BA888",
  progressViewLabelColor: "#FFFFFF",
  timerType: "digital",
  deepLinkUrl: "/ramadhan",
} as const;

// The iOS module is optional at runtime (absent in Expo Go), so it is loaded only on iOS and inside try/catch.
function liveActivity(): typeof import("expo-live-activity") | null {
  if (Platform.OS !== "ios") return null;
  try {
    return require("expo-live-activity") as typeof import("expo-live-activity");
  } catch {
    return null;
  }
}

/**
 * Puts the countdown on the lock screen: an ongoing system-chronometer notification on Android, a Live
 * Activity on iOS. Both count down on their own, so they keep running while the app is closed, and
 * both end at the target time. Returns whether anything was shown.
 */
export async function showLiveCountdown(
  db: SQLiteDatabase,
  countdown: FastingCountdown,
  copy: LiveCountdownCopy,
): Promise<boolean> {
  const target = +countdown.at;
  if (Platform.OS === "android") {
    return WaqtuCountdown?.show(copy.title, copy.text, target, copy.channelName) ?? false;
  }
  const activities = liveActivity();
  if (!activities) return false;
  await hideLiveCountdown(db);
  try {
    const id = activities.startActivity(
      { title: copy.title, subtitle: copy.text, progressBar: { date: target } },
      LIVE_ACTIVITY_STYLE,
    );
    if (!id) return false;
    await setSetting(db, KEYS.liveActivityId, id);
    return true;
  } catch {
    return false;
  }
}

/** Removes the lock-screen countdown if one is showing. */
export async function hideLiveCountdown(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === "android") {
    WaqtuCountdown?.cancel();
    return;
  }
  const activities = liveActivity();
  if (!activities) return;
  const id = await getSetting(db, KEYS.liveActivityId);
  if (!id) return;
  try {
    await activities.stopActivity(id, { title: "", progressBar: { progress: 1 } });
  } catch {
    // The system already ended it (target reached or user dismissed).
  }
  await setSetting(db, KEYS.liveActivityId, null);
}

// Shared with the iOS widget extension (targets/countdown-widget, built only with WAQTU_IOS_WIDGET=1).
const IOS_APP_GROUP = "group.dat.waqtu.ios";
const IOS_SCHEDULE_KEY = "countdownSchedule";
const IOS_WIDGET_KIND = "WaqtuCountdownWidget";

/**
 * Hands the home-screen widget the next days of imsak and maghrib (translated in the current
 * language), or clears it while no location is set. The widget advances through them on its own.
 */
export async function syncCountdownWidget(db: SQLiteDatabase): Promise<void> {
  const config = await readPrayerConfig(db);
  const t = (key: string, options?: Record<string, string>) => i18n.t(key, options);
  const json = JSON.stringify(config ? countdownWidgetSchedule(config, new Date(), t) : []);
  if (Platform.OS === "android") {
    WaqtuCountdown?.setWidgetSchedule(json);
  } else if (Platform.OS === "ios") {
    // No-op stubs where the native module is not linked (Expo Go); harmless without the App Group.
    new ExtensionStorage(IOS_APP_GROUP).set(IOS_SCHEDULE_KEY, json);
    ExtensionStorage.reloadWidget(IOS_WIDGET_KIND);
  }
}
