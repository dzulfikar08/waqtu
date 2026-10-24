// App Store (StoreKit 2) and Google Play Billing for Waqtu Premium, both over expo-iap.
//
// App Store: auto-renewable subscriptions dat.waqtu.premium.monthly / .yearly. The signed
// transaction (JWS) is `purchase.purchaseToken`. Play: subscription `premium` with base plans
// `monthly` and `yearly`; `purchaseToken` is the Play token. Prices are never hardcoded: they are
// whatever the store returns for this user's storefront.
//
// Granting is the server's job after it verified the receipt with Apple/Google, so this module
// never grants anything itself. iOS transactions stay unfinished until the server confirmed them
// (an interrupted flow is replayed from `ownedPurchases`); Play purchases are acknowledged by the
// server.
import {
  deepLinkToSubscriptions,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
} from "expo-iap";
import type { ProductSubscription, Purchase } from "expo-iap";
import { Platform } from "react-native";

import { APPLE_PRODUCT_IDS, PLAY_PACKAGE_NAME, PLAY_PRODUCT_ID, type Plan } from "./entitlement";

export interface PlanOffer {
  /** Localized price from the store, e.g. "Rp29.000". */
  displayPrice: string;
  /** Play only: the base-plan offer to buy. */
  offerToken?: string;
}

export type Plans = Partial<Record<Plan, PlanOffer>>;

export type PurchaseOutcome =
  | { status: "purchased"; token: string; finish: () => Promise<void> }
  | { status: "pending" }
  | { status: "cancelled" };

/** A subscription the store says this account owns. */
export interface OwnedPurchase {
  /** App Store: signed transaction JWS. Play: purchase token. */
  token: string;
  finish: () => Promise<void>;
}

/** The store's own "already subscribed" refusal. */
export class AlreadySubscribedError extends Error {}

export const STORE_AVAILABLE = Platform.OS === "ios" || Platform.OS === "android";

let connection: Promise<unknown> | null = null;

/** One shared connection to the store; a failed attempt is retried on the next call. */
function connect(): Promise<unknown> {
  connection ??= initConnection().catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
}

const isPremiumProduct = (productId: string): boolean =>
  Platform.OS === "ios"
    ? productId === APPLE_PRODUCT_IDS.monthly || productId === APPLE_PRODUCT_IDS.yearly
    : productId === PLAY_PRODUCT_ID;

/**
 * Store prices for each plan. On Play, promotional offers carry extra pricing phases (trial, intro
 * price), so the offer with the fewest phases is the plain base plan and its last phase is the
 * recurring price.
 */
export async function loadPlans(): Promise<Plans> {
  await connect();
  if (Platform.OS === "ios") {
    const products = ((await fetchProducts({
      skus: [APPLE_PRODUCT_IDS.monthly, APPLE_PRODUCT_IDS.yearly],
      type: "subs",
    })) ?? []) as ProductSubscription[];
    const plans: Plans = {};
    for (const plan of ["monthly", "yearly"] as const) {
      const product = products.find(
        (p) => p.platform === "ios" && p.id === APPLE_PRODUCT_IDS[plan],
      );
      if (product) plans[plan] = { displayPrice: product.displayPrice };
    }
    return plans;
  }

  const products = ((await fetchProducts({ skus: [PLAY_PRODUCT_ID], type: "subs" })) ??
    []) as ProductSubscription[];
  const product = products.find((p) => p.platform === "android" && p.id === PLAY_PRODUCT_ID);
  const plans: Plans = {};
  if (!product || product.platform !== "android") return plans;
  for (const plan of ["monthly", "yearly"] as const) {
    let best: { phases: number; offer: PlanOffer } | null = null;
    for (const offer of product.subscriptionOffers ?? []) {
      if (offer.basePlanIdAndroid !== plan || !offer.offerTokenAndroid) continue;
      const phases = offer.pricingPhasesAndroid?.pricingPhaseList ?? [];
      if (best && best.phases <= phases.length) continue;
      best = {
        phases: phases.length,
        offer: {
          displayPrice: phases[phases.length - 1]?.formattedPrice ?? offer.displayPrice,
          offerToken: offer.offerTokenAndroid,
        },
      };
    }
    if (best) plans[plan] = best.offer;
  }
  return plans;
}

function finisher(purchase: Purchase): () => Promise<void> {
  // Play purchases are acknowledged by the server; only StoreKit needs finishing.
  if (Platform.OS !== "ios") return () => Promise.resolve();
  return () => finishTransaction({ purchase, isConsumable: false }).then(() => undefined);
}

/**
 * Opens the store's purchase sheet for one plan. `accountToken` (iOS appAccountToken) and
 * `accountId` (Play obfuscatedAccountId, the Waqtu user id) tie the purchase to the signed-in
 * account so the server can refuse one made for another account and map store notifications.
 */
export async function buyPlan(
  plan: Plan,
  account: { id: string; appleToken: string },
): Promise<PurchaseOutcome> {
  const plans = await loadPlans();
  const offer = plans[plan];
  if (!offer) throw new Error("plan-unavailable");

  return new Promise<PurchaseOutcome>((resolve, reject) => {
    const subscriptions: { remove: () => void }[] = [];
    const settle = (finish: () => void) => {
      for (const subscription of subscriptions) subscription.remove();
      finish();
    };
    subscriptions.push(
      purchaseUpdatedListener((purchase) => {
        if (!isPremiumProduct(purchase.productId)) return;
        if (purchase.purchaseState === "pending") {
          settle(() => resolve({ status: "pending" }));
        } else if (purchase.purchaseState === "purchased" && purchase.purchaseToken) {
          const token = purchase.purchaseToken;
          settle(() => resolve({ status: "purchased", token, finish: finisher(purchase) }));
        }
      }),
      purchaseErrorListener((error) => {
        settle(() => {
          if (error.code === ErrorCode.UserCancelled) resolve({ status: "cancelled" });
          else if (error.code === ErrorCode.AlreadyOwned) reject(new AlreadySubscribedError());
          else reject(new Error(error.message));
        });
      }),
    );
    const request =
      Platform.OS === "ios"
        ? { apple: { sku: APPLE_PRODUCT_IDS[plan], appAccountToken: account.appleToken } }
        : {
            google: {
              skus: [PLAY_PRODUCT_ID],
              subscriptionOffers: [{ sku: PLAY_PRODUCT_ID, offerToken: offer.offerToken! }],
              obfuscatedAccountId: account.id,
            },
          };
    requestPurchase({ type: "subs", request }).catch((error: unknown) => {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    });
  });
}

/**
 * Subscriptions the store says this account holds. `sync` asks the store to refresh first (the
 * "restore purchases" button; on iOS this may prompt for the Apple ID password).
 */
export async function ownedPurchases(sync: boolean): Promise<OwnedPurchase[]> {
  await connect();
  if (sync && Platform.OS === "ios") await restorePurchases();
  const purchases = await getAvailablePurchases();
  return purchases
    .filter(
      (p) => isPremiumProduct(p.productId) && p.purchaseToken && p.purchaseState !== "pending",
    )
    .map((p) => ({ token: p.purchaseToken as string, finish: finisher(p) }));
}

/** The store's own subscription page: cancel, change plan, see the next charge. */
export async function openManageSubscriptions(): Promise<void> {
  await connect();
  await deepLinkToSubscriptions({
    skuAndroid: PLAY_PRODUCT_ID,
    packageNameAndroid: PLAY_PACKAGE_NAME,
  });
}
