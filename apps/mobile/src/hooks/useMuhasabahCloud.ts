import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";

import { onDataChanged } from "@/db/events";
import {
  getMuhasabahSyncStatus,
  isCloudEnabled,
  onMuhasabahSyncStatus,
  type MuhasabahSyncStatus,
} from "@/ibadah/cloud";
import { usePremium } from "@/premium/usePremium";

/**
 * Whether the muhasabah journal is syncing to the signed-in account right now: premium, signed in and the cloud switch
 * on for this account (the same conditions `SyncController` checks), plus the last pass's status.
 */
export function useMuhasabahCloud(): { enabled: boolean; status: MuhasabahSyncStatus } {
  const db = useSQLiteContext();
  const { premium, userId } = usePremium();
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState(getMuhasabahSyncStatus);

  useEffect(() => {
    if (!userId) {
      setOn(false);
      return;
    }
    let cancelled = false;
    const read = () =>
      void isCloudEnabled(db, userId).then((value) => {
        if (!cancelled) setOn(value);
      });
    read();
    const off = onDataChanged(read);
    return () => {
      cancelled = true;
      off();
    };
  }, [db, userId]);

  useEffect(() => onMuhasabahSyncStatus(() => setStatus(getMuhasabahSyncStatus())), []);

  return { enabled: premium && on, status };
}
