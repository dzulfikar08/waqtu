import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import type { SQLiteDatabase } from "expo-sqlite";
import { useEffect } from "react";

import { getSetting } from "@/db/settings";
import { bundledProgram, halaqahAvailable } from "@/halaqah/bundled";
import { getProgress } from "@/halaqah/db";
import { NUDGE_KEY, parseNudgeTime, planNudges } from "@/halaqah/nudge";
import { dayOf } from "@/halaqah/program";
import { i18n } from "@/i18n/core";
import type { PrayerSettings } from "@/prayer/config";

/** Payload on a halaqah nudge; tapping it opens the program screen. */
export interface HalaqahNotificationData {
  kind: "halaqah";
  day: number;
}

export interface HalaqahNudgeRequest {
  at: Date;
  title: string;
  body: string;
  data: HalaqahNotificationData;
}

/** The daily nudges to schedule for the next `days` days, translated now; empty when the nudge is off. */
export async function halaqahNudgeRequests(
  db: SQLiteDatabase,
  settings: PrayerSettings,
  now: Date,
  days: number,
): Promise<HalaqahNudgeRequest[]> {
  const time = parseNudgeTime(await getSetting(db, NUDGE_KEY));
  if (time === null || !halaqahAvailable()) return [];
  const program = bundledProgram();
  const lang = i18n.language === "en" ? "en" : "id";
  const plan = planNudges({
    now,
    zone: settings.location?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    time,
    hijriOffset: settings.hijriOffset,
    program,
    done: await getProgress(db, program.id),
    days,
  });
  return plan.map(({ at, kind, day }) => ({
    at,
    title: i18n.t("halaqah.nudge.title"),
    body:
      kind === "today"
        ? i18n.t("halaqah.nudge.today", { day, title: dayOf(program, day)?.title[lang] ?? "" })
        : i18n.t("halaqah.nudge.continue", { day }),
    data: { kind: "halaqah", day },
  }));
}

function isHalaqahTap(response: Notifications.NotificationResponse | null): boolean {
  if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return false;
  const data = response.notification.request.content.data as Record<string, unknown> | null;
  return data?.kind === "halaqah";
}

/** Opens the halaqah screen when a nudge is tapped, including the tap that launched the app. */
export function useHalaqahNudgeTap(): void {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!isHalaqahTap(response)) return;
      router.push("/halaqah");
      Notifications.clearLastNotificationResponse();
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
