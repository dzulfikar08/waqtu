import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";

import { onDataChanged } from "@/db/events";
import { i18n } from "@/i18n";
import { syncCountdownWidget } from "@/ramadhan/liveCountdown";

import { reschedulePrayerNotifications, setupPrayerCategory } from "./prayer";

const DEBOUNCE_MS = 2_000;

/**
 * Keeps the next seven days of prayer notifications current: on launch, when the app returns to
 * the foreground (also after the permission prompt), after location/method/offset changes, and
 * when the language changes (titles and the action label are translated when scheduled). The
 * sahur/iftar home-screen widget's schedule is refreshed on the same triggers.
 */
export function PrayerNotificationController() {
  const db = useSQLiteContext();

  useEffect(() => {
    const schedule = () => {
      void reschedulePrayerNotifications(db).catch(() => {});
      void syncCountdownWidget(db).catch(() => {});
    };
    const refresh = () => {
      void setupPrayerCategory()
        .then(schedule)
        .catch(() => {});
    };
    refresh();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onDataChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(schedule, DEBOUNCE_MS);
    });
    i18n.on("languageChanged", refresh);
    return () => {
      app.remove();
      off();
      i18n.off("languageChanged", refresh);
      clearTimeout(timer);
    };
  }, [db]);

  return null;
}
