import { describe, expect, it } from "vitest";
import { api, createUser, now } from "./helpers";

interface PushResult {
  applied: { entries: number; settings: number };
  cursor: string;
}
interface Pull {
  entries: { date: string; itemId: string; value: number; updatedAt: number }[];
  settings: { key: string; value: string; updatedAt: number }[];
  cursor: string;
  hasMore: boolean;
}

const entry = (value: number, updatedAt: number, itemId = "fajr", date = "2026-03-01") => ({
  date,
  itemId,
  value,
  updatedAt,
});

async function push(user: Awaited<ReturnType<typeof createUser>>, body: unknown) {
  const res = await api("/v1/sync", { user, json: body });
  return { res, body: (await res.json()) as PushResult };
}

async function pull(user: Awaited<ReturnType<typeof createUser>>, query = "") {
  const res = await api(`/v1/sync${query}`, { user });
  expect(res.status).toBe(200);
  return (await res.json()) as Pull;
}

describe("auth gating", () => {
  it("returns 401 JSON without a session", async () => {
    for (const [path, method] of [
      ["/v1/sync", "GET"],
      ["/v1/sync", "POST"],
      ["/v1/me", "GET"],
    ] as const) {
      const res = await api(path, { method, json: method === "POST" ? {} : undefined });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("rejects a forged cookie signature", async () => {
    const user = await createUser("forged");
    const forged = { ...user, cookie: user.cookie.replace(/.$/, "A").replace("%3D", "%3E") };
    const res = await api("/v1/me", { user: forged });
    expect(res.status).toBe(401);
  });

  it("GET /v1/me returns the session user", async () => {
    const user = await createUser("me");
    const res = await api("/v1/me", { user });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ id: user.id, email: user.email, name: "me" });
  });

  it("serves better-auth without a session", async () => {
    const ok = await api("/api/auth/ok");
    expect(ok.status).toBe(200);
    const session = await api("/api/auth/get-session");
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
  });
});

describe("POST /v1/sync validation", () => {
  it("rejects invalid payloads with 400", async () => {
    const user = await createUser("invalid");
    const t = now();
    const cases: unknown[] = [
      [],
      "x",
      { entries: "no" },
      { settings: {} },
      { extra: 1 },
      { entries: [null] },
      { entries: [{ ...entry(1, t), extra: 1 }] },
      { entries: [entry(1, t, "fajr", "2026-13-01")] },
      { entries: [entry(1, t, "fajr", "2026-02-30")] },
      { entries: [entry(1, t, "fajr", "26-03-01")] },
      { entries: [entry(1, t, "bad id")] },
      { entries: [entry(1, t, "x".repeat(65))] },
      { entries: [entry(-1, t)] },
      { entries: [entry(1.5, t)] },
      { entries: [entry(1_000_001, t)] },
      { entries: [{ ...entry(1, t), value: "1" }] },
      { entries: [entry(1, 1.5)] },
      { entries: [entry(1, -1)] },
      { entries: [entry(1, t + 25 * 3_600_000)] },
      { settings: [{ key: "1bad", value: "x", updatedAt: t }] },
      { settings: [{ key: "ok", value: 1, updatedAt: t }] },
      { settings: [{ key: "ok", value: "x".repeat(16385), updatedAt: t }] },
      { settings: [{ key: "ok", value: "x", updatedAt: t, deleted: true }] },
      { settings: [{ key: "ok", value: "x", updatedAt: t + 25 * 3_600_000 }] },
    ];
    for (const body of cases) {
      const res = await api("/v1/sync", { user, json: body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      const out = (await res.json()) as { error: string; detail: string };
      expect(out.error).toBe("invalid_request");
      expect(out.detail).toBeTruthy();
    }
    const malformed = await api("/v1/sync", { user, method: "POST", body: "{nope" });
    expect(malformed.status).toBe(400);
  });

  it("enforces batch size limits", async () => {
    const user = await createUser("limits");
    const t = now();
    const entries = Array.from({ length: 501 }, (_, i) => entry(1, t, `i${i}`));
    expect((await api("/v1/sync", { user, json: { entries } })).status).toBe(413);
    const settings = Array.from({ length: 101 }, (_, i) => ({
      key: `k${i}`,
      value: "v",
      updatedAt: t,
    }));
    expect((await api("/v1/sync", { user, json: { settings } })).status).toBe(413);
    const ok = await push(user, { entries: entries.slice(0, 500) });
    expect(ok.res.status).toBe(200);
    expect(ok.body.applied.entries).toBe(500);
  });

  it("rejects invalid since / limit on GET", async () => {
    const user = await createUser("query");
    for (const q of [
      "?since=-1",
      "?since=abc",
      "?since=1.5",
      "?limit=0",
      "?limit=501",
      "?limit=x",
    ]) {
      const res = await api(`/v1/sync${q}`, { user });
      expect(res.status, q).toBe(400);
    }
  });
});

describe("last-write-wins", () => {
  it("applies the first upsert", async () => {
    const user = await createUser("first");
    const t = now();
    const { res, body } = await push(user, { entries: [entry(3, t)] });
    expect(res.status).toBe(200);
    expect(body).toEqual({ applied: { entries: 1, settings: 0 }, cursor: "1" });
    const out = await pull(user);
    expect(out.entries).toEqual([entry(3, t)]);
    expect(out.settings).toEqual([]);
    expect(out.cursor).toBe("1");
    expect(out.hasMore).toBe(false);
  });

  it("ignores stale writes and accepts newer ones", async () => {
    const user = await createUser("lww");
    const t = now() - 10_000;
    await push(user, { entries: [entry(5, t)] });

    const stale = await push(user, { entries: [entry(9, t - 1)] });
    expect(stale.body.applied.entries).toBe(0);
    expect(stale.body.cursor).toBe("1");
    expect((await pull(user)).entries[0]!.value).toBe(5);

    const newer = await push(user, { entries: [entry(2, t + 1)] });
    expect(newer.body.applied.entries).toBe(1);
    expect(newer.body.cursor).toBe("2");
    const out = await pull(user);
    expect(out.entries).toEqual([entry(2, t + 1)]);
  });

  it("breaks equal-timestamp ties by greater value", async () => {
    const user = await createUser("tie");
    const t = now() - 10_000;
    await push(user, { entries: [entry(5, t)] });

    const lower = await push(user, { entries: [entry(4, t)] });
    expect(lower.body.applied.entries).toBe(0);
    expect((await pull(user)).entries[0]!.value).toBe(5);

    const higher = await push(user, { entries: [entry(6, t)] });
    expect(higher.body.applied.entries).toBe(1);
    expect((await pull(user)).entries[0]!.value).toBe(6);
  });

  it("is idempotent and does not bump the cursor on identical re-push", async () => {
    const user = await createUser("idem");
    const t = now() - 1000;
    const body = {
      entries: [entry(1, t), entry(2, t, "dhuhr")],
      settings: [{ key: "theme", value: "dark", updatedAt: t }],
    };
    const first = await push(user, body);
    expect(first.body.applied).toEqual({ entries: 2, settings: 1 });
    expect(first.body.cursor).toBe("3");
    const second = await push(user, body);
    expect(second.body).toEqual({ applied: { entries: 0, settings: 0 }, cursor: "3" });
    const empty = await push(user, {});
    expect(empty.body).toEqual({ applied: { entries: 0, settings: 0 }, cursor: "3" });
  });

  it("merges duplicate keys within one request", async () => {
    const user = await createUser("dups");
    const t = now() - 1000;
    const { body } = await push(user, {
      entries: [entry(1, t), entry(7, t + 5), entry(9, t + 2), entry(3, t + 5)],
      settings: [
        { key: "a", value: "old", updatedAt: t },
        { key: "a", value: "new", updatedAt: t + 1 },
      ],
    });
    expect(body.applied).toEqual({ entries: 1, settings: 1 });
    const out = await pull(user);
    expect(out.entries).toEqual([entry(7, t + 5)]);
    expect(out.settings).toEqual([{ key: "a", value: "new", updatedAt: t + 1 }]);
  });
});

describe("settings", () => {
  it("upserts with last-write-wins", async () => {
    const user = await createUser("settings");
    const t = now() - 10_000;
    await push(user, { settings: [{ key: "lang", value: "id", updatedAt: t }] });

    const newer = await push(user, { settings: [{ key: "lang", value: "ar", updatedAt: t + 1 }] });
    expect(newer.body.applied.settings).toBe(1);
    expect((await pull(user)).settings).toEqual([{ key: "lang", value: "ar", updatedAt: t + 1 }]);

    const stale = await push(user, { settings: [{ key: "lang", value: "en", updatedAt: t }] });
    expect(stale.body.applied.settings).toBe(0);
    expect((await pull(user)).settings).toEqual([{ key: "lang", value: "ar", updatedAt: t + 1 }]);
  });

  it("tie: greater value wins", async () => {
    const user = await createUser("settie");
    const t = now() - 10_000;
    await push(user, { settings: [{ key: "k", value: "b", updatedAt: t }] });
    const lower = await push(user, { settings: [{ key: "k", value: "a", updatedAt: t }] });
    expect(lower.body.applied.settings).toBe(0);
    const higher = await push(user, { settings: [{ key: "k", value: "c", updatedAt: t }] });
    expect(higher.body.applied.settings).toBe(1);
    expect((await pull(user)).settings).toEqual([{ key: "k", value: "c", updatedAt: t }]);
  });

  it("rejects the removed deleted field", async () => {
    const user = await createUser("nodeleted");
    const res = await api("/v1/sync", {
      user,
      json: { settings: [{ key: "k", value: "", deleted: true, updatedAt: now() }] },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { detail: string }).detail).toContain('unknown field "deleted"');
  });
});

describe("request size limit", () => {
  const LIMIT = 1_000_000;
  const bytesOf = (s: string) => new TextEncoder().encode(s);

  it("rejects on the declared content-length alone", async () => {
    const user = await createUser("clen");
    const res = await api("/v1/sync", {
      user,
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(LIMIT + 1) },
      body: "{}",
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "payload_too_large" });
  });

  it("rejects a body just over the limit sent with a matching content-length", async () => {
    const user = await createUser("clen2");
    const payload = `{"settings":[],"pad":"${"x".repeat(LIMIT)}"}`;
    const res = await api("/v1/sync", {
      user,
      method: "POST",
      headers: { "content-length": String(bytesOf(payload).byteLength) },
      body: payload,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "payload_too_large" });
  });

  it("counts bytes, not characters, when streaming without content-length", async () => {
    const user = await createUser("bytes");
    const pad = "é".repeat(LIMIT * 0.6);
    const payload = `{"pad":"${pad}"}`;
    expect(payload.length).toBeLessThan(LIMIT);
    const encoded = bytesOf(payload);
    expect(encoded.byteLength).toBeGreaterThan(LIMIT);
    const chunkSize = 64 * 1024;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < encoded.byteLength; i += chunkSize) {
          controller.enqueue(encoded.subarray(i, i + chunkSize));
        }
        controller.close();
      },
    });
    const res = await api("/v1/sync", {
      user,
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: "payload_too_large" });
  });

  it("accepts a multi-byte body under the byte limit", async () => {
    const user = await createUser("bytes-ok");
    const res = await api("/v1/sync", {
      user,
      method: "POST",
      body: JSON.stringify({ settings: [{ key: "k", value: "é".repeat(100), updatedAt: now() }] }),
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /v1/sync paging", () => {
  it("returns every row exactly once across pages and flips hasMore", async () => {
    const user = await createUser("paging");
    const t = now() - 1000;
    const entries = Array.from({ length: 7 }, (_, i) => entry(i, t, `item${i}`));
    const settings = Array.from({ length: 4 }, (_, i) => ({
      key: `s${i}`,
      value: `v${i}`,
      updatedAt: t,
    }));
    await push(user, { entries, settings });

    const seenEntries: string[] = [];
    const seenSettings: string[] = [];
    let cursor = "0";
    let pages = 0;
    const flags: boolean[] = [];
    for (;;) {
      const page = await pull(user, `?since=${cursor}&limit=3`);
      pages++;
      expect(page.entries.length + page.settings.length).toBeLessThanOrEqual(3);
      seenEntries.push(...page.entries.map((e) => e.itemId));
      seenSettings.push(...page.settings.map((s) => s.key));
      flags.push(page.hasMore);
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(pages).toBe(4);
    expect(flags).toEqual([true, true, true, false]);
    expect(cursor).toBe("11");
    expect(seenEntries.toSorted()).toEqual(entries.map((e) => e.itemId).toSorted());
    expect(seenSettings.toSorted()).toEqual(settings.map((s) => s.key));

    const none = await pull(user, "?since=11");
    expect(none).toEqual({ entries: [], settings: [], cursor: "11", hasMore: false });
  });

  it("only returns rows changed after the cursor", async () => {
    const user = await createUser("since");
    const t = now() - 1000;
    await push(user, { entries: [entry(1, t, "a"), entry(1, t, "b")] });
    await push(user, { entries: [entry(2, t + 1, "a")] });
    const out = await pull(user, "?since=2");
    expect(out.entries).toEqual([entry(2, t + 1, "a")]);
    expect(out.cursor).toBe("3");
  });
});

describe("isolation and deletion", () => {
  it("users cannot read each other's data", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const t = now() - 1000;
    await push(alice, {
      entries: [entry(1, t)],
      settings: [{ key: "secret", value: "alice", updatedAt: t }],
    });
    const bobView = await pull(bob);
    expect(bobView).toEqual({ entries: [], settings: [], cursor: "0", hasMore: false });

    const bobPush = await push(bob, { entries: [entry(9, t - 5)] });
    expect(bobPush.body.applied.entries).toBe(1);
    expect(bobPush.body.cursor).toBe("1");
    expect((await pull(alice)).entries).toEqual([entry(1, t)]);
  });

  it("deleting the account removes synced rows", async () => {
    const user = await createUser("goner");
    const t = now() - 1000;
    await push(user, {
      entries: [entry(1, t)],
      settings: [{ key: "k", value: "v", updatedAt: t }],
    });
    const res = await api("/api/auth/delete-user", {
      user,
      json: {},
      headers: { origin: "http://localhost" },
    });
    expect(res.status).toBe(200);

    const { env } = await import("cloudflare:workers");
    for (const table of ["mutabaah_entry", "app_setting", "sync_state", "session", '"user"']) {
      const row = await env.APP_DB.prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === '"user"' ? "id" : table === "session" ? "userId" : "user_id"} = ?`,
      )
        .bind(user.id)
        .first<{ n: number }>();
      expect(row!.n, table).toBe(0);
    }
  });
});
