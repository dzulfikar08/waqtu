import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { onDataChanged } from "@/db/events";
import { loadModel, type MutabaahModel } from "@/db/model";
import { dayKeyInZone } from "@/mutabaah/dates";

/** Ticks every `intervalMs` with the current time (countdowns, the day rolling over). */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Checklist, streak, week and prayer setup, re-read when entries/settings change (a tap, a sync,
 * a notification action) and when midnight passes in the prayer location's zone.
 */
export function useMutabaah(): MutabaahModel | null {
  const db = useSQLiteContext();
  const [model, setModel] = useState<MutabaahModel | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!model) return;
    const id = setInterval(() => {
      if (dayKeyInZone(new Date(), model.settings.location?.timeZone) !== model.today) {
        setVersion((v) => v + 1);
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [model]);

  useEffect(() => {
    let cancelled = false;
    void loadModel(db, new Date()).then((next) => {
      if (!cancelled) setModel(next);
    });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  return model;
}
