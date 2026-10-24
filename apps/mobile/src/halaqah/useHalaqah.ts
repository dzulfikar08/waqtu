import { civilParts, type CivilDate } from "@waqtu/core";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { onDataChanged } from "@/db/events";
import { useNow } from "@/hooks/useMutabaah";
import { dayKeyInZone, type DayKey } from "@/mutabaah/dates";
import { readPrayerSettings } from "@/prayer/config";
import { getProgress } from "./db";
import { bundledProgram } from "./bundled";
import type { Program } from "./program";
import { programPosition, type ProgramPosition } from "./schedule";

export interface HalaqahToday {
  program: Program;
  /** Today in the user's zone, as the key mutabaah entries use. */
  todayKey: DayKey;
  position: ProgramPosition;
}

/** The bundled program and where today falls in it. Re-evaluated every minute and when settings change. */
export function useHalaqahToday(): HalaqahToday | null {
  const db = useSQLiteContext();
  const now = useNow(60_000);
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<{ zone?: string; hijriOffset: number } | null>(null);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void readPrayerSettings(db).then((s) => {
      if (!cancelled) setSettings({ zone: s.location?.timeZone, hijriOffset: s.hijriOffset });
    });
    return () => {
      cancelled = true;
    };
  }, [db, version]);

  if (!settings) return null;
  const program = bundledProgram();
  const zone = settings.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts: CivilDate = civilParts(now, zone);
  return {
    program,
    todayKey: dayKeyInZone(now, zone),
    position: programPosition(parts, settings.hijriOffset, program.totalDays),
  };
}

/** Completed program days (day → civil day it was marked), kept current as entries change. */
export function useHalaqahProgress(programId: string): ReadonlyMap<number, DayKey> | null {
  const db = useSQLiteContext();
  const [progress, setProgress] = useState<ReadonlyMap<number, DayKey> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => onDataChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    void getProgress(db, programId).then((next) => {
      if (!cancelled) setProgress(next);
    });
    return () => {
      cancelled = true;
    };
  }, [db, programId, version]);

  return progress;
}
