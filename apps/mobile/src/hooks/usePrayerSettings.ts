import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { onDataChanged } from "@/db/events";
import { readPrayerSettings, type PrayerSettings } from "@/prayer/config";

/** Location, method, asr, offsets and Hijri correction; null until first read. Re-reads on any data change. */
export function usePrayerSettings(): PrayerSettings | null {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void readPrayerSettings(db).then((next) => {
      if (!cancelled) setSettings(next);
    });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  return settings;
}
