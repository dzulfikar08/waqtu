import { useEffect, useState } from "react";

import { getSyncState, onSyncState, type SyncState } from "@/sync/run";

export function useSyncState(): SyncState {
  const [state, setState] = useState(getSyncState);
  useEffect(() => onSyncState(() => setState(getSyncState())), []);
  return state;
}
