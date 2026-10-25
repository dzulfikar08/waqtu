import { describe, expect, test } from "bun:test";

import { createPremiumApi, PremiumApiError } from "../src/premium/api";
import {
  accountTokenFromDigest,
  isPremium,
  parseCache,
  parseEntitlement,
  serializeCache,
  type CachedEntitlement,
  type Entitlement,
} from "../src/premium/entitlement";

const NOW = Date.parse("2026-10-24T00:00:00Z");
const DAY = 86_400_000;

const cached = (entitlement: Entitlement, userId = "u1"): CachedEntitlement => ({
  userId,
  entitlement,
  fetchedAt: NOW,
});

describe("isPremium", () => {
  const active: Entitlement = {
    premium: true,
    source: "apple",
    expiresAt: new Date(NOW + DAY).toISOString(),
  };

  test("is premium for the cached account while the period lasts", () => {
    expect(isPremium(cached(active), "u1", NOW)).toBe(true);
  });

  test("lapses by itself once the cached period ends, even offline", () => {
    expect(isPremium(cached(active), "u1", NOW + DAY - 1)).toBe(true);
    expect(isPremium(cached(active), "u1", NOW + DAY)).toBe(false);
  });

  test("an entitlement without expiry never lapses", () => {
    const open: Entitlement = { premium: true, source: "polar", expiresAt: null };
    expect(isPremium(cached(open), "u1", NOW + 100 * 365 * DAY)).toBe(true);
  });

  test("another account's cache, a signed-out phone and no cache are free", () => {
    expect(isPremium(cached(active, "someone-else"), "u1", NOW)).toBe(false);
    expect(isPremium(cached(active), null, NOW)).toBe(false);
    expect(isPremium(null, "u1", NOW)).toBe(false);
  });

  test("a non-premium answer is free", () => {
    expect(isPremium(cached({ premium: false, source: null, expiresAt: null }), "u1", NOW)).toBe(
      false,
    );
  });
});

describe("entitlement parsing", () => {
  test("accepts the server shape", () => {
    expect(
      parseEntitlement({ premium: true, source: "google", expiresAt: "2026-11-01T00:00:00.000Z" }),
    ).toEqual({ premium: true, source: "google", expiresAt: "2026-11-01T00:00:00.000Z" });
    expect(parseEntitlement({ premium: false, source: null, expiresAt: null })).not.toBeNull();
  });

  test("rejects anything else", () => {
    for (const bad of [
      null,
      "premium",
      {},
      { premium: "yes", source: null, expiresAt: null },
      { premium: true, source: "license", expiresAt: null },
      { premium: true, source: "apple", expiresAt: "not a date" },
      { premium: true, source: "apple", expiresAt: 5 },
    ]) {
      expect(parseEntitlement(bad)).toBeNull();
    }
  });

  test("the cache round-trips and ignores corrupt rows", () => {
    const value = cached({ premium: true, source: "polar", expiresAt: null });
    expect(parseCache(serializeCache(value))).toEqual(value);
    expect(parseCache(null)).toBeNull();
    expect(parseCache("{not json")).toBeNull();
    expect(parseCache(JSON.stringify({ userId: "u1" }))).toBeNull();
  });
});

describe("appAccountToken", () => {
  // The same vectors are asserted against `appleAccountToken` in services/api/test/apple.test.ts:
  // the server refuses a transaction whose token is not the one the app computes.
  const VECTORS: [string, string][] = [
    ["u1", "9e06e6d6-1126-521a-9511-b7cf7cf56f56"],
    ["user-7f3c9a2e", "113d974f-b307-5679-90ee-46873dc02d81"],
  ];

  test("matches the server's token for the same user id", async () => {
    for (const [userId, expected] of VECTORS) {
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`waqtu-apple:${userId}`)),
      );
      const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
      expect(accountTokenFromDigest(hex)).toBe(expected);
    }
  });

  test("is a version-5 UUID", () => {
    const token = accountTokenFromDigest("ff".repeat(32));
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("premium api client", () => {
  interface Call {
    url: string;
    method: string;
    cookie: string | null;
    body: unknown;
  }

  function withFetch(respond: (call: Call) => Response | Promise<Response>) {
    const calls: Call[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const call: Call = {
        url: String(input),
        method: init?.method ?? "GET",
        cookie: headers.get("cookie"),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return respond(call);
    }) as typeof fetch;
    return {
      calls,
      api: createPremiumApi("https://api.example.test/", async () => "session=abc"),
      restore: () => {
        globalThis.fetch = original;
      },
    };
  }

  test("reads the entitlement with the session cookie", async () => {
    const t = withFetch(() =>
      Response.json({ premium: true, source: "apple", expiresAt: "2026-11-01T00:00:00.000Z" }),
    );
    try {
      expect(await t.api.getEntitlement()).toEqual({
        premium: true,
        source: "apple",
        expiresAt: "2026-11-01T00:00:00.000Z",
      });
      expect(t.calls[0]).toMatchObject({
        url: "https://api.example.test/v1/entitlement",
        method: "GET",
        cookie: "session=abc",
      });
    } finally {
      t.restore();
    }
  });

  test("posts receipts to the store-specific endpoints", async () => {
    const t = withFetch(() =>
      Response.json({ premium: true, source: "google", expiresAt: null, pending: true }),
    );
    try {
      expect((await t.api.submitGoogle("play-token-123")).pending).toBe(true);
      await t.api.submitApple("signed.jws.value");
      expect(t.calls.map((c) => [c.url, c.body])).toEqual([
        ["https://api.example.test/v1/billing/google", { purchaseToken: "play-token-123" }],
        ["https://api.example.test/v1/billing/apple", { signedTransaction: "signed.jws.value" }],
      ]);
    } finally {
      t.restore();
    }
  });

  test("maps server error codes", async () => {
    const t = withFetch(() => Response.json({ error: "linked_to_other_account" }, { status: 409 }));
    try {
      const error = await t.api.submitApple("x.y.z").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PremiumApiError);
      expect(error).toMatchObject({ code: "linked_to_other_account", status: 409 });
    } finally {
      t.restore();
    }
  });

  test("reports an unreachable network and an unreadable answer", async () => {
    const down = withFetch(() => {
      throw new TypeError("Network request failed");
    });
    try {
      expect(await down.api.getEntitlement().catch((e: unknown) => e)).toMatchObject({
        code: "network",
      });
    } finally {
      down.restore();
    }
    const odd = withFetch(() => Response.json({ premium: "maybe" }));
    try {
      expect(await odd.api.getEntitlement().catch((e: unknown) => e)).toMatchObject({
        code: "unknown",
      });
    } finally {
      odd.restore();
    }
  });
});
