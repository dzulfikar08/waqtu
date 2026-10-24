import {
  findEntitlement,
  writeEntitlement,
  type EntitlementWrite,
  type WriteOutcome,
} from "./entitlement";
import { appleAccountToken, type AppleNotification, type AppleTransaction } from "./apple";

/** Premium time one Apple transaction grants: the store's own period end, cut short by a refund. */
function accessEnd(transaction: AppleTransaction, grace: Date | null): number | null {
  const expires = transaction.expiresDate?.getTime() ?? null;
  const revoked = transaction.revocationDate?.getTime() ?? null;
  if (revoked !== null) return Math.min(expires ?? revoked, revoked);
  if (expires === null) return null;
  return grace && grace.getTime() > expires ? grace.getTime() : expires;
}

function toWrite(
  userId: string,
  transaction: AppleTransaction,
  signedAt: number,
  grace: Date | null,
): EntitlementWrite | null {
  const expiresAt = accessEnd(transaction, grace);
  // Apple sells these products as auto-renewable subscriptions only; a transaction without a
  // period end is not one of them.
  if (expiresAt === null) return null;
  return {
    userId,
    source: "apple",
    externalId: transaction.originalTransactionId,
    productId: transaction.productId,
    environment: transaction.environment === "Sandbox" ? "sandbox" : "production",
    expiresAt,
    orderId: transaction.transactionId,
    revokedAt: transaction.revocationDate?.getTime() ?? null,
    signedAt,
  };
}

export type AppleRedeemResult =
  | { ok: true; outcome: WriteOutcome }
  | { ok: false; error: "other-account" | "not-subscription" };

/**
 * A verified transaction submitted by the app (purchase, restore, replay). The subscription is tied
 * to the signed-in user by its original transaction id; one already held by another account, or
 * bought with another account's appAccountToken, is refused.
 */
export async function redeemAppleTransaction(
  db: D1Database,
  userId: string,
  transaction: AppleTransaction,
  now: number,
): Promise<AppleRedeemResult> {
  if (
    transaction.appAccountToken &&
    transaction.appAccountToken.toLowerCase() !== (await appleAccountToken(userId))
  ) {
    return { ok: false, error: "other-account" };
  }
  const write = toWrite(userId, transaction, transaction.signedDate.getTime(), null);
  if (!write) return { ok: false, error: "not-subscription" };
  const outcome = await writeEntitlement(db, write, now);
  if (outcome === "other-account") return { ok: false, error: "other-account" };
  return { ok: true, outcome };
}

export type AppleNotificationResult = "test" | "ignored" | "unmapped" | "applied" | "stale";

/**
 * One verified App Store Server Notification V2. Every notification that carries a transaction
 * restates the subscription's state (renewal, expiry, refund, grace), so the row is rewritten from
 * it, ordered by the notification's signing time. A subscription no account has submitted yet is
 * acknowledged and left to the app's own submission. Throws on a D1 failure so Apple redelivers.
 */
export async function handleAppleNotification(
  db: D1Database,
  notification: AppleNotification,
  now: number,
): Promise<AppleNotificationResult> {
  if (notification.notificationType === "TEST") return "test";
  const { transaction } = notification;
  if (!transaction) return "ignored";

  const held = await findEntitlement(db, "apple", transaction.originalTransactionId);
  if (!held) {
    console.error(
      `apple notification ${notification.notificationType}/${notification.subtype ?? "-"}: no account holds original transaction ${transaction.originalTransactionId}`,
    );
    return "unmapped";
  }
  // A refund of an earlier period must not end access the buyer paid for later: only the refund
  // of the transaction the stored period came from revokes.
  if (
    transaction.revocationDate &&
    held.order_id !== null &&
    held.order_id !== transaction.transactionId
  ) {
    return "ignored";
  }
  const write = toWrite(
    held.user_id,
    transaction,
    notification.signedDate.getTime(),
    notification.renewalInfo?.gracePeriodExpiresDate ?? null,
  );
  if (!write) return "ignored";
  const outcome = await writeEntitlement(db, write, now);
  return outcome === "applied" ? "applied" : "stale";
}
