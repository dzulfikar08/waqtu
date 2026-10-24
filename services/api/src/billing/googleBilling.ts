import {
  findEntitlement,
  userExists,
  writeEntitlement,
  type StoredEntitlement,
  type WriteOutcome,
} from "./entitlement";
import {
  GOOGLE_BASE_PLANS,
  GOOGLE_PREMIUM_PRODUCT_ID,
  VOIDED_PRODUCT_TYPE_SUBSCRIPTION,
  type GoogleNotification,
  type GooglePlayClient,
  type GoogleSubscription,
} from "./google";

/** States in which Play says the buyer is entitled right now. */
const ENTITLED_STATES: Partial<Record<GoogleSubscription["state"], true>> = {
  active: true,
  canceled: true,
  grace: true,
};

export interface GoogleBillingDeps {
  db: D1Database;
  client: GooglePlayClient;
  now: () => number;
}

export type GoogleSyncResult =
  | { ok: true; status: WriteOutcome | "pending" | "unmapped" }
  | { ok: false; error: "invalid-token" | "wrong-product" | "other-account" };

/**
 * Reads the purchase from Google (the source of truth, never the client) and records what it says.
 * With `userId` (the app submitting a token) the purchase is tied to that account; without it (a
 * real-time notification) the owner is the account that already holds the token, or the one named
 * by the obfuscatedAccountId the app attached at purchase time.
 *
 * Acknowledging comes last, after the entitlement is stored: if it fails the call errors and the
 * next replay retries, and Play only refunds a purchase left unacknowledged for 3 days.
 */
export async function syncGooglePurchase(
  deps: GoogleBillingDeps,
  input: { purchaseToken: string; userId?: string },
): Promise<GoogleSyncResult> {
  const { db, client } = deps;
  const sub = await client.getSubscription(input.purchaseToken);
  if (!sub) return { ok: false, error: "invalid-token" };
  if (
    sub.productId !== GOOGLE_PREMIUM_PRODUCT_ID ||
    !GOOGLE_BASE_PLANS.some((plan) => plan === sub.basePlanId)
  ) {
    return { ok: false, error: "wrong-product" };
  }
  if (input.userId && sub.accountId && sub.accountId !== input.userId) {
    return { ok: false, error: "other-account" };
  }

  const held = await findEntitlement(db, "google", input.purchaseToken);
  let userId = input.userId ?? held?.user_id ?? null;
  if (!userId && sub.accountId && (await userExists(db, sub.accountId))) userId = sub.accountId;
  if (!userId) {
    console.error("google notification: no account holds this purchase token");
    return { ok: true, status: "unmapped" };
  }

  // Not charged yet (cash / convenience-store payment): nothing is owed until Play says so.
  if (sub.state === "pending" || sub.state === "pending_canceled") {
    return { ok: true, status: "pending" };
  }

  const now = deps.now();
  const entitled = ENTITLED_STATES[sub.state] === true;
  const expiry = sub.expiresAt?.getTime() ?? null;
  if (entitled && expiry === null) return { ok: false, error: "invalid-token" };
  let expiresAt = entitled ? expiry! : Math.min(expiry ?? now, now);
  // A refunded order stays refunded until Play charges a newer one.
  const revokedAt = refundedOrder(held, sub) ? held!.revoked_at : null;
  if (revokedAt !== null) expiresAt = Math.min(expiresAt, revokedAt);

  const outcome = await writeEntitlement(
    db,
    {
      userId,
      source: "google",
      externalId: input.purchaseToken,
      productId: `${sub.productId}:${sub.basePlanId}`,
      environment: null,
      expiresAt,
      orderId: sub.orderId,
      revokedAt,
      signedAt: now,
    },
    now,
  );
  if (outcome === "other-account") return { ok: false, error: "other-account" };
  if (entitled && !sub.acknowledged) {
    await client.acknowledge(sub.productId, input.purchaseToken);
  }
  return { ok: true, status: outcome };
}

function refundedOrder(held: StoredEntitlement | null, sub: GoogleSubscription): boolean {
  return held?.revoked_at != null && held.order_id !== null && held.order_id === sub.orderId;
}

export type GoogleNotificationResult = "ignored" | "synced" | "revoked" | WriteOutcome | "pending";

/**
 * One real-time developer notification. The payload is never trusted for the grant itself: a
 * subscription notification re-reads the purchase from Google. A voided purchase (refund,
 * chargeback) cuts the paid period short when it voids the order that period came from. Throws on
 * a Google or database failure so Pub/Sub redelivers.
 */
export async function handleGoogleNotification(
  deps: GoogleBillingDeps,
  notification: GoogleNotification,
): Promise<GoogleNotificationResult> {
  const { subscription, voided } = notification;
  if (subscription) {
    const result = await syncGooglePurchase(deps, { purchaseToken: subscription.purchaseToken });
    if (!result.ok) {
      console.error(`google notification: purchase rejected (${result.error})`);
      return "ignored";
    }
    return result.status === "unmapped" ? "ignored" : "synced";
  }
  if (voided && voided.productType === VOIDED_PRODUCT_TYPE_SUBSCRIPTION) {
    const held = await findEntitlement(deps.db, "google", voided.purchaseToken);
    if (!held || held.order_id !== voided.orderId) return "ignored";
    const now = deps.now();
    const outcome = await writeEntitlement(
      deps.db,
      {
        userId: held.user_id,
        source: "google",
        externalId: voided.purchaseToken,
        productId: held.product_id,
        environment: null,
        expiresAt: Math.min(held.expires_at ?? now, now),
        orderId: held.order_id,
        revokedAt: now,
        signedAt: now,
      },
      now,
    );
    return outcome === "applied" ? "revoked" : outcome;
  }
  return "ignored";
}
