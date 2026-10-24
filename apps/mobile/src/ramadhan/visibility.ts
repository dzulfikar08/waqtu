import { civilParts, isRamadhanSeason } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { readHijriOffset } from "./prayerConfig";
import { getSetting } from "./settings";
import { useNow } from "./useNow";

const LEAD_DAYS = 7;

/**
 * Whether the Ramadhan tab shows in the tab bar: during Ramadhan and the 7 days before. It stays
 * reachable from Settings the rest of the year. Re-checked every minute, and on first render is false.
 */
export function useRamadhanTabVisible(): boolean {
  const db = useSQLiteContext();
  const now = useNow(60_000);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [offset, tz] = await Promise.all([readHijriOffset(db), getSetting(db, "tz")]);
      const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const today = civilParts(now, zone);
      if (!cancelled) setVisible(isRamadhanSeason(today, offset, LEAD_DAYS));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, now]);

  return visible;
}
