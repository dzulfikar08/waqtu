import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";

import { getSetting, setSetting } from "./settings";

export type SettleMode = "rice" | "cash";

/** Rice-or-cash choice persisted in the `settings` table; rice until chosen. */
export function useStoredMode(
  db: SQLiteDatabase,
  key: string,
): { mode: SettleMode; set: (mode: SettleMode) => void } {
  const [mode, setMode] = useState<SettleMode>("rice");

  useEffect(() => {
    let cancelled = false;
    void getSetting(db, key)
      .then((stored) => {
        if (!cancelled && stored === "cash") setMode("cash");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, key]);

  const set = useCallback(
    (next: SettleMode) => {
      setMode(next);
      void setSetting(db, key, next).catch(() => {});
    },
    [db, key],
  );

  return { mode, set };
}
