import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { ERRORS_RATE_LIMIT, ERRORS_RETENTION_MS, sweepOldErrors, topFrame } from "../src/errors";
import { api, createUser, type TestUser } from "./helpers";

beforeEach(async () => {
  await env.APP_DB.batch([
    env.APP_DB.prepare("DELETE FROM client_error"),
    env.APP_DB.prepare("DELETE FROM client_error_rate"),
  ]);
});

let ipCounter = 0;
/** A fresh client IP per call keeps the per-IP rate limit out of tests that are not about it. */
const freshIp = () => `203.0.113.${++ipCounter % 250}-${ipCounter}`;

const event = (over: Record<string, unknown> = {}) => ({
  platform: "android",
  appVersion: "1.0.0",
  buildNumber: "7",
  runtimeVersion: "fp-abc",
  updateId: "0f8e1c2a-1111-4c4c-9999-000000000001",
  channel: "production",
  fatal: false,
  name: "TypeError",
  message: "undefined is not a function",
  stack:
    "TypeError: undefined is not a function\n    at renderToday (index.android.bundle:1:2345)\n    at App (index.android.bundle:1:99)",
  screen: "/today",
  count: 1,
  ...over,
});

const send = (body: unknown, ip = freshIp(), user?: TestUser) =>
  api("/v1/errors", { json: body, headers: { "cf-connecting-ip": ip }, user });

/** In ADMIN_USER_IDS (vitest.config.ts); the circles tests use the other admin id. */
let adminUser: Promise<TestUser> | undefined;
const admin = () => (adminUser ??= createUser("errors-admin", "someone-else"));

describe("POST /v1/errors", () => {
  test("stores anonymous events without any user, location or IP", async () => {
    const user = await createUser("reporter");
    const res = await send(
      { events: [event(), event({ fatal: true, name: "Error", count: 3 })] },
      "198.51.100.7",
      user,
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: 2 });

    const { results } = await env.APP_DB.prepare(
      "SELECT * FROM client_error ORDER BY fatal",
    ).all<Record<string, unknown>>();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      platform: "android",
      app_version: "1.0.0",
      build_number: "7",
      runtime_version: "fp-abc",
      update_id: "0f8e1c2a-1111-4c4c-9999-000000000001",
      channel: "production",
      fatal: 0,
      name: "TypeError",
      message: "undefined is not a function",
      top_frame: "renderToday (index.android.bundle:1:2345)",
      screen: "/today",
      count: 1,
    });
    expect(results[1]).toMatchObject({ fatal: 1, count: 3 });
    const columns = Object.keys(results[0] as object);
    expect(columns.filter((c) => /user|^ip|latitude|longitude|location|email/i.test(c))).toEqual([]);
    const stored = JSON.stringify(results);
    expect(stored).not.toContain(user.id);
    expect(stored).not.toContain("198.51.100.7");
  });

  test("optional fields may be missing or null", async () => {
    const res = await send({
      events: [
        {
          platform: "ios",
          appVersion: "1.0.0",
          fatal: true,
          name: "Error",
          message: "",
          stack: null,
        },
      ],
    });
    expect(res.status).toBe(202);
    const row = await env.APP_DB.prepare("SELECT * FROM client_error").first<Record<string, unknown>>();
    expect(row).toMatchObject({ build_number: null, stack: null, top_frame: "", count: 1 });
  });

  test("validation is strict", async () => {
    const cases: unknown[] = [
      {},
      [],
      { events: [] },
      { events: Array.from({ length: 21 }, () => event()) },
      { events: [event()], extra: 1 },
      { events: [event({ userId: "u1" })] },
      { events: [event({ latitude: -6.2 })] },
      { events: [event({ platform: "web" })] },
      { events: [event({ fatal: "yes" })] },
      { events: [event({ message: "x".repeat(501) })] },
      { events: [event({ stack: "x".repeat(8193) })] },
      { events: [event({ name: "" })] },
      { events: [event({ appVersion: undefined })] },
      { events: [event({ count: 0 })] },
      { events: [event({ count: 1.5 })] },
      { events: [event({ screen: "s".repeat(101) })] },
      { events: ["boom"] },
    ];
    for (const body of cases) {
      const res = await send(body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
    const res = await api("/v1/errors", {
      method: "POST",
      body: "{not json",
      headers: { "cf-connecting-ip": freshIp() },
    });
    expect(res.status).toBe(400);
    const { results } = await env.APP_DB.prepare("SELECT id FROM client_error").all();
    expect(results).toHaveLength(0);
  });

  test("caps message and stack exactly at the limits", async () => {
    const res = await send({
      events: [event({ message: "m".repeat(500), stack: "s".repeat(8192) })],
    });
    expect(res.status).toBe(202);
  });

  test("refuses oversized bodies", async () => {
    const res = await api("/v1/errors", {
      method: "POST",
      body: "x".repeat(300 * 1024),
      headers: { "cf-connecting-ip": freshIp(), "content-type": "application/json" },
    });
    expect(res.status).toBe(413);
  });

  test("rate limits per IP per minute", async () => {
    const ip = "192.0.2.55";
    for (let i = 0; i < ERRORS_RATE_LIMIT; i++) {
      expect((await send({ events: [event()] }, ip)).status).toBe(202);
    }
    const limited = await send({ events: [event()] }, ip);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another IP is unaffected, and the counter row holds a keyed hash, not the address.
    expect((await send({ events: [event()] }, "192.0.2.56")).status).toBe(202);
    const rows = await env.APP_DB.prepare("SELECT ip_hash FROM client_error_rate").all<{
      ip_hash: string;
    }>();
    expect(rows.results.every((r) => /^[0-9a-f]{32}$/.test(r.ip_hash))).toBe(true);
  });

  test("only POST", async () => {
    const res = await api("/v1/errors");
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });
});

describe("topFrame", () => {
  test("Hermes / V8 and JavaScriptCore stacks", () => {
    expect(topFrame("Error: x\n    at foo (bundle:1:2)\n    at bar (bundle:3:4)")).toBe(
      "foo (bundle:1:2)",
    );
    expect(topFrame("foo@http://localhost/bundle:10:20\nbar@bundle:1:1")).toBe(
      "foo@http://localhost/bundle:10:20",
    );
    expect(topFrame("just a message")).toBe("");
    expect(topFrame(null)).toBe("");
  });
});

describe("GET /v1/admin/errors", () => {
  test("needs a session and an admin", async () => {
    expect((await api("/v1/admin/errors")).status).toBe(401);
    const user = await createUser("not-admin");
    expect((await api("/v1/admin/errors", { user })).status).toBe(403);
  });

  test("groups by message and top frame with counts", async () => {
    await send({
      events: [
        event(),
        event({ count: 4, platform: "ios", appVersion: "1.0.1", screen: "/circles" }),
        event({ stack: "TypeError: undefined is not a function\n    at other (bundle:9:9)" }),
        event({ name: "Error", message: "network down", fatal: true, stack: null, screen: null }),
      ],
    });
    const res = await api("/v1/admin/errors", { user: await admin() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      since: number;
      groups: {
        name: string;
        message: string;
        topFrame: string;
        fatal: boolean;
        reports: number;
        occurrences: number;
        platforms: string[];
        appVersions: string[];
        screens: string[];
        stack: string | null;
      }[];
    };
    expect(body.groups).toHaveLength(3);
    const render = body.groups.find((g) => g.topFrame.startsWith("renderToday"));
    expect(render).toMatchObject({
      name: "TypeError",
      message: "undefined is not a function",
      fatal: false,
      reports: 2,
      occurrences: 5,
    });
    expect(render?.platforms.sort()).toEqual(["android", "ios"]);
    expect(render?.appVersions.sort()).toEqual(["1.0.0", "1.0.1"]);
    expect(render?.screens.sort()).toEqual(["/circles", "/today"]);
    expect(render?.stack).toContain("renderToday");
    const network = body.groups.find((g) => g.message === "network down");
    expect(network).toMatchObject({ fatal: true, reports: 1, topFrame: "", screens: [] });
  });

  test("since filters old reports and must be epoch ms", async () => {
    await send({ events: [event()] });
    const user = await admin();
    const future = Date.now() + 60_000;
    const res = await api(`/v1/admin/errors?since=${future}`, { user });
    const body = (await res.json()) as { groups: unknown[] };
    expect(body.groups).toHaveLength(0);
    expect((await api("/v1/admin/errors?since=yesterday", { user })).status).toBe(400);
  });
});

describe("retention", () => {
  test("the cron sweep drops reports older than 90 days", async () => {
    await send({ events: [event()] });
    await sweepOldErrors(env.APP_DB, Date.now());
    expect((await env.APP_DB.prepare("SELECT id FROM client_error").all()).results).toHaveLength(1);
    await sweepOldErrors(env.APP_DB, Date.now() + ERRORS_RETENTION_MS + 1000);
    expect((await env.APP_DB.prepare("SELECT id FROM client_error").all()).results).toHaveLength(0);
  });
});
