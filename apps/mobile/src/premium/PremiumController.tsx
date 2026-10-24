import { useSQLiteContext } from "expo-sqlite";
import { useEffect } from "react";
import { AppState } from "react-native";

import type { AuthClient } from "@/auth/client";

import { restorePurchases } from "./purchase";
import { loadCachedEntitlement, storeEntitlement } from "./state";
import { STORE_AVAILABLE } from "./store";
import { premiumApiFor } from "./usePremium";

/** Foreground refreshes closer together than this are skipped. */
const MIN_INTERVAL_MS = 60_000;

/**
 * Keeps the premium cache fresh for the signed-in account: loads the stored answer at start,
 * asks the server on sign-in and every time the app returns to the foreground, and once per
 * sign-in quietly replays store purchases the server has not seen (a crash mid-purchase, a new
 * phone) when the account is not premium. The cache is per account, so signing out needs no
 * cleanup: another user's answer never counts. Renders nothing.
 */
export function PremiumController({ client }: { client: AuthClient }) {
  const db = useSQLiteContext();
  const { data: session } = client.useSession();
  const userId = session?.user.id;

  useEffect(() => {
    void loadCachedEntitlement(db);
  }, [db]);

  useEffect(() => {
    if (!userId) return;
    const api = premiumApiFor(client);
    if (!api) return;
    let lastRun = 0;
    let replayed = false;

    const refresh = async () => {
      if (Date.now() - lastRun < MIN_INTERVAL_MS) return;
      lastRun = Date.now();
      try {
        const entitlement = await api.getEntitlement();
        await storeEntitlement(db, userId, entitlement);
        if (!replayed && STORE_AVAILABLE && !entitlement.premium) {
          replayed = true;
          const restored = await restorePurchases(api, false);
          if (restored.entitlement) await storeEntitlement(db, userId, restored.entitlement);
        }
      } catch {
        // Offline, rejected session or an unreachable store: the cached answer stands.
      }
    };

    void refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [db, client, userId]);

  return null;
}
