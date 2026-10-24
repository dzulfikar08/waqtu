import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { PremiumApiError, type PremiumApi } from "./api";
import { accountTokenFromDigest, type Entitlement, type Plan } from "./entitlement";
import { buyPlan, ownedPurchases, type OwnedPurchase, type PurchaseOutcome } from "./store";

async function appleAccountToken(userId: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `waqtu-apple:${userId}`,
  );
  return accountTokenFromDigest(hex);
}

/** Sends one store receipt to the server in the form its store needs. */
async function submit(api: PremiumApi, token: string): Promise<Entitlement & { pending: boolean }> {
  if (Platform.OS === "ios") return { ...(await api.submitApple(token)), pending: false };
  return api.submitGoogle(token);
}

/** The server will never accept this receipt for this account: finish it instead of replaying forever. */
const isDefinitiveRejection = (error: unknown): boolean =>
  error instanceof PremiumApiError &&
  (error.code === "invalid_receipt" || error.code === "linked_to_other_account");

export type BuyResult =
  | { status: "purchased"; entitlement: Entitlement }
  | { status: "pending" }
  | { status: "cancelled" };

/**
 * Buys one plan and has the server verify it. The store transaction is finished only after the
 * server answered, so a crash in between replays it from `restorePurchases` instead of losing a
 * paid purchase.
 */
export async function purchasePlan(
  api: PremiumApi,
  plan: Plan,
  userId: string,
): Promise<BuyResult> {
  const outcome: PurchaseOutcome = await buyPlan(plan, {
    id: userId,
    appleToken: await appleAccountToken(userId),
  });
  if (outcome.status === "cancelled") return { status: "cancelled" };
  if (outcome.status === "pending") return { status: "pending" };

  try {
    const result = await submit(api, outcome.token);
    if (result.pending) return { status: "pending" };
    await outcome.finish();
    return { status: "purchased", entitlement: result };
  } catch (error) {
    if (isDefinitiveRejection(error)) await outcome.finish().catch(() => {});
    throw error;
  }
}

export interface RestoreResult {
  /** Subscriptions the store reported. */
  found: number;
  /** The entitlement after the last accepted receipt; null when nothing was accepted. */
  entitlement: Entitlement | null;
  /** Receipts the server refused (invalid, or held by another Waqtu account). */
  rejected: PremiumApiError | null;
}

/**
 * Re-reads this store account's subscriptions and has the server verify each one. Used by the
 * "Pulihkan pembelian" button (`sync` true: asks the store to refresh first) and silently after
 * sign-in to replay a purchase an earlier crash or a new phone left unreported.
 */
export async function restorePurchases(api: PremiumApi, sync: boolean): Promise<RestoreResult> {
  const owned: OwnedPurchase[] = await ownedPurchases(sync);
  const result: RestoreResult = { found: owned.length, entitlement: null, rejected: null };
  for (const purchase of owned) {
    try {
      const accepted = await submit(api, purchase.token);
      result.entitlement = accepted;
      if (!accepted.pending) await purchase.finish();
    } catch (error) {
      if (!isDefinitiveRejection(error)) throw error;
      result.rejected ??= error as PremiumApiError;
      await purchase.finish().catch(() => {});
    }
  }
  return result;
}
