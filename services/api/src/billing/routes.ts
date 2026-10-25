import { getAuth } from "../auth";
import type { AppEnv } from "../env";
import {
  APPLE_IOS_APP,
  APPLE_MAC_APP,
  APPLE_ROOT_CA_G3_SHA256,
  verifyAppleNotificationJws,
  verifyAppleTransactionJws,
  type AppleApp,
  type AppleVerifyOptions,
} from "./apple";
import { handleAppleNotification, redeemAppleTransaction } from "./appleBilling";
import { readEntitlement } from "./entitlement";
import {
  createGoogleKeySource,
  createGooglePlayClient,
  googlePlayConfig,
  parsePushNotification,
  tokenMatches,
  verifyPushJwt,
  type GooglePlayClient,
} from "./google";
import { handleGoogleNotification, syncGooglePurchase } from "./googleBilling";
import {
  createCheckout,
  createPortalSession,
  polarConfig,
  processPolarEvent,
  verifyWebhook,
  type PolarPlan,
} from "./polar";

export const ENTITLEMENT_PATH = "/v1/entitlement";
export const APPLE_PATH = "/v1/billing/apple";
export const APPLE_NOTIFICATIONS_PATH = "/v1/billing/apple/notifications";
export const GOOGLE_PATH = "/v1/billing/google";
export const GOOGLE_RTDN_PATH = "/v1/billing/google/rtdn";
export const POLAR_CHECKOUT_PATH = "/v1/billing/polar/checkout";
export const POLAR_PORTAL_PATH = "/v1/billing/polar/portal";
export const POLAR_WEBHOOK_PATH = "/v1/billing/polar/webhook";

const MAX_BODY_BYTES = 64_000;
/** Play purchase tokens are URL-safe; the pattern keeps junk out of the Android Publisher path. */
const PURCHASE_TOKEN = /^[A-Za-z0-9._-]{10,2048}$/;

/** The outside world the billing routes touch; tests replace exactly these. */
export interface BillingOptions {
  /** HTTP boundary to Google and the Polar API. */
  fetch?: typeof fetch;
  /** SHA-256 of the Apple root certificate to pin. Only tests pin another root. */
  appleRootSha256?: string;
  now?: () => number;
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const noContent = (): Response => new Response(null, { status: 204 });

const methodNotAllowed = (allow: string): Response =>
  Response.json(
    { error: "method_not_allowed" },
    { status: 405, headers: { allow, "cache-control": "no-store" } },
  );

async function readBody(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) return null;
  const text = await request.text();
  return text.length > MAX_BODY_BYTES ? null : text;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await readBody(request);
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Answers a billing request, or null when the path is not a billing route. */
export type BillingHandler = (request: Request, env: AppEnv) => Promise<Response | null>;

/**
 * Premium routes under `/v1/entitlement` and `/v1/billing`. Returns null for any other path so the
 * app router keeps handling sync and `/v1/me`.
 *
 * One Waqtu subscription unlocks mobile and the Mac app. Every source (App Store on iPhone and Mac,
 * Play, Polar) writes rows into the same entitlement table and `GET /v1/entitlement` resolves them.
 * Trust never comes from a client claim: Apple receipts are JWS chains verified to the pinned Apple
 * root, Play purchases are re-read from the Android Publisher API, Polar deliveries are HMAC-signed.
 */
export function createBillingHandler(options: BillingOptions = {}): BillingHandler {
  const now = options.now ?? Date.now;
  const fetchImpl: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const appleOptions = (env: AppEnv): AppleVerifyOptions => {
    const withAppId = (app: AppleApp, raw: string | undefined): AppleApp => {
      const appId = Number(raw?.trim());
      return Number.isSafeInteger(appId) && appId > 0 ? { ...app, appAppleId: appId } : app;
    };
    return {
      rootSha256: options.appleRootSha256 ?? APPLE_ROOT_CA_G3_SHA256,
      apps: [
        withAppId(APPLE_IOS_APP, env.APPLE_APP_ID),
        withAppId(APPLE_MAC_APP, env.APPLE_MAC_APP_ID),
      ],
    };
  };

  let googleClient: { source: string; client: GooglePlayClient } | null = null;
  const signingKey = createGoogleKeySource(fetchImpl, now);

  async function sessionUser(env: AppEnv, request: Request) {
    const session = await getAuth(env).api.getSession({ headers: request.headers });
    return session?.user ?? null;
  }

  const unauthorized = () => json({ error: "unauthorized" }, 401);
  const unavailable = () => json({ error: "unavailable" }, 404);

  async function view(env: AppEnv, userId: string) {
    return readEntitlement(env.APP_DB, userId, now());
  }

  async function appleSubmit(env: AppEnv, request: Request): Promise<Response> {
    const user = await sessionUser(env, request);
    if (!user) return unauthorized();
    const body = await readJson(request);
    const signed = body?.signedTransaction;
    if (typeof signed !== "string" || !signed) return json({ error: "invalid_request" }, 400);

    const verification = await verifyAppleTransactionJws(signed, appleOptions(env));
    if (!verification.ok) {
      console.error(`apple billing rejected: ${verification.reason}`);
      return json({ error: "invalid_receipt" }, 400);
    }
    const result = await redeemAppleTransaction(
      env.APP_DB,
      user.id,
      verification.transaction,
      now(),
    );
    if (!result.ok) {
      return result.error === "other-account"
        ? json({ error: "linked_to_other_account" }, 409)
        : json({ error: "invalid_receipt" }, 400);
    }
    return json(await view(env, user.id));
  }

  async function appleNotification(env: AppEnv, request: Request): Promise<Response> {
    const body = await readJson(request);
    const signed = body?.signedPayload;
    if (typeof signed !== "string" || !signed) return json({ error: "invalid_request" }, 400);
    const verification = await verifyAppleNotificationJws(signed, appleOptions(env));
    if (!verification.ok) {
      console.error(`apple notification rejected: ${verification.reason}`);
      return json({ error: "invalid_payload" }, 400);
    }
    try {
      await handleAppleNotification(env.APP_DB, verification.notification, now());
      return json({ received: true });
    } catch (error) {
      console.error("apple notification failed:", error);
      return json({ error: "retry" }, 500);
    }
  }

  function googleDeps(env: AppEnv) {
    const config = googlePlayConfig(env);
    if (!config) return null;
    const source = `${config.clientEmail}|${config.packageName}|${config.privateKeyPem}`;
    if (googleClient?.source !== source) {
      googleClient = { source, client: createGooglePlayClient(config, fetchImpl, now) };
    }
    return { config, deps: { db: env.APP_DB, client: googleClient.client, now } };
  }

  async function googleSubmit(env: AppEnv, request: Request): Promise<Response> {
    const google = googleDeps(env);
    if (!google) return unavailable();
    const user = await sessionUser(env, request);
    if (!user) return unauthorized();
    const body = await readJson(request);
    const purchaseToken = body?.purchaseToken;
    if (typeof purchaseToken !== "string" || !PURCHASE_TOKEN.test(purchaseToken)) {
      return json({ error: "invalid_request" }, 400);
    }

    let result;
    try {
      result = await syncGooglePurchase(google.deps, { purchaseToken, userId: user.id });
    } catch (error) {
      console.error("google billing verify failed:", error);
      return json({ error: "google_unreachable" }, 502);
    }
    if (!result.ok) {
      return result.error === "other-account"
        ? json({ error: "linked_to_other_account" }, 409)
        : json({ error: "invalid_receipt" }, 400);
    }
    return json({ ...(await view(env, user.id)), pending: result.status === "pending" });
  }

  async function googleRtdn(env: AppEnv, request: Request, url: URL): Promise<Response> {
    const google = googleDeps(env);
    if (!google) return unavailable();
    const { config } = google;

    const queryToken = url.searchParams.get("token");
    const bearer = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const audience = `${(env.BETTER_AUTH_URL ?? url.origin).replace(/\/$/, "")}${GOOGLE_RTDN_PATH}`;
    const authorized =
      (config.pushToken !== null &&
        queryToken !== null &&
        tokenMatches(queryToken, config.pushToken)) ||
      (config.pushEmail !== null &&
        bearer !== undefined &&
        (await verifyPushJwt(bearer, {
          audience,
          email: config.pushEmail,
          key: signingKey,
          nowMs: now(),
        }).catch(() => false)));
    if (!authorized) return json({ error: "unauthorized" }, 401);

    const notification = parsePushNotification(await readJson(request));
    // Not ours (other app, test ping, malformed): acknowledge so Pub/Sub stops retrying.
    if (!notification || notification.test || notification.packageName !== config.packageName) {
      return noContent();
    }
    try {
      await handleGoogleNotification(google.deps, notification);
      return noContent();
    } catch (error) {
      // Play or D1 hiccup: a non-2xx makes Pub/Sub redeliver.
      console.error("google rtdn failed:", error);
      return json({ error: "retry" }, 500);
    }
  }

  async function polarCheckout(env: AppEnv, request: Request): Promise<Response> {
    const config = polarConfig(env);
    if (!config) return unavailable();
    const user = await sessionUser(env, request);
    if (!user) return unauthorized();
    const body = await readJson(request);
    const plan = body?.plan;
    if (plan !== "monthly" && plan !== "yearly") return json({ error: "invalid_request" }, 400);
    // A second paid plan helps nobody: premium from any source already covers every platform.
    if ((await view(env, user.id)).premium) return json({ error: "already_premium" }, 409);
    try {
      const { url } = await createCheckout(config, fetchImpl, {
        plan: plan as PolarPlan,
        userId: user.id,
        email: user.email,
        name: user.name,
      });
      return json({ url });
    } catch (error) {
      console.error(`polar checkout for ${user.id} failed:`, error);
      return json({ error: "polar_unreachable" }, 502);
    }
  }

  async function polarPortal(env: AppEnv, request: Request): Promise<Response> {
    const config = polarConfig(env);
    if (!config) return unavailable();
    const user = await sessionUser(env, request);
    if (!user) return unauthorized();
    try {
      const { url } = await createPortalSession(config, fetchImpl, { userId: user.id });
      return json({ url });
    } catch (error) {
      console.error(`polar portal for ${user.id} failed:`, error);
      return json({ error: "polar_unreachable" }, 502);
    }
  }

  async function polarWebhook(env: AppEnv, request: Request): Promise<Response> {
    // Subscription events need the web subscription products and are ignored until those are configured.
    const webhookSecret = env.POLAR_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) return unavailable();
    const raw = await readBody(request);
    if (raw === null) return json({ error: "payload_too_large" }, 413);
    const verified = await verifyWebhook(
      raw,
      {
        id: request.headers.get("webhook-id") ?? "",
        timestamp: request.headers.get("webhook-timestamp") ?? "",
        signature: request.headers.get("webhook-signature") ?? "",
      },
      webhookSecret,
      now(),
    );
    if (!verified) return json({ error: "invalid_signature" }, 401);

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    try {
      const config = polarConfig(env);
      const outcome = config
        ? await processPolarEvent(env.APP_DB, config, payload, now())
        : "ignored";
      return json({ received: true, outcome }, 202);
    } catch (error) {
      console.error("polar webhook failed:", error);
      return json({ error: "retry" }, 500);
    }
  }

  return async function handleBilling(request: Request, env: AppEnv): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    const inScope =
      path === ENTITLEMENT_PATH ||
      path.startsWith(`${ENTITLEMENT_PATH}/`) ||
      path.startsWith("/v1/billing/");
    if (!inScope) return null;

    const routes: Record<string, { method: "GET" | "POST"; run: () => Promise<Response> }> = {
      [ENTITLEMENT_PATH]: {
        method: "GET",
        run: async () => {
          const user = await sessionUser(env, request);
          if (!user) return unauthorized();
          return json(await view(env, user.id));
        },
      },
      [APPLE_PATH]: { method: "POST", run: () => appleSubmit(env, request) },
      [APPLE_NOTIFICATIONS_PATH]: { method: "POST", run: () => appleNotification(env, request) },
      [GOOGLE_PATH]: { method: "POST", run: () => googleSubmit(env, request) },
      [GOOGLE_RTDN_PATH]: { method: "POST", run: () => googleRtdn(env, request, url) },
      [POLAR_CHECKOUT_PATH]: { method: "POST", run: () => polarCheckout(env, request) },
      [POLAR_PORTAL_PATH]: { method: "POST", run: () => polarPortal(env, request) },
      [POLAR_WEBHOOK_PATH]: { method: "POST", run: () => polarWebhook(env, request) },
    };
    const route = Object.hasOwn(routes, path) ? routes[path] : undefined;
    if (!route) return json({ error: "not_found" }, 404);
    if (request.method !== route.method) return methodNotAllowed(route.method);
    return route.run();
  };
}

export const handleBilling = createBillingHandler();
