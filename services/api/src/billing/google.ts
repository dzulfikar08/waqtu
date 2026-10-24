// Google Play Billing, server side: service-account auth, the Android Publisher API calls we need
// (purchases.subscriptionsv2.get and the acknowledge call) and Pub/Sub push authentication.
// WebCrypto + fetch only, so it runs on Cloudflare Workers. The Play Console product is the
// subscription `premium` with base plans `monthly` and `yearly`.

export const DEFAULT_GOOGLE_PLAY_PACKAGE = "dat.waqtu.app";
export const GOOGLE_PREMIUM_PRODUCT_ID = "premium";
export const GOOGLE_BASE_PLANS = ["monthly", "yearly"] as const;

const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const PUBLISHER_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GooglePlayEnv {
  /** Service account key JSON (Play Console API access). Unset = Play billing off. */
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?: string;
  /** Defaults to dat.waqtu.app. */
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  /** Pub/Sub push service account email; enables Google-signed JWT auth on the RTDN endpoint. */
  GOOGLE_PLAY_RTDN_PUSH_EMAIL?: string;
  /** Shared token for the RTDN endpoint (`?token=`), the alternative to the JWT. */
  GOOGLE_PLAY_RTDN_TOKEN?: string;
}

export interface GooglePlayConfig {
  clientEmail: string;
  privateKeyPem: string;
  tokenUri: string;
  packageName: string;
  pushEmail: string | null;
  pushToken: string | null;
}

/** null when the service account is unset or unusable: Play billing reports unavailable. */
export function googlePlayConfig(env: GooglePlayEnv): GooglePlayConfig | null {
  const raw = env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const account = json as { client_email?: unknown; private_key?: unknown; token_uri?: unknown };
  if (typeof account?.client_email !== "string" || !account.client_email) return null;
  if (typeof account.private_key !== "string" || !account.private_key) return null;
  const tokenUri = typeof account.token_uri === "string" ? account.token_uri : DEFAULT_TOKEN_URI;
  if (!tokenUri.startsWith("https://")) return null;
  return {
    clientEmail: account.client_email,
    privateKeyPem: account.private_key,
    tokenUri,
    packageName: env.GOOGLE_PLAY_PACKAGE_NAME?.trim() || DEFAULT_GOOGLE_PLAY_PACKAGE,
    pushEmail: env.GOOGLE_PLAY_RTDN_PUSH_EMAIL?.trim() || null,
    pushToken: env.GOOGLE_PLAY_RTDN_TOKEN?.trim() || null,
  };
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function pemToDer(pem: string): Uint8Array {
  // Secrets are sometimes stored with literal "\n" sequences.
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** RS256 JWT bearer assertion for the service account's OAuth token request. */
export async function buildServiceAccountAssertion(
  config: Pick<GooglePlayConfig, "clientEmail" | "privateKeyPem" | "tokenUri">,
  nowMs: number,
): Promise<string> {
  const enc = new TextEncoder();
  const iat = Math.floor(nowMs / 1000);
  const claims = {
    iss: config.clientEmail,
    scope: PUBLISHER_SCOPE,
    aud: config.tokenUri,
    iat,
    exp: iat + 3600,
  };
  const signingInput = `${b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })))}.${b64url(
    enc.encode(JSON.stringify(claims)),
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(config.privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput)),
  );
  return `${signingInput}.${b64url(signature)}`;
}

export type GoogleSubscriptionState =
  | "pending"
  | "active"
  | "canceled"
  | "grace"
  | "hold"
  | "paused"
  | "expired"
  | "pending_canceled"
  | "unspecified";

const STATE_BY_API: Record<string, GoogleSubscriptionState> = {
  SUBSCRIPTION_STATE_PENDING: "pending",
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_CANCELED: "canceled",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "hold",
  SUBSCRIPTION_STATE_PAUSED: "paused",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "pending_canceled",
};

/** Fields of SubscriptionPurchaseV2 that the entitlement decision reads, normalized. */
export interface GoogleSubscription {
  state: GoogleSubscriptionState;
  /** Play refunds a purchase that is not acknowledged within 3 days. */
  acknowledged: boolean;
  /** obfuscatedAccountId the app passed at purchase time (the Waqtu user id), when present. */
  accountId: string | null;
  productId: string;
  basePlanId: string | null;
  expiresAt: Date | null;
  /** Latest order that was actually charged (renewals get a `..N` suffix). */
  orderId: string | null;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optString = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

function parseSubscription(json: unknown): GoogleSubscription | null {
  if (!isObject(json)) return null;
  const lineItems = Array.isArray(json.lineItems) ? json.lineItems.filter(isObject) : [];
  const item =
    lineItems.find((line) => line.productId === GOOGLE_PREMIUM_PRODUCT_ID) ?? lineItems[0];
  const productId = optString(item?.productId);
  if (!item || !productId) return null;

  const offer = isObject(item.offerDetails) ? item.offerDetails : {};
  const identifiers = isObject(json.externalAccountIdentifiers)
    ? json.externalAccountIdentifiers
    : {};
  const expiryText = optString(item.expiryTime);
  const expiry = expiryText ? new Date(expiryText) : null;
  return {
    state: STATE_BY_API[optString(json.subscriptionState) ?? ""] ?? "unspecified",
    acknowledged: json.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_PENDING",
    accountId: optString(identifiers.obfuscatedExternalAccountId),
    productId,
    basePlanId: optString(offer.basePlanId),
    expiresAt: expiry && Number.isFinite(expiry.getTime()) ? expiry : null,
    orderId: optString(item.latestSuccessfulOrderId) ?? optString(json.latestOrderId),
  };
}

/** The two Android Publisher calls the flow needs. Tests substitute the HTTP layer underneath. */
export interface GooglePlayClient {
  /** null = Play does not know this token (bad, foreign-app, or long-expired). Throws on outages. */
  getSubscription(purchaseToken: string): Promise<GoogleSubscription | null>;
  acknowledge(productId: string, purchaseToken: string): Promise<void>;
}

/**
 * Android Publisher client for one service account. Keeps the OAuth access token in memory until a
 * minute before it expires.
 */
export function createGooglePlayClient(
  config: Pick<GooglePlayConfig, "clientEmail" | "privateKeyPem" | "tokenUri" | "packageName">,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): GooglePlayClient {
  let cached: { token: string; expiresAt: number } | null = null;

  const accessToken = async (): Promise<string> => {
    if (cached && cached.expiresAt > now() + 60_000) return cached.token;
    const assertion = await buildServiceAccountAssertion(config, now());
    const res = await fetchImpl(config.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!res.ok || !body?.access_token) {
      throw new Error(`google oauth ${res.status}`);
    }
    cached = { token: body.access_token, expiresAt: now() + (body.expires_in ?? 3600) * 1000 };
    return cached.token;
  };

  const call = async (path: string, init: RequestInit = {}): Promise<Response> =>
    fetchImpl(`${PUBLISHER_BASE}/${encodeURIComponent(config.packageName)}/${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` },
    });

  return {
    async getSubscription(purchaseToken) {
      const res = await call(
        `purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      );
      // 400 = malformed or other-app token, 404 = unknown, 410 = purchase gone.
      if (res.status === 400 || res.status === 404 || res.status === 410) return null;
      if (!res.ok) throw new Error(`google subscriptionsv2.get ${res.status}`);
      return parseSubscription(await res.json().catch(() => null));
    },
    async acknowledge(productId, purchaseToken) {
      const res = await call(
        `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      );
      if (!res.ok) throw new Error(`google subscriptions.acknowledge ${res.status}`);
    },
  };
}

/** Real-time developer notification (decoded Pub/Sub message data). */
export interface GoogleNotification {
  packageName: string;
  subscription?: { notificationType: number; purchaseToken: string; subscriptionId: string };
  voided?: { purchaseToken: string; orderId: string; productType: number };
  test: boolean;
}

/** voidedPurchaseNotification.productType for subscriptions. */
export const VOIDED_PRODUCT_TYPE_SUBSCRIPTION = 1;

/** Decodes a Pub/Sub push body; null when it is not a Play developer notification. */
export function parsePushNotification(body: unknown): GoogleNotification | null {
  const message = isObject(body) && isObject(body.message) ? body.message : null;
  const data = message?.data;
  if (typeof data !== "string") return null;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(b64urlDecode(data)));
  } catch {
    return null;
  }
  if (!isObject(json) || typeof json.packageName !== "string") return null;

  const sub = json.subscriptionNotification;
  const voided = json.voidedPurchaseNotification;
  return {
    packageName: json.packageName,
    subscription:
      isObject(sub) &&
      typeof sub.notificationType === "number" &&
      typeof sub.purchaseToken === "string" &&
      typeof sub.subscriptionId === "string"
        ? {
            notificationType: sub.notificationType,
            purchaseToken: sub.purchaseToken,
            subscriptionId: sub.subscriptionId,
          }
        : undefined,
    voided:
      isObject(voided) &&
      typeof voided.purchaseToken === "string" &&
      typeof voided.orderId === "string" &&
      typeof voided.productType === "number"
        ? {
            purchaseToken: voided.purchaseToken,
            orderId: voided.orderId,
            productType: voided.productType,
          }
        : undefined,
    test: json.testNotification !== undefined,
  };
}

/** Constant-time string compare for the shared RTDN token. */
export function tokenMatches(given: string, expected: string): boolean {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

type Jwk = JsonWebKey & { kid?: string };

/** Google's public signing keys, cached for an hour. */
export function createGoogleKeySource(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): (kid: string) => Promise<Jwk | null> {
  let cached: { keys: Jwk[]; fetchedAt: number } | null = null;
  const load = async (): Promise<Jwk[]> => {
    const res = await fetchImpl(GOOGLE_CERTS_URL);
    if (!res.ok) throw new Error(`google certs ${res.status}`);
    const body = (await res.json()) as { keys?: Jwk[] };
    cached = { keys: body.keys ?? [], fetchedAt: now() };
    return cached.keys;
  };
  return async (kid) => {
    const fresh = cached !== null && now() - cached.fetchedAt < 60 * 60 * 1000;
    let key = (fresh ? cached!.keys : await load()).find((k) => k.kid === kid);
    // A rotated key id: refresh once before rejecting.
    if (!key && fresh) key = (await load()).find((k) => k.kid === kid);
    return key ?? null;
  };
}

export interface PushJwtOptions {
  audience: string;
  email: string;
  key: (kid: string) => Promise<Jwk | null>;
  nowMs?: number;
}

/**
 * Verifies the Google-signed OIDC token a Pub/Sub push subscription attaches
 * (`Authorization: Bearer <jwt>`): RS256 signature against Google's keys, Google issuer, our
 * endpoint as audience, exp, and the push service account.
 */
export async function verifyPushJwt(jwt: string, options: PushJwtOptions): Promise<boolean> {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    const [headB64, payloadB64, sigB64] = parts as [string, string, string];
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headB64))) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== "RS256" || !header.kid) return false;
    const jwk = await options.key(header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signed = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlDecode(sigB64),
      new TextEncoder().encode(`${headB64}.${payloadB64}`),
    );
    if (!signed) return false;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as {
      iss?: string;
      aud?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean;
    };
    const nowSec = Math.floor((options.nowMs ?? Date.now()) / 1000);
    return (
      typeof claims.iss === "string" &&
      GOOGLE_ISSUERS.includes(claims.iss) &&
      claims.aud === options.audience &&
      typeof claims.exp === "number" &&
      claims.exp > nowSec &&
      claims.email_verified === true &&
      claims.email?.toLowerCase() === options.email.toLowerCase()
    );
  } catch {
    return false;
  }
}
