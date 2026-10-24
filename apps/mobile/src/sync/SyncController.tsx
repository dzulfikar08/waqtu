import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";

import type { AuthClient } from "@/auth/client";
import { onDataChanged } from "@/db/events";

import { syncNow } from "./run";

/** Pushes edits a few seconds after they stop. */
const EDIT_DEBOUNCE_MS = 5_000;

/**
 * Keeps a signed-in account in sync: on sign-in, every time the app returns to the foreground
 * (throttled in `syncNow`), and shortly after the user edits. Renders nothing.
 */
export function SyncController({ client }: { client: AuthClient }) {
  const db = useSQLiteContext();
  const { data: session } = client.useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    void syncNow(db, client, userId);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow(db, client, userId);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onDataChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(db, client, userId, true), EDIT_DEBOUNCE_MS);
    });
    return () => {
      sub.remove();
      off();
      clearTimeout(timer);
    };
  }, [db, client, userId]);

  return null;
}
