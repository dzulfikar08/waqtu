import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { LICENSE_RECHECK_MS } from "../src/billing/license";
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

/** What Polar says about a stored key when asked by id. */
interface FakePolar {
  /** Answer for `GET /v1/license-keys/{id}`. */
  keyStatus: () => Response;
  statusCalls: string[];
  fetchImpl: typeof fetch;
}

function fakePolar(licenseId: string, customerId: string): FakePolar {
  const polar: FakePolar = {
    keyStatus: () => Response.json({ id: licenseId, status: "granted", expires_at: null }),
    statusCalls: [],
    fetchImpl: async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/v1/customer-portal/license-keys/validate")) {
        return Response.json({
          id: licenseId,
          status: "granted",
          expires_at: null,
          customer_id: customerId,
        });
      }
      if (url.includes("/v1/license-keys/")) {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer polar_oat_test");
        polar.statusCalls.push(url);
        return polar.keyStatus();
      }
      return new Response("unexpected", { status: 500 });
    },
  };
  return polar;
}

interface Linked {
  user: TestUser;
  licenseId: string;
  customerId: string;
  polar: FakePolar;
  handle: BillingHandler;
}

async function linked(name: string): Promise<Linked> {
  const suffix = crypto.randomUUID();
  const licenseId = `lic_${suffix}`;
  const customerId = `cus_${suffix}`;
  const polar = fakePolar(licenseId, customerId);
  const handle = createBillingHandler({ fetch: polar.fetchImpl });
  const user = await createUser(`${name}-${suffix}`);
  const res = await handle(
    new Request(`${API}/v1/entitlement/link-license`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: user.cookie },
      body: JSON.stringify({ key: "WAQTU-XXXX" }),
    }),
    polarEnv,
  );
  expect(res!.status).toBe(200);
  return { user, licenseId, customerId, polar, handle };
}

async function entitlement(l: Linked, e: AppEnv = polarEnv) {
  const res = await l.handle(
    new Request(`${API}/v1/entitlement`, { headers: { cookie: l.user.cookie } }),
    e,
  );
  return (await res!.json()) as {
    premium: boolean;
    source: string | null;
    expiresAt: string | null;
  };
}

async function deliver(handle: BillingHandler, event: unknown) {
  const body = JSON.stringify(event);
  const id = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const raw = Uint8Array.from(atob(SECRET.slice(6)), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const res = await handle(
    new Request(`${API}/v1/billing/polar/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(mac)))}`,
      },
      body,
    }),
    polarEnv,
  );
  expect(res!.status).toBe(202);
  return ((await res!.json()) as { outcome: string }).outcome;
}

const grantRevoked = (licenseId: string, benefitType = "license_keys") => ({
  type: "benefit_grant.revoked",
  data: {
    id: "grant_1",
    is_revoked: true,
    customer_id: "cus_x",
    benefit: { id: "ben_1", type: benefitType },
    properties: { license_key_id: licenseId, display_key: "WAQTU-****" },
  },
});

const orderRefunded = (customerId: string) => ({
  type: "order.refunded",
  data: { id: "ord_1", customer_id: customerId, status: "refunded", refunded_amount: 100 },
});

function setCheckedAt(licenseId: string, checkedAt: number | null) {
  return env.APP_DB.prepare(
    "UPDATE entitlement SET checked_at = ?1 WHERE source = 'license' AND external_id = ?2",
  )
    .bind(checkedAt, licenseId)
    .run();
}

describe("a refunded Mac license", () => {
  let l: Linked;

  beforeEach(async () => {
    l = await linked("lic-refund");
  });

  it("is lifetime premium right after linking", async () => {
    expect(await entitlement(l)).toEqual({ premium: true, source: "license", expiresAt: null });
    expect(l.polar.statusCalls).toHaveLength(0);
  });

  it("loses premium when Polar revokes the license-key benefit grant", async () => {
    expect(await deliver(l.handle, grantRevoked(l.licenseId))).toBe("revoked");
    const view = await entitlement(l);
    expect(view.premium).toBe(false);
    expect(view.source).toBe("license");
    expect(view.expiresAt).not.toBeNull();
  });

  it("keeps a revoked license revoked even if the stored check is old", async () => {
    await deliver(l.handle, grantRevoked(l.licenseId));
    await setCheckedAt(l.licenseId, 0);
    expect((await entitlement(l)).premium).toBe(false);
    expect(l.polar.statusCalls).toHaveLength(0);
  });

  it("ignores other benefit types, unknown keys and keys of other accounts", async () => {
    expect(await deliver(l.handle, grantRevoked(l.licenseId, "downloadables"))).toBe("ignored");
    expect(await deliver(l.handle, grantRevoked("lic_never_linked"))).toBe("ignored");
    expect((await entitlement(l)).premium).toBe(true);

    const other = await linked("lic-bystander");
    await deliver(l.handle, grantRevoked(l.licenseId));
    expect((await entitlement(other)).premium).toBe(true);
  });

  it("re-checks the customer's keys after an order refund, whichever event arrives first", async () => {
    expect(await deliver(l.handle, orderRefunded(l.customerId))).toBe("rechecked");
    expect(await deliver(l.handle, orderRefunded("cus_someone_else"))).toBe("ignored");

    // Polar revoked the key by the time the user next reads: premium ends.
    l.polar.keyStatus = () =>
      Response.json({ id: l.licenseId, status: "revoked", expires_at: null });
    expect((await entitlement(l)).premium).toBe(false);
    expect(l.polar.statusCalls).toHaveLength(1);
    expect(l.polar.statusCalls[0]).toContain(`/v1/license-keys/${l.licenseId}`);
  });

  it("keeps premium after a partial refund that left the key granted, and stops asking", async () => {
    await deliver(l.handle, orderRefunded(l.customerId));
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(1);
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(1);
  });
});

describe("lazy license re-validation", () => {
  it("does not ask Polar while the last check is younger than a week", async () => {
    const l = await linked("lic-fresh");
    await setCheckedAt(l.licenseId, Date.now() - (LICENSE_RECHECK_MS - DAY));
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(0);
  });

  it("asks Polar when the last check is older than a week, and revokes a key Polar no longer grants", async () => {
    const l = await linked("lic-stale");
    await setCheckedAt(l.licenseId, Date.now() - LICENSE_RECHECK_MS - DAY);
    l.polar.keyStatus = () =>
      Response.json({ id: l.licenseId, status: "revoked", expires_at: null });
    expect((await entitlement(l)).premium).toBe(false);
    expect(l.polar.statusCalls).toHaveLength(1);
    // Revoked rows are not asked about again.
    expect((await entitlement(l)).premium).toBe(false);
    expect(l.polar.statusCalls).toHaveLength(1);
  });

  it("stamps a still-granted key as confirmed", async () => {
    const l = await linked("lic-ok");
    await setCheckedAt(l.licenseId, Date.now() - LICENSE_RECHECK_MS - DAY);
    expect((await entitlement(l)).premium).toBe(true);
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(1);
  });

  it("treats a key Polar no longer knows, disabled, or expired as revoked", async () => {
    for (const answer of [
      () => new Response("{}", { status: 404 }),
      () => Response.json({ status: "disabled", expires_at: null }),
      () =>
        Response.json({ status: "granted", expires_at: new Date(Date.now() - DAY).toISOString() }),
    ]) {
      const l = await linked("lic-gone");
      await setCheckedAt(l.licenseId, 0);
      l.polar.keyStatus = answer;
      expect((await entitlement(l)).premium).toBe(false);
    }
  });

  it("never takes premium away because Polar is unreachable, and retries within the hour only once", async () => {
    const l = await linked("lic-outage");
    await setCheckedAt(l.licenseId, 0);
    l.polar.keyStatus = () => new Response("down", { status: 503 });
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(1);
    expect((await entitlement(l)).premium).toBe(true);
    expect(l.polar.statusCalls).toHaveLength(1);

    // An hour later the check is due again and Polar answers.
    const later = createBillingHandler({
      fetch: l.polar.fetchImpl,
      now: () => Date.now() + 2 * 60 * 60 * 1000,
    });
    l.polar.keyStatus = () =>
      Response.json({ id: l.licenseId, status: "revoked", expires_at: null });
    l.handle = later;
    expect((await entitlement(l)).premium).toBe(false);
    expect(l.polar.statusCalls).toHaveLength(2);
  });

  it("survives a network error and does nothing without a Polar token", async () => {
    const l = await linked("lic-neterr");
    await setCheckedAt(l.licenseId, 0);
    const failing = createBillingHandler({
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    });
    l.handle = failing;
    expect((await entitlement(l)).premium).toBe(true);

    const l2 = await linked("lic-notoken");
    await setCheckedAt(l2.licenseId, 0);
    expect((await entitlement(l2, { ...env, POLAR_ACCESS_TOKEN: undefined })).premium).toBe(true);
    expect(l2.polar.statusCalls).toHaveLength(0);
  });

  it("does not affect another source's entitlement", async () => {
    const l = await linked("lic-other-source");
    const now = Date.now();
    await env.APP_DB.prepare(
      `INSERT INTO entitlement (source, external_id, user_id, expires_at, signed_at, created_at, updated_at)
       VALUES ('apple', ?1, ?2, ?3, ?4, ?4, ?4)`,
    )
      .bind(`orig-${l.licenseId}`, l.user.id, now + 10 * DAY, now)
      .run();
    await setCheckedAt(l.licenseId, 0);
    l.polar.keyStatus = () => Response.json({ status: "revoked", expires_at: null });
    const view = await entitlement(l);
    expect(view.premium).toBe(true);
    expect(view.source).toBe("apple");
  });
});
