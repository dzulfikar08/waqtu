import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";

import { onDataChanged } from "@/db/events";
import { getSetting, setSetting } from "@/db/settings";
import { DEV_RECITATION_KEY, RECITATION_MODEL_KEY, recitationCheckEnabled } from "./dev";
import { DEFAULT_MODEL, isModelId, type ModelId } from "./models";

/** The recitation-check switch and model choice (device-local settings, never synced). */
export function useRecitationDev() {
  const db = useSQLiteContext();
  const [stored, setStored] = useState<{ enabled: string | null; model: string | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void Promise.all([getSetting(db, DEV_RECITATION_KEY), getSetting(db, RECITATION_MODEL_KEY)])
        .then(([enabled, model]) => {
          if (!cancelled) setStored({ enabled, model });
        })
        .catch(() => {});
    load();
    const off = onDataChanged(load);
    return () => {
      cancelled = true;
      off();
    };
  }, [db]);

  const setEnabled = useCallback(
    (on: boolean) => setSetting(db, DEV_RECITATION_KEY, on ? "1" : "0"),
    [db],
  );
  const setModel = useCallback((id: ModelId) => setSetting(db, RECITATION_MODEL_KEY, id), [db]);

  const model = stored?.model ?? null;
  return {
    loaded: stored !== null,
    enabled: recitationCheckEnabled(stored?.enabled ?? null, __DEV__),
    model: isModelId(model) ? model : DEFAULT_MODEL,
    setEnabled,
    setModel,
  };
}
