import { describe, expect, test } from "bun:test";

import {
  addToQueue,
  buildEvent,
  describeError,
  MAX_MESSAGE,
  MAX_QUEUE,
  MAX_STACK,
  parseQueue,
  QUEUE_KEY,
  scrub,
  settleBatch,
  toPayload,
  type AppMeta,
  type QueuedError,
} from "../src/errors/report";
import { appendError, readErrorQueue, writeErrorQueue } from "../src/errors/store";
import { isSyncedSettingKey } from "../src/mutabaah/syncKeys";
import { migratedDb } from "./helpers/sqlite";

const META: AppMeta = {
  platform: "android",
  appVersion: "1.0.0",
  buildNumber: "7",
  runtimeVersion: "fp-1",
  updateId: "u-1",
  channel: "production",
};

let n = 0;
const nextId = () => `local-${++n}`;

describe("describeError", () => {
  test("Error, string and other thrown values", () => {
    const err = new TypeError("boom");
    expect(describeError(err)).toMatchObject({ name: "TypeError", message: "boom" });
    expect(describeError(err).stack).toContain("boom");
    expect(describeError("plain")).toEqual({ name: "NonError", message: "plain", stack: null });
    expect(describeError({ code: 3 })).toEqual({
      name: "NonError",
      message: '{"code":3}',
      stack: null,
    });
    expect(describeError(undefined).message).toBe("undefined");
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(describeError(circular).message).toBe("[object Object]");
  });
});

describe("buildEvent", () => {
  test("carries the build, never more than the API takes", () => {
    const err = new Error("x".repeat(MAX_MESSAGE + 50));
    err.stack = `Error\n${"    at f (bundle:1:2)\n".repeat(1000)}`;
    const event = buildEvent(err, true, META, "/(tabs)/circles");
    expect(event).toMatchObject({ ...META, fatal: true, name: "Error", screen: "/(tabs)/circles" });
    expect(event.message).toHaveLength(MAX_MESSAGE);
    expect(event.stack?.length).toBe(MAX_STACK);
    expect(event.count).toBe(1);
    expect(Object.keys(event).sort()).toEqual(
      [
        "appVersion",
        "buildNumber",
        "channel",
        "count",
        "fatal",
        "message",
        "name",
        "platform",
        "runtimeVersion",
        "screen",
        "stack",
        "updateId",
      ].sort(),
    );
  });

  test("scrubs emails, URL queries and coordinates", () => {
    expect(scrub("failed for ana@example.com at -6.20880, 106.84560")).toBe(
      "failed for <email> at <num>, <num>",
    );
    expect(scrub("GET https://api.getwaqtu.com/v1/sync?since=abc&token=t failed")).toBe(
      "GET https://api.getwaqtu.com/v1/sync failed",
    );
    expect(scrub("at f (index.android.bundle:1:2345)")).toBe("at f (index.android.bundle:1:2345)");
    expect(scrub("version 57.0.28")).toBe("version 57.0.28");
  });
});

describe("queue", () => {
  const event = (message: string, fatal = false) =>
    buildEvent(new Error(message), fatal, META, "/today");

  test("folds identical errors into a count", () => {
    const e = event("same");
    let queue = addToQueue([], e, nextId);
    queue = addToQueue(queue, e, nextId);
    queue = addToQueue(queue, event("other"), nextId);
    queue = addToQueue(queue, { ...e, fatal: true }, nextId);
    expect(queue.map((q) => [q.message, q.fatal, q.count])).toEqual([
      ["same", false, 2],
      ["other", false, 1],
      ["same", true, 1],
    ]);
  });

  test("keeps the newest MAX_QUEUE", () => {
    let queue: QueuedError[] = [];
    for (let i = 0; i < MAX_QUEUE + 5; i++) queue = addToQueue(queue, event(`e${i}`), nextId);
    expect(queue).toHaveLength(MAX_QUEUE);
    expect(queue[0]?.message).toBe("e5");
  });

  test("payload drops local ids", () => {
    const queue = addToQueue([], event("a"), nextId);
    const payload = toPayload(queue);
    expect(payload.events).toHaveLength(1);
    expect("id" in (payload.events[0] as object)).toBe(false);
  });

  test("settles by status and keeps repeats from while the request was out", () => {
    const a = event("a");
    const sent = addToQueue(addToQueue([], a, nextId), event("b"), nextId);
    const meanwhile = addToQueue(addToQueue(sent, a, nextId), event("c"), nextId);

    for (const status of [202, 400, 413]) {
      expect(settleBatch(meanwhile, sent, status).map((q) => [q.message, q.count])).toEqual([
        ["a", 1],
        ["c", 1],
      ]);
    }
    for (const status of [null, 408, 429, 500, 503]) {
      expect(settleBatch(meanwhile, sent, status)).toEqual(meanwhile);
    }
  });

  test("unreadable stored queues read as empty", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("{nope")).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    const good = addToQueue([], event("ok"), nextId);
    expect(parseQueue(JSON.stringify([...good, { id: 1 }, "x"]))).toEqual(good);
  });
});

describe("store", () => {
  test("round-trips through the device-local settings table", async () => {
    const { db, raw } = await migratedDb();
    expect(readErrorQueue(db)).toEqual([]);
    const e = buildEvent(new Error("stored"), true, META, null);
    appendError(db, e, nextId);
    appendError(db, e, nextId);
    const queue = readErrorQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ message: "stored", fatal: true, count: 2 });

    // Never marked for sync, and not a synced key either.
    const row = raw.query("SELECT dirty FROM settings WHERE key = ?").get(QUEUE_KEY) as {
      dirty: number;
    };
    expect(row.dirty).toBe(0);
    expect(isSyncedSettingKey(QUEUE_KEY)).toBe(false);

    writeErrorQueue(db, []);
    expect(raw.query("SELECT key FROM settings WHERE key = ?").get(QUEUE_KEY)).toBeNull();
  });
});
