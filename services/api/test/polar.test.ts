import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { writeEntitlement } from "../src/billing/entitlement";
import { verifyWebhook } from "../src/billing/polar";
import { createBillingHandler, type BillingHandler } from "../src/billing/routes";
import type { AppEnv } from "../src/env";
import { createUser, type TestUser } from "./helpers";

const DAY = 86_400_000;
const API = "http://localhost";
const SECRET = `whsec_${btoa("polar-test-secret-0123456789abcdef")}`;

const polarEnv: AppEnv = {
  ...env,
  POLAR_ACCESS_TOKEN: "polar_oat_test",
  POLAR_ORG_ID: "org-waqtu",
  POLAR_WEBHOOK_SECRET: SECRET,
  POLAR_PRODUCT_MONTHLY_ID: "prod-monthly",
  POLAR_PRODUCT_YEARLY_ID: "prod-yearly",
};

async function sign(id: string, timestamp: number, body: string, secret = SECRET) {
  const raw = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
}

describe("verifyWebhook", () => {
  const body = JSON.stringify({ type: "subscription.active", data: {} });
  const nowMs = Date.now();
  const timestamp = Math.floor(nowMs / 1000);

  it("accepts a correctly signed delivery", async () => {
    const signature = await sign("evt_1", timestamp, body);
    expect(
      await verifyWebhook(
        body,
        { id: "evt_1", timestamp: String(timestamp), signature },
        SECRET,
        nowMs,
      ),
    ).toBe(true);
  });

  it("accepts any matching entry of a multi-signature header", async () => {
    const good = await sign("evt_1", timestamp, body);
    const signature = `v1,${btoa("not-the-mac")} ${good}`;
    expect(
      await verifyWebhook(
        body,
        { id: "evt_1", timestamp: String(timestamp), signature },
        SECRET,
        nowMs,
      ),
    ).toBe(true);
  });

  it("accepts a legacy secret that keys the HMAC with the whole string", async () => {
    const legacy = "whsec_legacy-secret-not-base64!";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(legacy),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`evt_1.${timestamp}.${body}`),
    );
    const signature = `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`;
    expect(
      await verifyWebhook(
        body,
        { id: "evt_1", timestamp: String(timestamp), signature },
        legacy,
        nowMs,
      ),
    ).toBe(true);
  });

  it("rejects a tampered body, another secret, a stale timestamp and missing headers", async () => {
    const signature = await sign("evt_1", timestamp, body);
    const headers = { id: "evt_1", timestamp: String(timestamp), signature };
    expect(await verifyWebhook(`${body} `, headers, SECRET, nowMs)).toBe(false);
    expect(
      await verifyWebhook(
        body,
        headers,
        `whsec_${btoa("another-secret-0123456789abcdefgh")}`,
        nowMs,
      ),
    ).toBe(false);
    expect(await verifyWebhook(body, headers, SECRET, nowMs + 10 * 60_000)).toBe(false);
    expect(await verifyWebhook(body, { ...headers, id: "evt_2" }, SECRET, nowMs)).toBe(false);
    expect(await verifyWebhook(body, { ...headers, signature: "" }, SECRET, nowMs)).toBe(false);
    expect(await verifyWebhook(body, { ...headers, signature: "v2,abc" }, SECRET, nowMs)).toBe(
      false,
    );
  });
});

interface Call {
  url: string;
  method: string;
  auth: string | null;
  body: unknown;
}

/** Polar's HTTP API: records calls and answers from `respond`. */
function fakePolar(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      auth: new Headers(init?.headers).get("authorization"),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetchImpl };
}

function subscriptionEvent(type: string, userId: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type,
    data: {
      id: `sub_${userId}`,
      status: "active",
      customer_id: "cus_1",
      product_id: "prod-monthly",
      created_at: new Date(Date.now() - DAY).toISOString(),
      modified_at: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * DAY).toISOString(),
      cancel_at_period_end: false,
      metadata: {},
      customer: { id: "cus_1", external_id: userId },
      ...overrides,
    },
  });
}

describe("Polar webhook route", () => {
  let handle: BillingHandler;
  let user: TestUser;

  beforeEach(async () => {
    handle = createBillingHandler();
    user = await createUser(`polar-hook-${crypto.randomUUID()}`);
  });

  async function deliver(body: string, e: AppEnv = polarEnv, id = crypto.randomUUID()) {
    const timestamp = Math.floor(Date.now() / 1000);
    return handle(
      new Request(`${API}/v1/billing/polar/webhook`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "webhook-id": id,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": await sign(id, timestamp, body),
        },
        body,
      }),
      e,
    );
  }

  async function entitlement() {
    const res = await handle(
      new Request(`${API}/v1/entitlement`, { headers: { cookie: user.cookie } }),
      env,
    );
    return (await res!.json()) as {
      premium: boolean;
      source: string | null;
      expiresAt: string | null;
    };
  }

  it("is unavailable until Polar is configured", async () => {
    const res = await deliver(subscriptionEvent("subscription.active", user.id), {
      ...env,
      POLAR_WEBHOOK_SECRET: undefined,
    });
    expect(res!.status).toBe(404);
  });

  it("rejects an unsigned or wrongly signed delivery", async () => {
    const body = subscriptionEvent("subscription.active", user.id);
    const unsigned = await handle(
      new Request(`${API}/v1/billing/polar/webhook`, { method: "POST", body }),
      polarEnv,
    );
    expect(unsigned!.status).toBe(401);

    const timestamp = Math.floor(Date.now() / 1000);
    const forged = await handle(
      new Request(`${API}/v1/billing/polar/webhook`, {
        method: "POST",
        headers: {
          "webhook-id": "evt_x",
          "webhook-timestamp": String(timestamp),
          "webhook-signature": await sign(
            "evt_x",
            timestamp,
            body,
            `whsec_${btoa("forged-secret-0123456789abcdefgh")}`,
          ),
        },
        body,
      }),
      polarEnv,
    );
    expect(forged!.status).toBe(401);
    expect((await entitlement()).premium).toBe(false);
  });

  it("grants premium until the period end of an active subscription", async () => {
    const periodEnd = new Date(Date.now() + 30 * DAY).toISOString();
    const res = await deliver(
      subscriptionEvent("subscription.active", user.id, { current_period_end: periodEnd }),
    );
    expect(res!.status).toBe(202);
    expect(await entitlement()).toEqual({ premium: true, source: "polar", expiresAt: periodEnd });
  });

  it("finds the account through metadata when the customer has no external id", async () => {
    const res = await deliver(
      subscriptionEvent("subscription.created", user.id, {
        customer: { id: "cus_1", external_id: null },
        metadata: { user_id: user.id },
      }),
    );
    expect(res!.status).toBe(202);
    expect((await entitlement()).premium).toBe(true);
  });

  it("keeps access after a cancel until the period ends, then loses it on revoke", async () => {
    await deliver(subscriptionEvent("subscription.active", user.id));
    const canceled = await deliver(
      subscriptionEvent("subscription.canceled", user.id, {
        cancel_at_period_end: true,
        modified_at: new Date(Date.now() + 1000).toISOString(),
      }),
    );
    expect(canceled!.status).toBe(202);
    expect((await entitlement()).premium).toBe(true);

    await deliver(
      subscriptionEvent("subscription.revoked", user.id, {
        status: "canceled",
        ends_at: new Date(Date.now() - 1000).toISOString(),
        modified_at: new Date(Date.now() + 2000).toISOString(),
      }),
    );
    expect((await entitlement()).premium).toBe(false);
  });

  it("applies deliveries in subscription order, whatever order they arrive in", async () => {
    const newer = new Date(Date.now() + 5000).toISOString();
    const older = new Date(Date.now() + 1000).toISOString();
    const renewedEnd = new Date(Date.now() + 60 * DAY).toISOString();
    await deliver(
      subscriptionEvent("subscription.updated", user.id, {
        modified_at: newer,
        current_period_end: renewedEnd,
      }),
    );
    await deliver(subscriptionEvent("subscription.active", user.id, { modified_at: older }));
    expect((await entitlement()).expiresAt).toBe(renewedEnd);
  });

  it("is idempotent for a redelivered event", async () => {
    const body = subscriptionEvent("subscription.active", user.id);
    const id = "evt_redelivered";
    expect((await deliver(body, polarEnv, id))!.status).toBe(202);
    expect((await deliver(body, polarEnv, id))!.status).toBe(202);
    const count = await env.APP_DB.prepare(
      "SELECT COUNT(*) AS n FROM entitlement WHERE source = 'polar' AND user_id = ?1",
    )
      .bind(user.id)
      .first<{ n: number }>();
    expect(count!.n).toBe(1);
  });

  it("ignores other products, other event types and unknown users", async () => {
    const other = await deliver(
      subscriptionEvent("subscription.active", user.id, { product_id: "prod-mac-license" }),
    );
    expect(await other!.json()).toEqual({ received: true, outcome: "ignored" });
    const order = await deliver(JSON.stringify({ type: "order.paid", data: { id: "ord_1" } }));
    expect(await order!.json()).toEqual({ received: true, outcome: "ignored" });
    const ghost = await deliver(subscriptionEvent("subscription.active", "no-such-user"));
    expect(await ghost!.json()).toEqual({ received: true, outcome: "no-user" });
    expect((await entitlement()).premium).toBe(false);
  });
});

describe("Polar checkout and portal", () => {
  it("creates a hosted checkout tied to the account", async () => {
    const user = await createUser("polar-checkout");
    const polar = fakePolar(() => Response.json({ url: "https://polar.sh/checkout/abc" }));
    const handle = createBillingHandler({ fetch: polar.fetchImpl });
    const res = await handle(
      new Request(`${API}/v1/billing/polar/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ plan: "yearly" }),
      }),
      polarEnv,
    );
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ url: "https://polar.sh/checkout/abc" });
    expect(polar.calls).toHaveLength(1);
    expect(polar.calls[0]).toMatchObject({
      url: "https://api.polar.sh/v1/checkouts/",
      method: "POST",
      auth: "Bearer polar_oat_test",
      body: {
        products: ["prod-yearly"],
        external_customer_id: user.id,
        customer_email: user.email,
      },
    });
  });

  it("validates the plan, needs a session, and does not sell premium twice", async () => {
    const user = await createUser("polar-twice");
    const polar = fakePolar(() => Response.json({ url: "https://polar.sh/checkout/abc" }));
    const handle = createBillingHandler({ fetch: polar.fetchImpl });
    const checkout = (plan: unknown, cookie?: string) =>
      handle(
        new Request(`${API}/v1/billing/polar/checkout`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
          body: JSON.stringify({ plan }),
        }),
        polarEnv,
      );
    expect((await checkout("monthly"))!.status).toBe(401);
    expect((await checkout("weekly", user.cookie))!.status).toBe(400);

    const now = Date.now();
    await writeEntitlement(
      env.APP_DB,
      {
        userId: user.id,
        source: "apple",
        externalId: "orig-twice",
        productId: null,
        environment: "production",
        expiresAt: now + DAY,
        signedAt: now,
      },
      now,
    );
    const again = await checkout("monthly", user.cookie);
    expect(again!.status).toBe(409);
    expect(await again!.json()).toEqual({ error: "already_premium" });
    expect(polar.calls).toHaveLength(0);
  });

  it("answers 502 when Polar fails and 404 when it is not configured", async () => {
    const user = await createUser("polar-down");
    const polar = fakePolar(() => new Response("nope", { status: 500 }));
    const handle = createBillingHandler({ fetch: polar.fetchImpl });
    const request = (path: string) =>
      new Request(`${API}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: user.cookie },
        body: JSON.stringify({ plan: "monthly" }),
      });
    expect((await handle(request("/v1/billing/polar/checkout"), polarEnv))!.status).toBe(502);
    expect((await handle(request("/v1/billing/polar/portal"), polarEnv))!.status).toBe(502);
    expect(
      (await handle(request("/v1/billing/polar/checkout"), {
        ...env,
        POLAR_WEBHOOK_SECRET: undefined,
      }))!.status,
    ).toBe(404);
  });

  it("opens the customer portal for the account", async () => {
    const user = await createUser("polar-portal");
    const polar = fakePolar(() =>
      Response.json({ customer_portal_url: "https://polar.sh/portal/xyz" }),
    );
    const handle = createBillingHandler({ fetch: polar.fetchImpl });
    const res = await handle(
      new Request(`${API}/v1/billing/polar/portal`, {
        method: "POST",
        headers: { cookie: user.cookie },
      }),
      polarEnv,
    );
    expect(await res!.json()).toEqual({ url: "https://polar.sh/portal/xyz" });
    expect(polar.calls[0]).toMatchObject({
      url: "https://api.polar.sh/v1/customer-sessions/",
      body: { external_customer_id: user.id },
    });
  });
});

describe("POST /v1/entitlement/link-license", () => {
  const granted = (id = "lic_1") =>
    Response.json({ id, status: "granted", expires_at: null, key: "WAQTU-XXXX" });

  function link(key: unknown, user: TestUser | null, handle: BillingHandler, e: AppEnv = polarEnv) {
    return handle(
      new Request(`${API}/v1/entitlement/link-license`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(user ? { cookie: user.cookie } : {}) },
        body: JSON.stringify({ key }),
      }),
      e,
    );
  }

  it("grants lifetime premium for a granted Polar key", async () => {
    const user = await createUser("lic-ok");
    const polar = fakePolar(() => granted());
    const handle = createBillingHandler({ fetch: polar.fetchImpl });
    const res = await link("  WAQTU-XXXX  ", user, handle);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ premium: true, source: "license", expiresAt: null });
    expect(polar.calls[0]).toMatchObject({
      url: "https://api.polar.sh/v1/customer-portal/license-keys/validate",
      method: "POST",
      body: { key: "WAQTU-XXXX", organization_id: "org-waqtu" },
    });
  });

  it("keeps premium forever once every subscription has lapsed", async () => {
    const user = await createUser("lic-forever");
    const handle = createBillingHandler({
      fetch: fakePolar(() => granted("lic_forever")).fetchImpl,
    });
    await link("WAQTU-XXXX", user, handle);
    const years = 50 * 365 * DAY;
    const later = createBillingHandler({
      fetch: fakePolar(() => granted()).fetchImpl,
      now: () => Date.now() + years,
    });
    const res = await later(
      new Request(`${API}/v1/entitlement`, { headers: { cookie: user.cookie } }),
      env,
    );
    expect(await res!.json()).toEqual({ premium: true, source: "license", expiresAt: null });
  });

  it("is idempotent for the same account", async () => {
    const user = await createUser("lic-again");
    const handle = createBillingHandler({ fetch: fakePolar(() => granted("lic_again")).fetchImpl });
    expect((await link("WAQTU-XXXX", user, handle))!.status).toBe(200);
    expect((await link("WAQTU-XXXX", user, handle))!.status).toBe(200);
  });

  it("refuses a key another account already linked", async () => {
    const first = await createUser("lic-first");
    const second = await createUser("lic-second");
    const handle = createBillingHandler({
      fetch: fakePolar(() => granted("lic_shared")).fetchImpl,
    });
    expect((await link("WAQTU-XXXX", first, handle))!.status).toBe(200);
    const res = await link("WAQTU-XXXX", second, handle);
    expect(res!.status).toBe(409);
    expect(await res!.json()).toEqual({ error: "linked_to_other_account" });
  });

  it("rejects revoked, expired and unknown keys without granting anything", async () => {
    const user = await createUser("lic-bad");
    const responses = [
      Response.json({ id: "lic_r", status: "revoked", expires_at: null }),
      Response.json({ id: "lic_d", status: "disabled", expires_at: null }),
      Response.json({
        id: "lic_e",
        status: "granted",
        expires_at: new Date(Date.now() - DAY).toISOString(),
      }),
      new Response("{}", { status: 404 }),
      new Response("{}", { status: 422 }),
    ];
    for (const response of responses) {
      const handle = createBillingHandler({ fetch: fakePolar(() => response.clone()).fetchImpl });
      const res = await link("WAQTU-XXXX", user, handle);
      expect(res!.status).toBe(400);
      expect(await res!.json()).toEqual({ error: "invalid_license" });
    }
    const view = await createBillingHandler()(
      new Request(`${API}/v1/entitlement`, { headers: { cookie: user.cookie } }),
      env,
    );
    expect((await view!.json()) as { premium: boolean }).toMatchObject({ premium: false });
  });

  it("answers 502 when Polar is down or not configured, 401 without a session, 400 without a key", async () => {
    const user = await createUser("lic-down");
    const down = createBillingHandler({
      fetch: fakePolar(() => new Response("x", { status: 500 })).fetchImpl,
    });
    expect((await link("WAQTU-XXXX", user, down))!.status).toBe(502);
    expect(
      (await link("WAQTU-XXXX", user, down, { ...env, POLAR_ORG_ID: undefined }))!.status,
    ).toBe(502);
    expect((await link("WAQTU-XXXX", null, down))!.status).toBe(401);
    expect((await link("   ", user, down))!.status).toBe(400);
    expect((await link(42, user, down))!.status).toBe(400);
  });
});
