import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";

import { getSetting, setSetting } from "./settings";

/**
 * A number persisted in the `settings` table. `value` is `fallback` until loaded, and null (unset)
 * after the user clears the field; `loaded` flips once the stored value has been read.
 */
export function useStoredNumber(
  db: SQLiteDatabase,
  key: string,
  fallback: number | null,
): { value: number | null; loaded: boolean; set: (value: number | null) => void } {
  const [value, setValue] = useState<number | null>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSetting(db, key)
      .then((stored) => {
        if (cancelled) return;
        const parsed = stored === null ? NaN : Number(stored);
        if (Number.isFinite(parsed)) setValue(parsed);
        else if (stored === "") setValue(null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [db, key]);

  const set = useCallback(
    (next: number | null) => {
      setValue(next);
      void setSetting(db, key, next === null ? "" : String(next)).catch(() => {});
    },
    [db, key],
  );

  return { value, loaded, set };
}
