import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { api, createUser, now, type TestUser } from "./helpers";

interface Body {
  feelings?: string;
  newAction?: string;
  taqwa?: number;
  gratitude?: number;
  energy?: number;
  willingness?: number;
  continueTomorrow?: string;
}
interface Wire {
  date: string;
  updatedAt: number;
  entry: Body | null;
}
interface Pull {
  entries: Wire[];
  cursor: string;
  hasMore: boolean;
}

const wire = (
  date: string,
  updatedAt: number,
  entry: Body | null = { feelings: "calm" },
): Wire => ({
  date,
  updatedAt,
  entry,
});

async function push(user: TestUser, entries: unknown[]) {
  const res = await api("/v1/muhasabah", { user, json: { entries } });
  return { res, body: (await res.json()) as { applied: number; cursor: string } };
}

async function pull(user: TestUser, query = "") {
  const res = await api(`/v1/muhasabah${query}`, { user });
  expect(res.status).toBe(200);
  return (await res.json()) as Pull;
}

describe("auth gating", () => {
  it("returns 401 JSON without a session on every method", async () => {
    for (const method of ["GET", "POST", "DELETE"]) {
      const res = await api("/v1/muhasabah", {
        method,
        json: method === "POST" ? { entries: [] } : undefined,
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("answers 405 with the allowed methods for PUT", async () => {
    const user = await createUser("muh-method");
    const res = await api("/v1/muhasabah", { user, method: "PUT" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, POST, DELETE");
  });

  it("is not premium-gated: sync is gated in the apps", async () => {
    const user = await createUser("muh-free");
    const { res } = await push(user, [wire("2026-03-01", now())]);
    expect(res.status).toBe(200);
  });
});

describe("push and pull", () => {
  it("round-trips an entry with every field", async () => {
    const user = await createUser("muh-roundtrip");
    const entry: Body = {
      feelings: "grateful",
      newAction: "walk after fajr",
      taqwa: 7,
      gratitude: 9,
      energy: 4,
      willingness: 10,
      continueTomorrow: "keep the dhikr",
    };
    const t = now();
    const { body } = await push(user, [wire("2026-03-01", t, entry)]);
    expect(body.applied).toBe(1);
    const page = await pull(user);
    expect(page.entries).toEqual([{ date: "2026-03-01", updatedAt: t, entry }]);
    expect(page.hasMore).toBe(false);
    expect(page.cursor).toBe(body.cursor);
  });

  it("keeps unicode text intact", async () => {
    const user = await createUser("muh-unicode");
    const text = 'Alhamdulillah 🌙 "quoted" \\ and\nnewline';
    await push(user, [wire("2026-03-01", now(), { feelings: text })]);
    expect((await pull(user)).entries[0]?.entry).toEqual({ feelings: text });
  });

  it("is last-write-wins per day", async () => {
    const user = await createUser("muh-lww");
    const t = now() - 10_000;
    await push(user, [wire("2026-03-01", t, { feelings: "first" })]);
    const stale = await push(user, [wire("2026-03-01", t - 1, { feelings: "older" })]);
    expect(stale.body.applied).toBe(0);
    const newer = await push(user, [wire("2026-03-01", t + 1, { feelings: "second" })]);
    expect(newer.body.applied).toBe(1);
    expect((await pull(user)).entries).toEqual([wire("2026-03-01", t + 1, { feelings: "second" })]);
  });

  it("breaks an equal timestamp by the greater data, whatever the arrival order", async () => {
    const a = await createUser("muh-tie-a");
    const b = await createUser("muh-tie-b");
    const t = now() - 10_000;
    await push(a, [wire("2026-03-01", t, { feelings: "apple" })]);
    await push(a, [wire("2026-03-01", t, { feelings: "banana" })]);
    await push(b, [wire("2026-03-01", t, { feelings: "banana" })]);
    await push(b, [wire("2026-03-01", t, { feelings: "apple" })]);
    expect((await pull(a)).entries[0]?.entry).toEqual({ feelings: "banana" });
    expect((await pull(b)).entries[0]?.entry).toEqual({ feelings: "banana" });
  });

  it("does not advance the cursor for a losing or identical write", async () => {
    const user = await createUser("muh-idempotent");
    const t = now() - 10_000;
    const first = await push(user, [wire("2026-03-01", t)]);
    const again = await push(user, [wire("2026-03-01", t)]);
    expect(again.body.applied).toBe(0);
    expect(again.body.cursor).toBe(first.body.cursor);
  });

  it("merges duplicate days inside one request", async () => {
    const user = await createUser("muh-dupes");
    const t = now() - 10_000;
    const { body } = await push(user, [
      wire("2026-03-01", t, { feelings: "old" }),
      wire("2026-03-01", t + 5, { feelings: "new" }),
    ]);
    expect(body.applied).toBe(1);
    expect((await pull(user)).entries[0]?.entry).toEqual({ feelings: "new" });
  });

  it("stores a tombstone that a later edit replaces", async () => {
    const user = await createUser("muh-tombstone");
    const t = now() - 10_000;
    await push(user, [wire("2026-03-01", t)]);
    await push(user, [wire("2026-03-01", t + 1, null)]);
    expect((await pull(user)).entries).toEqual([wire("2026-03-01", t + 1, null)]);
    await push(user, [wire("2026-03-01", t + 2, { energy: 5 })]);
    expect((await pull(user)).entries).toEqual([wire("2026-03-01", t + 2, { energy: 5 })]);
  });

  it("pages with since, limit and hasMore", async () => {
    const user = await createUser("muh-paging");
    const t = now() - 10_000;
    await push(user, [wire("2026-03-01", t), wire("2026-03-02", t), wire("2026-03-03", t)]);
    const first = await pull(user, "?limit=2");
    expect(first.entries).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await pull(user, `?since=${first.cursor}&limit=2`);
    expect(second.entries).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    const done = await pull(user, `?since=${second.cursor}`);
    expect(done.entries).toEqual([]);
    expect(done.cursor).toBe(second.cursor);
  });

  it("only returns what changed since the cursor", async () => {
    const user = await createUser("muh-since");
    const t = now() - 10_000;
    const { body } = await push(user, [wire("2026-03-01", t)]);
    await push(user, [wire("2026-03-02", t)]);
    const page = await pull(user, `?since=${body.cursor}`);
    expect(page.entries.map((e) => e.date)).toEqual(["2026-03-02"]);
  });
});

describe("isolation", () => {
  it("never shows or lets one account touch another's journal", async () => {
    const owner = await createUser("muh-owner");
    const other = await createUser("muh-other");
    const t = now() - 10_000;
    await push(owner, [wire("2026-03-01", t, { feelings: "private" })]);
    await push(other, [wire("2026-03-01", t + 1, { feelings: "theirs" })]);
    expect((await pull(owner)).entries[0]?.entry).toEqual({ feelings: "private" });
    expect((await pull(other)).entries[0]?.entry).toEqual({ feelings: "theirs" });
  });

  it("does not mix into /v1/sync", async () => {
    const user = await createUser("muh-no-mix");
    await push(user, [wire("2026-03-01", now())]);
    const res = await api("/v1/sync", { user });
    expect(await res.json()).toMatchObject({ entries: [], settings: [] });
  });
});

describe("DELETE", () => {
  it("removes the caller's whole journal, tombstones included, and no one else's", async () => {
    const user = await createUser("muh-delete");
    const other = await createUser("muh-delete-other");
    const t = now() - 10_000;
    await push(user, [wire("2026-03-01", t), wire("2026-03-02", t, null)]);
    await push(other, [wire("2026-03-01", t)]);

    const res = await api("/v1/muhasabah", { user, method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect((await pull(user)).entries).toEqual([]);
    expect((await pull(other)).entries).toHaveLength(1);
  });

  it("is idempotent and keeps the cursor moving forward", async () => {
    const user = await createUser("muh-delete-twice");
    const t = now() - 10_000;
    const before = await push(user, [wire("2026-03-01", t)]);
    await api("/v1/muhasabah", { user, method: "DELETE" });
    const again = await api("/v1/muhasabah", { user, method: "DELETE" });
    expect(await again.json()).toEqual({ deleted: 0 });
    // A device that kept its cursor must still see what is written after the delete.
    const after = await push(user, [wire("2026-03-05", t)]);
    expect(Number(after.body.cursor)).toBeGreaterThan(Number(before.body.cursor));
    expect((await pull(user, `?since=${before.body.cursor}`)).entries.map((e) => e.date)).toEqual([
      "2026-03-05",
    ]);
  });

  it("goes away with the account", async () => {
    const user = await createUser("muh-account");
    await push(user, [wire("2026-03-01", now())]);
    await env.APP_DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(user.id).run();
    const left = await env.APP_DB.prepare(
      "SELECT (SELECT COUNT(*) FROM muhasabah_entry WHERE user_id = ?1) AS e, (SELECT COUNT(*) FROM muhasabah_state WHERE user_id = ?1) AS s",
    )
      .bind(user.id)
      .first<{ e: number; s: number }>();
    expect(left).toEqual({ e: 0, s: 0 });
  });
});

describe("validation", () => {
  let rejected = 0;
  const rejects = async (entries: unknown, status = 400) => {
    const user = await createUser(`muh-invalid-${rejected++}`);
    const res = await api("/v1/muhasabah", { user, json: { entries } });
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: string }).error).toBe(
      status === 413 ? "payload_too_large" : "invalid_request",
    );
  };
  const ok = () => wire("2026-03-01", now());

  it("rejects bad bodies and unknown fields", async () => {
    const user = await createUser("muh-bad-body");
    for (const json of [[], "x", { entries: "no" }, { entries: [], extra: 1 }]) {
      const res = await api("/v1/muhasabah", { user, json });
      expect(res.status).toBe(400);
    }
    const res = await api("/v1/muhasabah", {
      user,
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(400);
    await rejects([{ ...ok(), extra: 1 }]);
    await rejects([{ ...ok(), entry: { feelings: "x", extra: 1 } }]);
  });

  it("rejects bad dates and timestamps", async () => {
    await rejects([wire("2026-13-01", now())]);
    await rejects([wire("2026-02-30", now())]);
    await rejects([wire("20260301", now())]);
    await rejects([{ ...ok(), updatedAt: -1 }]);
    await rejects([{ ...ok(), updatedAt: 1.5 }]);
    await rejects([{ ...ok(), updatedAt: now() + 3 * 86_400_000 }]);
    await rejects([{ date: "2026-03-01", entry: null }]);
  });

  it("rejects a missing, empty or malformed entry", async () => {
    await rejects([{ date: "2026-03-01", updatedAt: now() }]);
    await rejects([wire("2026-03-01", now(), {})]);
    await rejects([wire("2026-03-01", now(), "text" as unknown as Body)]);
  });

  it("rejects out-of-range ratings and bad text", async () => {
    await rejects([wire("2026-03-01", now(), { taqwa: 0 })]);
    await rejects([wire("2026-03-01", now(), { taqwa: 11 })]);
    await rejects([wire("2026-03-01", now(), { energy: 5.5 })]);
    await rejects([wire("2026-03-01", now(), { energy: "5" as unknown as number })]);
    await rejects([wire("2026-03-01", now(), { feelings: "" })]);
    await rejects([wire("2026-03-01", now(), { feelings: 3 as unknown as string })]);
    await rejects([wire("2026-03-01", now(), { newAction: "x".repeat(16001) })]);
  });

  it("accepts the largest text and the full 1..10 range", async () => {
    const user = await createUser("muh-limits");
    const { res } = await push(user, [
      wire("2026-03-01", now(), { continueTomorrow: "x".repeat(16000), taqwa: 1, energy: 10 }),
    ]);
    expect(res.status).toBe(200);
  });

  it("limits a push to 20 entries and a pull to 100", async () => {
    const dates = Array.from({ length: 21 }, (_, i) => `2026-03-${String(i + 1).padStart(2, "0")}`);
    await rejects(
      dates.map((d) => wire(d, now())),
      413,
    );
    const user = await createUser("muh-limit-ok");
    const twenty = await push(
      user,
      dates.slice(0, 20).map((d) => wire(d, now())),
    );
    expect(twenty.res.status).toBe(200);
    for (const limit of ["0", "101", "abc", "-1"]) {
      const res = await api(`/v1/muhasabah?limit=${limit}`, { user });
      expect(res.status).toBe(400);
    }
    expect((await api("/v1/muhasabah?since=abc", { user })).status).toBe(400);
  });

  it("takes a full push of maximum-size entries within the body limit", async () => {
    const user = await createUser("muh-big");
    const text = "\u{20AC}".repeat(16000);
    const entries = Array.from({ length: 20 }, (_, i) =>
      wire(`2026-04-${String(i + 1).padStart(2, "0")}`, now(), {
        feelings: text,
        newAction: text,
        continueTomorrow: text,
      }),
    );
    const { res } = await push(user, entries);
    expect(res.status).toBe(200);
  });
});
