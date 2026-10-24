// Polar (polar.sh, merchant of record): subscriptions sold on the web and for the Mac app. Checkout
// session + customer portal over the REST API, Standard Webhooks signature verification, and the
// subscription events that feed the entitlement table. No SDK: two calls and one HMAC.

import { userExists, writeEntitlement, type WriteOutcome } from "./entitlement";

export const POLAR_PRODUCTION_URL = "https://api.polar.sh";
export const POLAR_SANDBOX_URL = "https://sandbox-api.polar.sh";
export const DEFAULT_POLAR_SUCCESS_URL = "https://getwaqtu.com/";
/** Standard Webhooks: reject deliveries whose timestamp is further than this from now. */
const TOLERANCE_MS = 5 * 60 * 1000;

export type PolarPlan = "monthly" | "yearly";

export interface PolarEnv {
  /** Also used by the Mac license routes; checkout needs the checkouts:write + customer_sessions:write scopes. */
  POLAR_ACCESS_TOKEN?: string;
  POLAR_WEBHOOK_SECRET?: string;
  /** "sandbox" talks to sandbox-api.polar.sh; anything else is production. */
  POLAR_SERVER?: string;
  POLAR_PRODUCT_MONTHLY_ID?: string;
  POLAR_PRODUCT_YEARLY_ID?: string;
  /** Where Polar sends the buyer after paying. */
  POLAR_SUCCESS_URL?: string;
}

export interface PolarConfig {
  accessToken: string;
  webhookSecret: string;
  baseUrl: string;
  productIds: Record<PolarPlan, string>;
  successUrl: string;
}

/** Null until the token, webhook secret and both product ids are set: Polar subscriptions stay off. */
export function polarConfig(env: PolarEnv): PolarConfig | null {
  const accessToken = env.POLAR_ACCESS_TOKEN?.trim();
  const webhookSecret = env.POLAR_WEBHOOK_SECRET?.trim();
  const monthly = env.POLAR_PRODUCT_MONTHLY_ID?.trim();
  const yearly = env.POLAR_PRODUCT_YEARLY_ID?.trim();
  if (!accessToken || !webhookSecret || !monthly || !yearly) return null;
  return {
    accessToken,
    webhookSecret,
    baseUrl: env.POLAR_SERVER?.trim() === "sandbox" ? POLAR_SANDBOX_URL : POLAR_PRODUCTION_URL,
    productIds: { monthly, yearly },
    successUrl: env.POLAR_SUCCESS_URL?.trim() || DEFAULT_POLAR_SUCCESS_URL,
  };
}

/** Which plan a Polar product sells; null = not a Waqtu Premium product (the org also sells the Mac license). */
export function polarProductPlan(
  config: Pick<PolarConfig, "productIds">,
  productId: string | null | undefined,
): PolarPlan | null {
  if (!productId) return null;
  if (productId === config.productIds.monthly) return "monthly";
  if (productId === config.productIds.yearly) return "yearly";
  return null;
}

// ---- Standard Webhooks ------------------------------------------------------

const enc = new TextEncoder();

function b64decode(value: string): Uint8Array | null {
  try {
    const bin = atob(value);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * HMAC keys a `whsec_...` secret may mean. Secrets minted on or after 2026-09-08 follow Standard
 * Webhooks (key = base64-decoded part after the prefix); older Polar secrets key the HMAC with the
 * UTF-8 bytes of the whole string.
 */
function candidateKeys(secret: string): Uint8Array[] {
  const keys: Uint8Array[] = [];
  const decoded = b64decode(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  if (decoded && decoded.length > 0) keys.push(decoded);
  keys.push(enc.encode(secret));
  return keys;
}

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Verifies a Standard Webhooks delivery over the raw body. `webhook-signature` holds
 * space-separated "v1,<base64>" entries; any one matching under any candidate key passes. The
 * comparison is crypto.subtle.verify (constant time).
 */
export async function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const seconds = Number(headers.timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1000) > TOLERANCE_MS) return false;

  const signed = enc.encode(`${headers.id}.${headers.timestamp}.${rawBody}`);
  const signatures: Uint8Array[] = [];
  for (const entry of headers.signature.split(" ")) {
    const [version, value] = entry.split(",");
    const bytes = version === "v1" && value ? b64decode(value) : null;
    if (bytes) signatures.push(bytes);
  }
  if (signatures.length === 0) return false;

  for (const raw of candidateKeys(secret)) {
    const key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    for (const signature of signatures) {
      if (await crypto.subtle.verify("HMAC", key, signature, signed)) return true;
    }
  }
  return false;
}

// ---- REST API ---------------------------------------------------------------

export class PolarApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    detail: string,
  ) {
    super(`polar ${path} failed: HTTP ${status} ${detail}`);
  }
}

async function call<T>(
  config: Pick<PolarConfig, "baseUrl" | "accessToken">,
  fetchImpl: typeof fetch,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetchImpl(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new PolarApiError(path, res.status, text.slice(0, 300));
  return JSON.parse(text) as T;
}

/**
 * Hosted checkout for one plan. `external_customer_id` is our user id, so every later event and
 * the customer portal find the account without a lookup.
 */
export async function createCheckout(
  config: PolarConfig,
  fetchImpl: typeof fetch,
  params: { plan: PolarPlan; userId: string; email: string; name: string },
): Promise<{ url: string }> {
  const checkout = await call<{ url?: unknown }>(config, fetchImpl, "/v1/checkouts/", {
    products: [config.productIds[params.plan]],
    external_customer_id: params.userId,
    customer_email: params.email,
    customer_name: params.name,
    success_url: config.successUrl,
    metadata: { app: "waqtu", user_id: params.userId, plan: params.plan },
  });
  if (typeof checkout.url !== "string") throw new Error("polar checkout answered without a url");
  return { url: checkout.url };
}

/** Short-lived customer portal link (cancel, change plan, payment method, invoices). */
export async function createPortalSession(
  config: PolarConfig,
  fetchImpl: typeof fetch,
  params: { userId: string },
): Promise<{ url: string }> {
  const session = await call<{ customer_portal_url?: unknown }>(
    config,
    fetchImpl,
    "/v1/customer-sessions/",
    { external_customer_id: params.userId, return_url: config.successUrl },
  );
  if (typeof session.customer_portal_url !== "string") {
    throw new Error("polar portal session answered without a url");
  }
  return { url: session.customer_portal_url };
}

// ---- Subscription events ----------------------------------------------------

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optString = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const parseTime = (value: unknown): number | null => {
  const text = optString(value);
  const ms = text ? Date.parse(text) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Subscription statuses in which the buyer has paid through `current_period_end`. */
const PAID_STATUSES: Record<string, true> = { active: true, trialing: true, past_due: true };

export type PolarEventResult = WriteOutcome | "ignored" | "no-user" | "invalid";

/**
 * One verified Polar webhook delivery. Only `subscription.*` events matter: each carries the whole
 * subscription, so the row is rewritten from it, ordered by the subscription's `modified_at`
 * (deliveries can arrive out of order, and a redelivery is a no-op). A cancelled-at-period-end
 * subscription stays `active` until the period ends; revoked / ended / unpaid ones lose access now.
 */
export async function processPolarEvent(
  db: D1Database,
  config: Pick<PolarConfig, "productIds">,
  payload: unknown,
  now: number,
): Promise<PolarEventResult> {
  if (!isObject(payload) || typeof payload.type !== "string") return "invalid";
  if (!payload.type.startsWith("subscription.")) return "ignored";
  const data = payload.data;
  if (!isObject(data)) return "invalid";

  const id = optString(data.id);
  const status = optString(data.status);
  if (!id || !status) return "invalid";
  const productId = optString(data.product_id);
  if (!polarProductPlan(config, productId)) return "ignored";

  const customer = isObject(data.customer) ? data.customer : {};
  const metadata = isObject(data.metadata) ? data.metadata : {};
  const userId = optString(customer.external_id) ?? optString(metadata.user_id);
  if (!userId) {
    console.error(`polar ${payload.type}: subscription ${id} has no Waqtu user`);
    return "no-user";
  }
  if (!(await userExists(db, userId))) {
    console.error(`polar ${payload.type}: subscription ${id} names unknown user ${userId}`);
    return "no-user";
  }

  const periodEnd = parseTime(data.current_period_end);
  const endedAt = parseTime(data.ends_at) ?? parseTime(data.ended_at);
  let expiresAt: number;
  if (PAID_STATUSES[status] === true) {
    if (periodEnd === null) return "invalid";
    expiresAt = periodEnd;
  } else {
    expiresAt = Math.min(endedAt ?? periodEnd ?? now, now);
  }

  return writeEntitlement(
    db,
    {
      userId,
      source: "polar",
      externalId: id,
      productId,
      environment: null,
      expiresAt,
      signedAt: parseTime(data.modified_at) ?? parseTime(data.created_at) ?? now,
    },
    now,
  );
}
