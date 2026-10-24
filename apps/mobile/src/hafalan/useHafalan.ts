import {
  dailyPortion,
  planStats,
  type DailyPortion,
  type HafalanPlan,
  type HafalanStats,
  type HafalanUnit,
  type IsoDay,
  type UnitState,
} from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";

import { onDataChanged } from "@/db/events";
import { useNow } from "@/hooks/useMutabaah";
import { dayKeyInZone } from "@/mutabaah/dates";
import { readPrayerSettings } from "@/prayer/config";
import { getPlan, getRecordings, getStates, planUnits, type StoredRecording } from "./db";

export interface HafalanData {
  plan: HafalanPlan;
  units: HafalanUnit[];
  states: UnitState[];
  recordings: ReadonlyMap<number, StoredRecording>;
  today: IsoDay;
  portion: DailyPortion;
  stats: HafalanStats;
}

export interface HafalanModel {
  /** The plan with today's portion; null when there is no plan yet. */
  data: HafalanData | null;
  /** Today in the user's zone, for the plan form's start day. */
  today: IsoDay;
}

/**
 * The plan, its units and scheduler state, and today's portion. Null while loading; re-read when
 * the database changes (a grade, a sync) and whenever the day turns over in the user's zone.
 */
export function useHafalan(): HafalanModel | null {
  const db = useSQLiteContext();
  const now = useNow(60_000);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{
    zone: string | undefined;
    plan: HafalanPlan | null;
    states: UnitState[];
    recordings: ReadonlyMap<number, StoredRecording>;
  } | null>(null);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settings, plan, states, recordings] = await Promise.all([
        readPrayerSettings(db),
        getPlan(db),
        getStates(db),
        getRecordings(db),
      ]);
      if (!cancelled) setLoaded({ zone: settings.location?.timeZone, plan, states, recordings });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  const zone = loaded?.zone;
  const today = dayKeyInZone(now, zone);
  return useMemo(() => {
    if (!loaded) return null;
    if (!loaded.plan) return { data: null, today };
    const units = planUnits(loaded.plan);
    return {
      today,
      data: {
        plan: loaded.plan,
        units,
        states: loaded.states,
        recordings: loaded.recordings,
        today,
        portion: dailyPortion(loaded.plan, units.length, loaded.states, today),
        stats: planStats(loaded.plan, units.length, loaded.states, today),
      },
    };
  }, [loaded, today]);
}
