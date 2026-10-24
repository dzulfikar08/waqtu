import { describe, expect, test } from "bun:test";

import { CirclesHttpError, createCirclesApi, isUnauthorized } from "../src/circles/api";
import {
  appendPage,
  canPost,
  circleLanguage,
  displayInviteCode,
  errorKey,
  formatDuration,
  groupCircles,
  handleProblem,
  refreshFeed,
  suggestHandle,
  summaryFromWeek,
  tzOffsetHours,
} from "../src/circles/logic";
import type { Circle, Post } from "../src/circles/types";
import { id as idStrings } from "../src/i18n/locales/id";
import { en as enStrings } from "../src/i18n/locales/en";
import type { WeekSummary } from "../src/mutabaah/week";

const post = (id: string, createdAt: number): Post => ({
  id,
  kind: "text",
  handle: "h",
  mine: false,
  text: id,
  createdAt,
  halaqahDayId: null,
  media: null,
  summary: null,
  reactions: {},
  myReaction: null,
});

const circle = (over: Partial<Circle> = {}): Circle => ({
  id: "c1",
  kind: "public",
  name: null,
  memberCount: 3,
  ready: false,
  full: false,
  myStatus: "active",
  joinedAt: 0,
  latestPostAt: null,
  inviteCode: null,
  ...over,
});

describe("handles", () => {
  test("validates like the server", () => {
    expect(handleProblem("ab")).toBe("short");
    expect(handleProblem("a".repeat(25))).toBe("long");
    expect(handleProblem("has space")).toBe("chars");
    expect(handleProblem("_leading")).toBe("chars");
    expect(handleProblem("Sabar_Embun_482")).toBeNull();
    expect(handleProblem("  trimmed  ")).toBeNull();
  });

  test("suggestions are anonymous, valid, deterministic for a given rand", () => {
    for (const language of ["id", "en"] as const) {
      for (const r of [0, 0.5, 0.999999]) {
        const handle = suggestHandle(language, () => r);
        expect(handleProblem(handle)).toBeNull();
        expect(handle).toMatch(/^[A-Za-z]+_[A-Za-z]+_\d{3}$/);
      }
    }
    expect(suggestHandle("id", () => 0)).toBe("Sabar_Pagi_100");
    expect(suggestHandle("en", () => 0.999999)).toBe("Bright_Breeze_999");
  });
});

describe("profile inputs", () => {
  test("time zone is a whole-hour bucket", () => {
    expect(tzOffsetHours(new Date("2027-01-01T00:00:00Z"))).toBe(
      Math.round(-new Date("2027-01-01T00:00:00Z").getTimezoneOffset() / 60) || 0,
    );
    const fake = (minutes: number) => ({ getTimezoneOffset: () => minutes }) as Date;
    expect(tzOffsetHours(fake(-420))).toBe(7);
    expect(tzOffsetHours(fake(0))).toBe(0);
    expect(Object.is(tzOffsetHours(fake(0)), 0)).toBe(true);
    expect(tzOffsetHours(fake(300))).toBe(-5);
    expect(tzOffsetHours(fake(-330))).toBe(6);
    expect(tzOffsetHours(fake(-900))).toBe(14);
    expect(tzOffsetHours(fake(900))).toBe(-12);
  });

  test("language follows the app locale", () => {
    expect(circleLanguage("en")).toBe("en");
    expect(circleLanguage("en-US")).toBe("en");
    expect(circleLanguage("id")).toBe("id");
    expect(circleLanguage("fr")).toBe("id");
  });
});

describe("weekly summary", () => {
  const week = (over: Partial<WeekSummary>): WeekSummary => ({
    days: [],
    countedDays: 5,
    fardhEnabled: 5,
    fardhDone: 30,
    fardhOnTime: 28,
    fardhJamaah: 10,
    fardhQadha: 1,
    pages: 42,
    items: [{ id: "tahajjud", daysDone: 3 }],
    bestDay: "2027-02-01",
    ...over,
  });

  test("keeps only the aggregate counts", () => {
    const summary = summaryFromWeek(week({}), "2027-02-07");
    expect(summary).toEqual({
      weekEnd: "2027-02-07",
      countedDays: 5,
      fardhOnTime: 28,
      fardhJamaah: 10,
      pages: 42,
    });
    expect(JSON.stringify(summary)).not.toContain("tahajjud");
  });

  test("clamps to the server's ranges", () => {
    expect(
      summaryFromWeek(
        week({ countedDays: 9, fardhOnTime: -2, fardhJamaah: 99, pages: 99_999.6 }),
        "2027-02-07",
      ),
    ).toEqual({
      weekEnd: "2027-02-07",
      countedDays: 7,
      fardhOnTime: 0,
      fardhJamaah: 35,
      pages: 10_000,
    });
    expect(summaryFromWeek(week({ pages: Number.NaN }), "2027-02-07").pages).toBe(0);
  });
});

describe("feed merging", () => {
  test("appending an older page drops duplicates and keeps order", () => {
    const shown = [post("c", 30), post("b", 20)];
    expect(appendPage(shown, [post("b", 20), post("a", 10)]).map((p) => p.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  test("a refresh replaces the first page and keeps older pages already loaded", () => {
    const shown = [post("c", 30), post("b", 20), post("a", 10)];
    const first = [post("d", 40), post("c", 30)];
    expect(refreshFeed(shown, first).map((p) => p.id)).toEqual(["d", "c", "b", "a"]);
  });

  test("a refresh drops posts that disappeared from the first page window", () => {
    const shown = [post("c", 30), post("b", 20), post("a", 10)];
    // "c" was removed (hidden or deleted): it is inside the refreshed window but absent from it.
    const first = [post("b", 20)];
    expect(refreshFeed(shown, first).map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("an empty refresh clears the feed", () => {
    expect(refreshFeed([post("a", 1)], [])).toEqual([]);
  });
});

describe("small helpers", () => {
  test("formatDuration", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65.4)).toBe("1:05");
    expect(formatDuration(-3)).toBe("0:00");
    expect(formatDuration(120)).toBe("2:00");
  });

  test("a paused member cannot post", () => {
    expect(canPost(circle({ myStatus: "active" }))).toBe(true);
    expect(canPost(circle({ myStatus: "paused" }))).toBe(false);
  });

  test("groups public and private circles", () => {
    const grouped = groupCircles([
      circle({ id: "p1", kind: "public" }),
      circle({ id: "x1", kind: "private" }),
      circle({ id: "x2", kind: "private" }),
    ]);
    expect(grouped.publicCircle?.id).toBe("p1");
    expect(grouped.privateCircles.map((c) => c.id)).toEqual(["x1", "x2"]);
    expect(groupCircles([]).publicCircle).toBeNull();
  });

  test("invite codes read as ABCD-2345", () => {
    expect(displayInviteCode("ABCD2345")).toBe("ABCD-2345");
    expect(displayInviteCode("SHORT")).toBe("SHORT");
  });

  test("server error codes map to copy keys", () => {
    expect(errorKey(null, null)).toBe("network");
    expect(errorKey(409, "handle_taken")).toBe("handleTaken");
    expect(errorKey(409, "circle_full")).toBe("circleFull");
    expect(errorKey(409, "circle_paused")).toBe("paused");
    expect(errorKey(429, "rate_limited")).toBe("rateLimited");
    expect(errorKey(403, "suspended")).toBe("suspended");
    expect(errorKey(403, "summary_opt_in_required")).toBe("summaryOptIn");
    expect(errorKey(413, null)).toBe("tooLarge");
    expect(errorKey(404, null)).toBe("notFound");
    expect(errorKey(500, null)).toBe("generic");
  });

  test("every error key has copy in both languages", () => {
    const keys = [
      "profileRequired",
      "handleTaken",
      "genderLocked",
      "notFound",
      "circleFull",
      "tooManyPrivate",
      "paused",
      "rateLimited",
      "suspended",
      "summaryOptIn",
      "tooLarge",
      "network",
      "generic",
    ] as const;
    for (const key of keys) {
      expect(idStrings.circles.errors[key].length).toBeGreaterThan(0);
      expect(enStrings.circles.errors[key].length).toBeGreaterThan(0);
    }
  });
});

describe("api client", () => {
  interface Call {
    url: string;
    init: RequestInit;
  }

  function client(responder: (call: Call) => Response | Promise<Response>) {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const call = { url, init };
      calls.push(call);
      return responder(call);
    }) as unknown as typeof fetch;
    const api = createCirclesApi({
      baseUrl: "https://api.example.test/",
      getCookie: () => "better-auth.session_token=abc",
      fetchImpl,
      readBlob: async () => new Blob(["voice"]),
    });
    return { api, calls };
  }

  const ok = (body: unknown, status = 200) => Response.json(body, { status });

  test("sends the session cookie, never ambient credentials", async () => {
    const { api, calls } = client(() => ok({ circles: [] }));
    expect(await api.list()).toEqual([]);
    expect(calls[0]!.url).toBe("https://api.example.test/v1/circles");
    expect(calls[0]!.init.credentials).toBe("omit");
    expect((calls[0]!.init.headers as Record<string, string>).cookie).toBe(
      "better-auth.session_token=abc",
    );
  });

  test("profile and join requests carry JSON", async () => {
    const { api, calls } = client(() =>
      ok({ profile: { handle: "x" }, circle: { id: "c" }, created: true, alreadyMember: false }),
    );
    await api.saveProfile({
      handle: "Sabar_Pagi_100",
      gender: "akhwat",
      language: "id",
      tzOffsetHours: 7,
    });
    expect(calls[0]!.init.method).toBe("PUT");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      handle: "Sabar_Pagi_100",
      gender: "akhwat",
      language: "id",
      tzOffsetHours: 7,
    });
    await api.joinPrivate("ABCD-2345");
    expect(calls[1]!.url).toBe("https://api.example.test/v1/circles/join-private");
    expect(JSON.parse(calls[1]!.init.body as string)).toEqual({ code: "ABCD-2345" });
  });

  test("feed paging and reaction toggling", async () => {
    const { api, calls } = client(() =>
      ok({ posts: [], nextBefore: null, reactions: {}, myReaction: null }),
    );
    await api.feed("c 1", "42");
    expect(calls[0]!.url).toBe("https://api.example.test/v1/circles/c%201/feed?limit=30&before=42");
    await api.react("c1", "p1", "\u2728");
    expect(calls[1]!.init.method).toBe("PUT");
    await api.react("c1", "p1", null);
    expect(calls[2]!.init.method).toBe("DELETE");
    expect(calls[2]!.url).toBe("https://api.example.test/v1/circles/c1/posts/p1/reaction");
  });

  test("uploads a voice note with its mime and duration", async () => {
    const { api, calls } = client(() => ok({ mediaId: "m1" }, 201));
    expect(await api.uploadVoice("c1", "file:///a.m4a", "audio/mp4", 12.4)).toEqual({
      mediaId: "m1",
    });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.init.method).toBe("PUT");
    expect(headers["content-type"]).toBe("audio/mp4");
    expect(headers["x-duration-seconds"]).toBe("12");
    expect(calls[0]!.url).toBe("https://api.example.test/v1/circles/c1/media");
  });

  test("media playback source carries the cookie as a header", async () => {
    const { api } = client(() => ok({}));
    expect(await api.mediaSource("c1", "m1")).toEqual({
      uri: "https://api.example.test/v1/circles/c1/media/m1",
      headers: { cookie: "better-auth.session_token=abc" },
    });
  });

  test("errors expose status, code and retry-after", async () => {
    const { api } = client(
      () =>
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "retry-after": "120" },
        }),
    );
    const error = await api.joinPublic().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CirclesHttpError);
    const http = error as CirclesHttpError;
    expect([http.status, http.code, http.retryAfter, http.key]).toEqual([
      429,
      "rate_limited",
      120,
      "rateLimited",
    ]);
  });

  test("401 is detectable and a dead network is a network error", async () => {
    const unauthorized = client(() => ok({ error: "unauthorized" }, 401));
    expect(isUnauthorized(await unauthorized.api.list().catch((e: unknown) => e))).toBe(true);

    const offline = createCirclesApi({
      baseUrl: "https://api.example.test",
      getCookie: () => "",
      fetchImpl: (async () => {
        throw new TypeError("Network request failed");
      }) as unknown as typeof fetch,
    });
    const error = (await offline.list().catch((e: unknown) => e)) as CirclesHttpError;
    expect([error.status, error.key]).toEqual([null, "network"]);
  });

  test("no cookie header when signed out", async () => {
    const calls: Call[] = [];
    const api = createCirclesApi({
      baseUrl: "https://api.example.test",
      getCookie: () => "",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return ok({ circles: [] });
      }) as unknown as typeof fetch,
    });
    await api.list();
    expect(Object.keys(calls[0]!.init.headers as Record<string, string>)).toEqual([]);
  });
});
