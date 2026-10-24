import { env } from "cloudflare:workers";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBillingHandler, type BillingHandler } from "../src/billing/routes";
import type { AppEnv } from "../src/env";
import { createUser, type TestUser } from "./helpers";

const DAY = 86_400_000;
const PACKAGE = "dat.waqtu.app";
const RTDN_TOKEN = "rtdn-shared-token-0123456789";
const PUSH_EMAIL = "push@waqtu-test.iam.gserviceaccount.com";
const API = "http://localhost";

const b64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const text = (value: string) => new TextEncoder().encode(value);

async function rsaKey() {
  return (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

/** Everything Google would say, plus a log of the calls our code made to it. */
class FakeGoogle {
  subscriptions = new Map<string, FakeSubscription>();
  requests: { method: string; url: string; auth: string | null }[] = [];
  failAcknowledge = false;
  failGet = false;
  publicJwk: (JsonWebKey & { kid: string }) | null = null;

  readonly fetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const auth = new Headers(init?.headers).get("authorization");
    this.requests.push({ method, url, auth });

    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "ya29.test", expires_in: 3600 });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs") {
      return Response.json({ keys: this.publicJwk ? [this.publicJwk] : [] });
    }
    const get = url.match(/\/purchases\/subscriptionsv2\/tokens\/([^/?]+)$/);
    if (get) {
      if (this.failGet) return new Response("boom", { status: 500 });
      const sub = this.subscriptions.get(decodeURIComponent(get[1]!));
      return sub ? Response.json(sub) : new Response("{}", { status: 404 });
    }
    if (url.endsWith(":acknowledge")) {
      if (this.failAcknowledge) return new Response("boom", { status: 500 });
      const token = decodeURIComponent(url.match(/tokens\/([^/:]+):acknowledge$/)![1]!);
      const sub = this.subscriptions.get(token);
      if (sub) sub.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
      return Response.json({});
    }
    return new Response("unexpected", { status: 500 });
  };

  acknowledges() {
    return this.requests.filter((r) => r.url.endsWith(":acknowledge")).length;
  }
}

interface FakeSubscription {
  subscriptionState: string;
  acknowledgementState: string;
  latestOrderId: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId: string };
  lineItems: {
    productId: string;
    expiryTime: string;
    latestSuccessfulOrderId: string;
    offerDetails: { basePlanId: string };
  }[];
}

interface SubscriptionOptions {
  state?: string;
  acknowledged?: boolean;
  orderId?: string;
  /** Milliseconds from now until the period ends (negative = already ended). */
  expiresIn?: number;
  productId?: string;
  basePlan?: string;
  accountId?: string;
}

const DEFAULT_ORDER = "GPA.1111-2222-3333-44444";

function subscription(o: SubscriptionOptions = {}): FakeSubscription {
  const orderId = o.orderId ?? DEFAULT_ORDER;
  return {
    subscriptionState: o.state ?? "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: o.acknowledged
      ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
      : "ACKNOWLEDGEMENT_STATE_PENDING",
    latestOrderId: orderId,
    ...(o.accountId
      ? { externalAccountIdentifiers: { obfuscatedExternalAccountId: o.accountId } }
      : {}),
    lineItems: [
      {
        productId: o.productId ?? "premium",
        expiryTime: new Date(Date.now() + (o.expiresIn ?? 30 * DAY)).toISOString(),
        latestSuccessfulOrderId: orderId,
        offerDetails: { basePlanId: o.basePlan ?? "monthly" },
      },
    ],
  };
}

const tokenOf = (name: string) => `token-${name}-${crypto.randomUUID()}`;

let google: FakeGoogle;
let handle: BillingHandler;
let googleEnv: AppEnv;
let pushKeys: CryptoKeyPair;

beforeAll(async () => {
  const account = await rsaKey();
  const pkcs8 = new Uint8Array(
    (await crypto.subtle.exportKey("pkcs8", account.privateKey)) as ArrayBuffer,
  );
  // The PEM armor is assembled from parts so no key-shaped literal sits in the source.
  const label = "PRIVATE KEY";
  const body = b64(pkcs8)
    .match(/.{1,64}/g)!
    .join("\n");
  const pem = [`-----BEGIN ${label}-----`, body, `-----END ${label}-----`, ""].join("\n");
  googleEnv = {
    ...env,
    BETTER_AUTH_URL: API,
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: "billing@waqtu-test.iam.gserviceaccount.com",
      private_key: pem,
      token_uri: "https://oauth2.googleapis.com/token",
    }),
    GOOGLE_PLAY_RTDN_TOKEN: RTDN_TOKEN,
    GOOGLE_PLAY_RTDN_PUSH_EMAIL: PUSH_EMAIL,
  };
  pushKeys = await rsaKey();
});

beforeEach(() => {
  google = new FakeGoogle();
  google.publicJwk = null;
  handle = createBillingHandler({ fetch: google.fetch });
});

function submit(token: unknown, user?: TestUser, e: AppEnv = googleEnv) {
  return handle(
    new Request(`${API}/v1/billing/google`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? { cookie: user.cookie } : {}) },
      body: JSON.stringify({ purchaseToken: token }),
    }),
    e,
  );
}

function entitlementOf(user: TestUser) {
  return handle(
    new Request(`${API}/v1/entitlement`, { headers: { cookie: user.cookie } }),
    env,
  ).then(
    (res) =>
      res!.json() as Promise<{ premium: boolean; source: string | null; expiresAt: string | null }>,
  );
}

function pubsub(message: Record<string, unknown>) {
  return { message: { data: b64url(text(JSON.stringify(message))) } };
}

const renewal = (purchaseToken: string) =>
  pubsub({
    packageName: PACKAGE,
    subscriptionNotification: { notificationType: 2, purchaseToken, subscriptionId: "premium" },
  });

function rtdn(body: unknown, init: { token?: string; bearer?: string } = {}) {
  const query = init.token === undefined ? "" : `?token=${init.token}`;
  return handle(
    new Request(`${API}/v1/billing/google/rtdn${query}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(init.bearer ? { authorization: `Bearer ${init.bearer}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    googleEnv,
  );
}

describe("POST /v1/billing/google", () => {
  it("is unavailable without a service account", async () => {
    const user = await createUser("g-off");
    const res = await submit(tokenOf("off"), user, {
      ...env,
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: undefined,
    });
    expect(res!.status).toBe(404);
  });

  it("requires a session and a well-formed token", async () => {
    expect((await submit(tokenOf("anon")))!.status).toBe(401);
    const user = await createUser("g-shape");
    expect((await submit("short", user))!.status).toBe(400);
    expect((await submit({ not: "a string" }, user))!.status).toBe(400);
  });

  it("verifies with Google, grants until the expiry it reports, then acknowledges", async () => {
    const user = await createUser("g-buy");
    const token = tokenOf("buy");
    const sub = subscription({ accountId: user.id });
    google.subscriptions.set(token, sub);
    const expiry = sub.lineItems[0]!.expiryTime;

    const res = await submit(token, user);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({
      premium: true,
      source: "google",
      expiresAt: new Date(expiry).toISOString(),
      pending: false,
    });
    expect(google.acknowledges()).toBe(1);
    // Every Google call carried the service account's OAuth token.
    const publisher = google.requests.filter((r) => r.url.includes("androidpublisher"));
    expect(publisher.length).toBeGreaterThan(0);
    expect(publisher.every((r) => r.auth === "Bearer ya29.test")).toBe(true);

    // A replay (restore on the next start) stays idempotent and does not acknowledge again.
    expect((await submit(token, user))!.status).toBe(200);
    expect(google.acknowledges()).toBe(1);
    expect((await entitlementOf(user)).premium).toBe(true);
  });

  it("rejects a token Google does not know and one for another product", async () => {
    const user = await createUser("g-bad");
    expect((await submit(tokenOf("unknown"), user))!.status).toBe(400);

    const other = tokenOf("other-product");
    google.subscriptions.set(other, subscription({ productId: "other" }));
    expect((await submit(other, user))!.status).toBe(400);

    const planless = tokenOf("other-plan");
    google.subscriptions.set(planless, subscription({ basePlan: "weekly" }));
    expect((await submit(planless, user))!.status).toBe(400);
    expect((await entitlementOf(user)).premium).toBe(false);
  });

  it("refuses a purchase made for another account, or already held by one", async () => {
    const owner = await createUser("g-owner");
    const other = await createUser("g-other");
    const token = tokenOf("shared");
    google.subscriptions.set(token, subscription({ accountId: owner.id }));
    const foreign = await submit(token, other);
    expect(foreign!.status).toBe(409);
    expect(await foreign!.json()).toEqual({ error: "linked_to_other_account" });

    // Without an obfuscated id, the first account to submit the token keeps it.
    const bare = tokenOf("bare");
    google.subscriptions.set(bare, subscription());
    expect((await submit(bare, owner))!.status).toBe(200);
    expect((await submit(bare, other))!.status).toBe(409);
    expect((await entitlementOf(other)).premium).toBe(false);
  });

  it("grants nothing while the payment is pending", async () => {
    const user = await createUser("g-pending");
    const token = tokenOf("pending");
    google.subscriptions.set(token, subscription({ state: "SUBSCRIPTION_STATE_PENDING" }));
    const res = await submit(token, user);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toMatchObject({ premium: false, pending: true });
    expect(google.acknowledges()).toBe(0);
  });

  it("keeps a canceled subscription until it ends and drops one on hold or expired", async () => {
    const user = await createUser("g-states");
    const canceled = tokenOf("canceled");
    google.subscriptions.set(canceled, subscription({ state: "SUBSCRIPTION_STATE_CANCELED" }));
    await submit(canceled, user);
    expect((await entitlementOf(user)).premium).toBe(true);

    const lapsed = await createUser("g-lapsed");
    const held = tokenOf("hold");
    google.subscriptions.set(
      held,
      subscription({ state: "SUBSCRIPTION_STATE_ON_HOLD", expiresIn: 10 * DAY }),
    );
    expect((await submit(held, lapsed))!.status).toBe(200);
    expect((await entitlementOf(lapsed)).premium).toBe(false);

    const expired = tokenOf("expired");
    google.subscriptions.set(
      expired,
      subscription({ state: "SUBSCRIPTION_STATE_EXPIRED", expiresIn: -DAY }),
    );
    await submit(expired, lapsed);
    expect((await entitlementOf(lapsed)).premium).toBe(false);
  });

  it("answers 502 when Google is down, and keeps the grant when only the acknowledge fails", async () => {
    const user = await createUser("g-down");
    const token = tokenOf("down");
    google.subscriptions.set(token, subscription());
    google.failGet = true;
    expect((await submit(token, user))!.status).toBe(502);
    expect((await entitlementOf(user)).premium).toBe(false);

    google.failGet = false;
    google.failAcknowledge = true;
    expect((await submit(token, user))!.status).toBe(502);
    expect((await entitlementOf(user)).premium).toBe(true);

    google.failAcknowledge = false;
    expect((await submit(token, user))!.status).toBe(200);
    expect(google.acknowledges()).toBe(2);
  });
});

describe("POST /v1/billing/google/rtdn", () => {
  it("rejects a delivery without credentials or with the wrong token", async () => {
    expect((await rtdn(renewal("whatever-token-123")))!.status).toBe(401);
    expect((await rtdn(renewal("whatever-token-123"), { token: "nope" }))!.status).toBe(401);
  });

  it("is unavailable without a service account", async () => {
    const res = await handle(
      new Request(`${API}/v1/billing/google/rtdn?token=${RTDN_TOKEN}`, {
        method: "POST",
        body: "{}",
      }),
      { ...env, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: undefined },
    );
    expect(res!.status).toBe(404);
  });

  it("acknowledges test pings, malformed bodies and other packages", async () => {
    expect(
      (await rtdn(pubsub({ packageName: PACKAGE, testNotification: { version: "1.0" } }), {
        token: RTDN_TOKEN,
      }))!.status,
    ).toBe(204);
    expect((await rtdn({ nonsense: true }, { token: RTDN_TOKEN }))!.status).toBe(204);
    const foreign = pubsub({
      packageName: "com.other",
      subscriptionNotification: {
        notificationType: 2,
        purchaseToken: "foreign-token-0123456",
        subscriptionId: "premium",
      },
    });
    expect((await rtdn(foreign, { token: RTDN_TOKEN }))!.status).toBe(204);
    expect(google.requests).toHaveLength(0);
  });

  it("re-reads the purchase on a renewal and moves the period forward", async () => {
    const user = await createUser("g-renew");
    const token = tokenOf("renew");
    google.subscriptions.set(token, subscription());
    await submit(token, user);

    google.subscriptions.set(token, subscription({ acknowledged: true, expiresIn: 60 * DAY }));

    expect((await rtdn(renewal(token), { token: RTDN_TOKEN }))!.status).toBe(204);
    const view = await entitlementOf(user);
    expect(Date.parse(view.expiresAt!) - Date.now()).toBeGreaterThan(59 * DAY);
  });

  it("links a purchase that beat the app to the server, through its obfuscated account id", async () => {
    const user = await createUser("g-early");
    const token = tokenOf("early");
    google.subscriptions.set(token, subscription({ accountId: user.id }));
    expect((await rtdn(renewal(token), { token: RTDN_TOKEN }))!.status).toBe(204);
    expect((await entitlementOf(user)).premium).toBe(true);
  });

  it("ends premium on revocation and on a voided order, and re-grants on a newer order", async () => {
    const user = await createUser("g-void");
    const token = tokenOf("void");
    google.subscriptions.set(token, subscription());
    await submit(token, user);

    const voided = pubsub({
      packageName: PACKAGE,
      voidedPurchaseNotification: { purchaseToken: token, orderId: DEFAULT_ORDER, productType: 1 },
    });
    expect((await rtdn(voided, { token: RTDN_TOKEN }))!.status).toBe(204);
    expect((await entitlementOf(user)).premium).toBe(false);

    // Google still reports the refunded order as current: it stays refunded.
    await rtdn(renewal(token), { token: RTDN_TOKEN });
    expect((await entitlementOf(user)).premium).toBe(false);

    // A newer, charged order is a fresh purchase.
    google.subscriptions.set(token, subscription({ orderId: `${DEFAULT_ORDER}..0` }));
    await rtdn(renewal(token), { token: RTDN_TOKEN });
    expect((await entitlementOf(user)).premium).toBe(true);
  });

  it("answers 500 when Google fails so Pub/Sub redelivers", async () => {
    const user = await createUser("g-retry");
    const token = tokenOf("retry");
    google.subscriptions.set(token, subscription());
    await submit(token, user);
    google.failGet = true;
    expect((await rtdn(renewal(token), { token: RTDN_TOKEN }))!.status).toBe(500);
  });

  describe("Google-signed push JWT", () => {
    async function pushJwt(
      claims: Record<string, unknown>,
      key = pushKeys.privateKey,
      kid = "kid-1",
    ) {
      const head = b64url(text(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })));
      const body = b64url(
        text(
          JSON.stringify({
            iss: "https://accounts.google.com",
            aud: `${API}/v1/billing/google/rtdn`,
            email: PUSH_EMAIL,
            email_verified: true,
            exp: Math.floor(Date.now() / 1000) + 600,
            ...claims,
          }),
        ),
      );
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, text(`${head}.${body}`));
      return `${head}.${body}.${b64url(sig)}`;
    }

    beforeEach(async () => {
      const jwk = await crypto.subtle.exportKey("jwk", pushKeys.publicKey);
      google.publicJwk = { ...(jwk as JsonWebKey), kid: "kid-1" };
    });

    const ping = pubsub({ packageName: PACKAGE, testNotification: { version: "1.0" } });

    it("accepts a token from our push service account for our endpoint", async () => {
      expect((await rtdn(ping, { bearer: await pushJwt({}) }))!.status).toBe(204);
    });

    it("rejects wrong audience, wrong account, expiry and a foreign signature", async () => {
      const bad = [
        await pushJwt({ aud: `${API}/other` }),
        await pushJwt({ email: "attacker@evil.test" }),
        await pushJwt({ exp: Math.floor(Date.now() / 1000) - 10 }),
        await pushJwt({}, (await rsaKey()).privateKey),
      ];
      for (const bearer of bad) {
        expect((await rtdn(ping, { bearer }))!.status).toBe(401);
      }
    });
  });
});
