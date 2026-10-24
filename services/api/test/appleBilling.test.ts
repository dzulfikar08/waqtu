import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { APPLE_BUNDLE_ID, APPLE_PRODUCT_IDS, appleAccountToken } from "../src/billing/apple";
import { createBillingHandler, type BillingHandler } from "../src/billing/routes";
import { createTestAppleChain, type TestAppleChain } from "./appleChain";
import { createUser, type TestUser } from "./helpers";

const DAY = 86_400_000;
const [MONTHLY, YEARLY] = APPLE_PRODUCT_IDS;

let chain: TestAppleChain;
let handle: BillingHandler;

beforeAll(async () => {
  chain = await createTestAppleChain();
  handle = createBillingHandler({ appleRootSha256: chain.rootSha256 });
});

function post(path: string, body: unknown, user?: TestUser): Promise<Response | null> {
  return handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? { cookie: user.cookie } : {}) },
      body: JSON.stringify(body),
    }),
    env,
  );
}

function entitlementOf(user: TestUser) {
  return handle(
    new Request("http://localhost/v1/entitlement", { headers: { cookie: user.cookie } }),
    env,
  ).then(
    (res) =>
      res!.json() as Promise<{ premium: boolean; source: string | null; expiresAt: string | null }>,
  );
}

const transaction = (original: string, overrides: Record<string, unknown> = {}) => {
  const signedDate = Date.now() - 1000;
  return {
    transactionId: `${original}-${signedDate}`,
    originalTransactionId: original,
    bundleId: APPLE_BUNDLE_ID,
    productId: MONTHLY,
    environment: "Production",
    signedDate,
    expiresDate: Date.now() + 30 * DAY,
    ...overrides,
  };
};

async function notification(
  type: string,
  tx: Record<string, unknown>,
  extra: { subtype?: string; renewal?: Record<string, unknown>; signedDate?: number } = {},
) {
  return {
    signedPayload: await chain.sign({
      notificationType: type,
      subtype: extra.subtype,
      signedDate: extra.signedDate ?? Date.now(),
      data: {
        bundleId: APPLE_BUNDLE_ID,
        appAppleId: 6826628861,
        environment: tx.environment,
        signedTransactionInfo: await chain.sign(tx),
        ...(extra.renewal ? { signedRenewalInfo: await chain.sign(extra.renewal) } : {}),
      },
    }),
  };
}

describe("POST /v1/billing/apple", () => {
  it("requires a session", async () => {
    const res = await post("/v1/billing/apple", { signedTransaction: "x" });
    expect(res!.status).toBe(401);
  });

  it("grants premium until the store's period end", async () => {
    const user = await createUser("apple-buy");
    const tx = transaction("orig-buy", { appAccountToken: await appleAccountToken(user.id) });
    const res = await post("/v1/billing/apple", { signedTransaction: await chain.sign(tx) }, user);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({
      premium: true,
      source: "apple",
      expiresAt: new Date(tx.expiresDate as number).toISOString(),
    });
    expect((await entitlementOf(user)).premium).toBe(true);
  });

  it("is idempotent and the yearly product is accepted", async () => {
    const user = await createUser("apple-yearly");
    const tx = transaction("orig-yearly", {
      productId: YEARLY,
      expiresDate: Date.now() + 365 * DAY,
    });
    const body = { signedTransaction: await chain.sign(tx) };
    expect((await post("/v1/billing/apple", body, user))!.status).toBe(200);
    expect((await post("/v1/billing/apple", body, user))!.status).toBe(200);
    const rows = await env.APP_DB.prepare(
      "SELECT COUNT(*) AS n FROM entitlement WHERE source = 'apple' AND external_id = 'orig-yearly'",
    ).first<{ n: number }>();
    expect(rows!.n).toBe(1);
  });

  it("rejects a JWS from outside the pinned chain", async () => {
    const user = await createUser("apple-forged");
    const forger = await createTestAppleChain();
    const jws = await forger.sign(transaction("orig-forged"));
    const res = await post("/v1/billing/apple", { signedTransaction: jws }, user);
    expect(res!.status).toBe(400);
    expect(await res!.json()).toEqual({ error: "invalid_receipt" });
    expect((await entitlementOf(user)).premium).toBe(false);
  });

  it("rejects another app's bundle, an unknown product and a refunded transaction", async () => {
    const user = await createUser("apple-reject");
    for (const overrides of [
      { bundleId: "com.other.app" },
      { productId: "com.other.product" },
      { revocationDate: Date.now() - 1000 },
    ]) {
      const jws = await chain.sign(transaction("orig-reject", overrides));
      const res = await post("/v1/billing/apple", { signedTransaction: jws }, user);
      expect(res!.status, JSON.stringify(overrides)).toBe(400);
    }
  });

  it("refuses a subscription bought with another account's token or held by another account", async () => {
    const owner = await createUser("apple-owner");
    const other = await createUser("apple-other");
    const tx = transaction("orig-shared", { appAccountToken: await appleAccountToken(owner.id) });
    const jws = await chain.sign(tx);

    // Wrong appAccountToken for `other`.
    const wrongToken = await post("/v1/billing/apple", { signedTransaction: jws }, other);
    expect(wrongToken!.status).toBe(409);

    // Token-less (legacy) transaction: first account wins.
    const bare = await chain.sign(transaction("orig-bare"));
    expect((await post("/v1/billing/apple", { signedTransaction: bare }, owner))!.status).toBe(200);
    const taken = await post("/v1/billing/apple", { signedTransaction: bare }, other);
    expect(taken!.status).toBe(409);
    expect(await taken!.json()).toEqual({ error: "linked_to_other_account" });
    expect((await entitlementOf(other)).premium).toBe(false);
  });
});

describe("POST /v1/billing/apple/notifications", () => {
  async function subscribe(name: string, original: string) {
    const user = await createUser(name);
    const tx = transaction(original, { appAccountToken: await appleAccountToken(user.id) });
    await post("/v1/billing/apple", { signedTransaction: await chain.sign(tx) }, user);
    return { user, tx };
  }

  it("rejects an unsigned or foreign payload", async () => {
    const forger = await createTestAppleChain();
    const forged = await forger.sign({
      notificationType: "DID_RENEW",
      signedDate: Date.now(),
      data: { bundleId: APPLE_BUNDLE_ID },
    });
    expect((await post("/v1/billing/apple/notifications", { signedPayload: forged }))!.status).toBe(
      400,
    );
    expect((await post("/v1/billing/apple/notifications", {}))!.status).toBe(400);
  });

  it("acknowledges TEST", async () => {
    const payload = await chain.sign({
      notificationType: "TEST",
      signedDate: Date.now(),
      data: { bundleId: APPLE_BUNDLE_ID },
    });
    const res = await post("/v1/billing/apple/notifications", { signedPayload: payload });
    expect(res!.status).toBe(200);
  });

  it("extends premium on a renewal", async () => {
    const { user, tx } = await subscribe("apple-renew", "orig-renew");
    const renewedUntil = Date.now() + 60 * DAY;
    const renewed = { ...tx, transactionId: `${tx.transactionId}-2`, expiresDate: renewedUntil };
    const res = await post(
      "/v1/billing/apple/notifications",
      await notification("DID_RENEW", renewed, { subtype: undefined, signedDate: Date.now() + 10 }),
    );
    expect(res!.status).toBe(200);
    expect((await entitlementOf(user)).expiresAt).toBe(new Date(renewedUntil).toISOString());
  });

  it("ignores an older notification delivered after a newer one", async () => {
    const { user, tx } = await subscribe("apple-order", "orig-order");
    const newer = Date.now() + 2000;
    const renewedUntil = Date.now() + 60 * DAY;
    await post(
      "/v1/billing/apple/notifications",
      await notification("DID_RENEW", { ...tx, expiresDate: renewedUntil }, { signedDate: newer }),
    );
    await post(
      "/v1/billing/apple/notifications",
      await notification("SUBSCRIBED", tx, { signedDate: newer - 1000 }),
    );
    expect((await entitlementOf(user)).expiresAt).toBe(new Date(renewedUntil).toISOString());
  });

  it("ends premium on a refund", async () => {
    const { user, tx } = await subscribe("apple-refund", "orig-refund");
    const revocationDate = Date.now() - 1;
    const res = await post(
      "/v1/billing/apple/notifications",
      await notification("REFUND", { ...tx, revocationDate }, { signedDate: Date.now() + 2000 }),
    );
    expect(res!.status).toBe(200);
    const view = await entitlementOf(user);
    expect(view.premium).toBe(false);
    expect(view.expiresAt).toBe(new Date(revocationDate).toISOString());
  });

  it("keeps access when an earlier period's transaction is refunded, and ends it for the latest", async () => {
    const { user, tx } = await subscribe("apple-old-refund", "orig-old-refund");
    const renewedUntil = Date.now() + 60 * DAY;
    const renewed = { ...tx, transactionId: `${tx.transactionId}-2`, expiresDate: renewedUntil };
    await post(
      "/v1/billing/apple/notifications",
      await notification("DID_RENEW", renewed, { signedDate: Date.now() + 1000 }),
    );

    // Refund of the first month: the second month was paid and stays.
    const older = await post(
      "/v1/billing/apple/notifications",
      await notification(
        "REFUND",
        { ...tx, revocationDate: Date.now() - 1 },
        { signedDate: Date.now() + 2000 },
      ),
    );
    expect(older!.status).toBe(200);
    const kept = await entitlementOf(user);
    expect(kept.premium).toBe(true);
    expect(kept.expiresAt).toBe(new Date(renewedUntil).toISOString());

    // Refund of the transaction the stored period came from ends it.
    await post(
      "/v1/billing/apple/notifications",
      await notification(
        "REFUND",
        { ...renewed, revocationDate: Date.now() - 1 },
        { signedDate: Date.now() + 3000 },
      ),
    );
    expect((await entitlementOf(user)).premium).toBe(false);
  });

  it("keeps access through the billing grace period, then lets it lapse", async () => {
    const user = await createUser("apple-grace");
    const lapsed = Date.now() - 1000;
    const tx = transaction("orig-grace", {
      appAccountToken: await appleAccountToken(user.id),
      expiresDate: Date.now() + 1000,
    });
    await post("/v1/billing/apple", { signedTransaction: await chain.sign(tx) }, user);

    const grace = Date.now() + 5 * DAY;
    await post(
      "/v1/billing/apple/notifications",
      await notification(
        "DID_FAIL_TO_RENEW",
        { ...tx, expiresDate: lapsed },
        {
          subtype: "GRACE_PERIOD",
          signedDate: Date.now() + 2000,
          renewal: {
            originalTransactionId: "orig-grace",
            signedDate: Date.now(),
            autoRenewStatus: 1,
            gracePeriodExpiresDate: grace,
          },
        },
      ),
    );
    const inGrace = await entitlementOf(user);
    expect(inGrace.premium).toBe(true);
    expect(inGrace.expiresAt).toBe(new Date(grace).toISOString());

    await post(
      "/v1/billing/apple/notifications",
      await notification(
        "GRACE_PERIOD_EXPIRED",
        { ...tx, expiresDate: lapsed },
        { signedDate: Date.now() + 4000 },
      ),
    );
    expect((await entitlementOf(user)).premium).toBe(false);
  });

  it("acknowledges a subscription no account holds yet", async () => {
    const res = await post(
      "/v1/billing/apple/notifications",
      await notification("DID_RENEW", transaction("orig-nobody")),
    );
    expect(res!.status).toBe(200);
    const row = await env.APP_DB.prepare(
      "SELECT 1 FROM entitlement WHERE external_id = 'orig-nobody'",
    ).first();
    expect(row).toBeNull();
  });

  it("checks the App Store app id of Production notifications when APPLE_APP_ID is set", async () => {
    const send = async (appAppleId: number) => {
      const tx = transaction("orig-appid");
      const payload = await chain.sign({
        notificationType: "DID_RENEW",
        signedDate: Date.now(),
        data: {
          bundleId: APPLE_BUNDLE_ID,
          appAppleId,
          environment: "Production",
          signedTransactionInfo: await chain.sign(tx),
        },
      });
      return handle(
        new Request("http://localhost/v1/billing/apple/notifications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signedPayload: payload }),
        }),
        { ...env, APPLE_APP_ID: "6826628861" },
      );
    };
    expect((await send(1234))!.status).toBe(400);
    expect((await send(6826628861))!.status).toBe(200);
  });
});
