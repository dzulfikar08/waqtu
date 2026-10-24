import { useCallback, useEffect, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";

import { authClient, type AuthClient } from "@/auth/client";
import { API_URL } from "@/auth/config";

import { createPremiumApi, type PremiumApi } from "./api";
import { isPremium, type Entitlement } from "./entitlement";
import { getCachedEntitlement, onPremiumChange, storeEntitlement } from "./state";

/** The premium API for a signed-in client; null when no server is configured. */
export function premiumApiFor(client: AuthClient): PremiumApi | null {
  return API_URL ? createPremiumApi(API_URL, () => client.getCookie()) : null;
}

export interface PremiumStatus {
  /** True while the signed-in account holds premium (offline-safe: uses the cached answer). */
  premium: boolean;
  /** Last entitlement the server reported for this account; null before the first answer. */
  entitlement: Entitlement | null;
  userId: string | null;
  /** Fetches the entitlement again and updates every consumer. Never throws. */
  refresh: () => Promise<void>;
}

/**
 * Gate hook: `const { premium } = usePremium()`. Premium belongs to the signed-in account, so a
 * signed-out phone is free. The answer comes from the cache `PremiumController` keeps fresh and
 * lapses by itself when the cached period ends.
 */
export function usePremium(): PremiumStatus {
  const db = useSQLiteContext();
  const { data: session } = authClient ? authClient.useSession() : { data: null };
  const userId = session?.user.id ?? null;
  const [cache, setCache] = useState(getCachedEntitlement);
  useEffect(() => onPremiumChange(() => setCache(getCachedEntitlement())), []);

  const refresh = useCallback(async () => {
    if (!authClient || !userId) return;
    const api = premiumApiFor(authClient);
    if (!api) return;
    try {
      await storeEntitlement(db, userId, await api.getEntitlement());
    } catch {
      // Offline or rejected session: keep the cached answer.
    }
  }, [db, userId]);

  return {
    premium: isPremium(cache, userId, Date.now()),
    entitlement: cache && cache.userId === userId ? cache.entitlement : null,
    userId,
    refresh,
  };
}
