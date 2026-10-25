import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  readEntitlement,
  resolveEntitlement,
  writeEntitlement,
  type EntitlementWrite,
} from "../src/billing/entitlement";
import { api, createUser } from "./helpers";

const NOW = Date.parse("2026-10-24T00:00:00Z");
const DAY = 86_400_000;

describe("resolveEntitlement", () => {
  it("is not premium without any entitlement", () => {
    expect(resolveEntitlement([], NOW)).toEqual({ premium: false, source: null, expiresAt: null });
  });

  it("is premium until the paid period ends", () => {
    const view = resolveEntitlement([{ source: "apple", expires_at: NOW + DAY }], NOW);
    expect(view).toEqual({
      premium: true,
      source: "apple",
      expiresAt: new Date(NOW + DAY).toISOString(),
    });
  });

  it("lapses exactly at expiry and reports what lapsed", () => {
    const view = resolveEntitlement([{ source: "google", expires_at: NOW }], NOW);
    expect(view).toEqual({
      premium: false,
      source: "google",
      expiresAt: new Date(NOW).toISOString(),
    });
    expect(resolveEntitlement([{ source: "google", expires_at: NOW }], NOW - 1).premium).toBe(true);
  });

  it("reports the source with the latest expiry among several", () => {
    const view = resolveEntitlement(
      [
        { source: "apple", expires_at: NOW + 3 * DAY },
        { source: "polar", expires_at: NOW + 20 * DAY },
        { source: "google", expires_at: NOW - DAY },
      ],
      NOW,
    );
    expect(view.source).toBe("polar");
    expect(view.expiresAt).toBe(new Date(NOW + 20 * DAY).toISOString());
  });

  it("stays premium when one source lapses but another is live", () => {
    const view = resolveEntitlement(
      [
        { source: "apple", expires_at: NOW - DAY },
        { source: "google", expires_at: NOW + DAY },
      ],
      NOW,
    );
    expect(view.premium).toBe(true);
    expect(view.source).toBe("google");
  });
});

const write = (userId: string, overrides: Partial<EntitlementWrite> = {}): EntitlementWrite => ({
  userId,
  source: "apple",
  externalId: `orig-${crypto.randomUUID()}`,
  productId: "dat.waqtu.premium.monthly",
  environment: "production",
  expiresAt: NOW + 30 * DAY,
  signedAt: NOW,
  ...overrides,
});

describe("writeEntitlement", () => {
  it("moves a subscription forward only", async () => {
    const user = await createUser("write-forward");
    const first = write(user.id, { signedAt: NOW, expiresAt: NOW + 30 * DAY });
    expect(await writeEntitlement(env.APP_DB, first, NOW)).toBe("applied");

    const renewal = { ...first, signedAt: NOW + 10, expiresAt: NOW + 60 * DAY };
    expect(await writeEntitlement(env.APP_DB, renewal, NOW)).toBe("applied");

    // A delayed older notification must not undo the renewal.
    const late = { ...first, signedAt: NOW + 5, expiresAt: NOW + 30 * DAY };
    expect(await writeEntitlement(env.APP_DB, late, NOW)).toBe("stale");

    const view = await readEntitlement(env.APP_DB, user.id, NOW);
    expect(view.expiresAt).toBe(new Date(NOW + 60 * DAY).toISOString());
  });

  it("refuses a subscription another account already holds", async () => {
    const owner = await createUser("write-owner");
    const other = await createUser("write-other");
    const mine = write(owner.id);
    expect(await writeEntitlement(env.APP_DB, mine, NOW)).toBe("applied");
    const theirs = { ...mine, userId: other.id, signedAt: NOW + 1000 };
    expect(await writeEntitlement(env.APP_DB, theirs, NOW)).toBe("other-account");
    expect((await readEntitlement(env.APP_DB, other.id, NOW)).premium).toBe(false);
  });

  it("drops entitlements with the account", async () => {
    const user = await createUser("write-cascade");
    await writeEntitlement(env.APP_DB, write(user.id), NOW);
    await env.APP_DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(user.id).run();
    const row = await env.APP_DB.prepare("SELECT 1 FROM entitlement WHERE user_id = ?1")
      .bind(user.id)
      .first();
    expect(row).toBeNull();
  });
});

describe("GET /v1/entitlement", () => {
  it("requires a session", async () => {
    const res = await api("/v1/entitlement");
    expect(res.status).toBe(401);
  });

  it("answers free for a new account and premium once a source grants it", async () => {
    const user = await createUser("get-entitlement");
    const free = await api("/v1/entitlement", { user });
    expect(free.status).toBe(200);
    expect(await free.json()).toEqual({ premium: false, source: null, expiresAt: null });

    const expires = Date.now() + 5 * DAY;
    await writeEntitlement(
      env.APP_DB,
      write(user.id, { source: "polar", expiresAt: expires, signedAt: Date.now() }),
      Date.now(),
    );
    const premium = await api("/v1/entitlement", { user });
    expect(await premium.json()).toEqual({
      premium: true,
      source: "polar",
      expiresAt: new Date(expires).toISOString(),
    });
  });

  it("rejects other methods", async () => {
    const user = await createUser("get-method");
    const res = await api("/v1/entitlement", { user, method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET");
  });

  it("answers 404 json for unknown billing paths", async () => {
    const res = await api("/v1/billing/nope");
    expect(res.status).toBe(404);
  });
});
