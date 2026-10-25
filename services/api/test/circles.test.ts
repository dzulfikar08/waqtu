import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test } from "vitest";

import { writeEntitlement } from "../src/billing/entitlement";
import { sweepOrphanUploads } from "../src/circles/cleanup";
import { handleCircles } from "../src/circles/router";
import { api, createUser, type TestUser } from "./helpers";

const WIPE = [
  "circle_rate",
  "circle_report",
  "circle_reaction",
  "circle_block",
  "circle_media",
  "circle_post",
  "circle_member",
  "circle",
  "circle_profile",
];

beforeEach(async () => {
  await env.APP_DB.batch(WIPE.map((t) => env.APP_DB.prepare(`DELETE FROM ${t}`)));
});

let counter = 0;

interface Opts {
  language?: "id" | "en";
  tz?: number;
}

/** A signed-in user with a circles profile. */
async function member(gender: "ikhwan" | "akhwat", opts: Opts = {}): Promise<TestUser> {
  const n = ++counter;
  const user = await createUser(`circle${n}`);
  const res = await api("/v1/circles/profile", {
    user,
    method: "PUT",
    json: {
      handle: `hamba${n}`,
      gender,
      language: opts.language ?? "id",
      tzOffsetHours: opts.tz ?? 7,
    },
  });
  expect(res.status).toBe(200);
  return user;
}

/** Listed in ADMIN_USER_IDS (vitest.config.ts). Created once; users outlive the per-test wipe. */
let adminUser: Promise<TestUser> | undefined;
const admin = () => (adminUser ??= createUser("circles-admin", "admin-circles-test"));

const call = async (user: TestUser, method: string, path: string, json?: unknown) => {
  const res = await api(`/v1/circles${path}`, { user, method, json });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
};

const join = (user: TestUser) => call(user, "POST", "/join");

async function privateCircle(owner: TestUser) {
  const res = await call(owner, "POST", "/private", { name: "Halaqah kecil" });
  expect(res.status).toBe(201);
  return res.body.circle as { id: string; inviteCode: string };
}

const joinCode = (user: TestUser, code: string) => call(user, "POST", "/join-private", { code });

async function post(user: TestUser, circleId: string, text: string, extra: object = {}) {
  const res = await call(user, "POST", `/${circleId}/posts`, { text, ...extra });
  expect(res.status).toBe(201);
  return res.body.post as { id: string };
}

const feed = async (user: TestUser, circleId: string) => {
  const res = await call(user, "GET", `/${circleId}/feed`);
  expect(res.status).toBe(200);
  return res.body.posts as {
    id: string;
    text: string | null;
    reactions: Record<string, number>;
    myReaction: string | null;
  }[];
};

const HEART = "\u2764\uFE0F";
const HANDS = "\u{1F932}";
const SPARKLE = "\u2728";

describe("auth and config", () => {
  test("every circles route needs a session", async () => {
    for (const [method, path] of [
      ["GET", "/v1/circles/config"],
      ["GET", "/v1/circles"],
      ["GET", "/v1/circles/profile"],
      ["PUT", "/v1/circles/profile"],
      ["POST", "/v1/circles/join"],
      ["POST", "/v1/circles/join-private"],
      ["GET", "/v1/circles/abc/feed"],
      ["GET", "/v1/circles/abc/media/def"],
      ["GET", "/v1/admin/circles/queue"],
    ] as const) {
      const res = await api(path, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  test("config exposes requiresPremium=false and the limits", async () => {
    const user = await createUser(`config${++counter}`);
    const res = await call(user, "GET", "/config");
    expect(res.status).toBe(200);
    expect(res.body.requiresPremium).toBe(false);
    expect(res.body.circleSize).toEqual({ min: 8, max: 12 });
    expect(res.body.maxTextLength).toBe(2000);
    expect(res.body.maxAudioBytes).toBe(5 * 1024 * 1024);
    expect(res.body.reactions).toEqual([HEART, HANDS, SPARKLE]);
    expect(res.body.isAdmin).toBe(false);
    expect((await call(await admin(), "GET", "/config")).body.isAdmin).toBe(true);
  });

  test("circle routes without a profile say profile_required", async () => {
    const user = await createUser(`noprofile${++counter}`);
    expect((await call(user, "GET", "")).body).toEqual({ error: "profile_required" });
    expect((await join(user)).status).toBe(409);
  });
});

describe("profile", () => {
  test("gender is required on creation and fixed afterwards", async () => {
    const user = await createUser(`profile${++counter}`);
    const base = { handle: `sabar${counter}`, language: "id", tzOffsetHours: 7 };
    expect((await call(user, "PUT", "/profile", base)).status).toBe(400);

    const created = await call(user, "PUT", "/profile", { ...base, gender: "ikhwan" });
    expect(created.status).toBe(200);
    expect(created.body.profile).toMatchObject({ gender: "ikhwan", handle: base.handle });

    const updated = await call(user, "PUT", "/profile", {
      ...base,
      handle: `baru${counter}`,
      language: "en",
    });
    expect(updated.body.profile).toMatchObject({ gender: "ikhwan", language: "en" });

    const flip = await call(user, "PUT", "/profile", { ...base, gender: "akhwat" });
    expect(flip.status).toBe(409);
    expect(flip.body.error).toBe("gender_locked");
    const row = await env.APP_DB.prepare("SELECT gender FROM circle_profile WHERE user_id = ?1")
      .bind(user.id)
      .first<{ gender: string }>();
    expect(row?.gender).toBe("ikhwan");
  });

  test("the database refuses a gender change even around the API", async () => {
    const user = await member("ikhwan");
    await expect(
      env.APP_DB.prepare("UPDATE circle_profile SET gender = 'akhwat' WHERE user_id = ?1")
        .bind(user.id)
        .run(),
    ).rejects.toThrow(/gender_locked/);
  });

  test("validates fields and rejects location data", async () => {
    const user = await createUser(`validate${++counter}`);
    const ok = { handle: `valid${counter}`, gender: "akhwat", language: "id", tzOffsetHours: 7 };
    for (const bad of [
      { ...ok, handle: "ab" },
      { ...ok, handle: "has space" },
      { ...ok, gender: "other" },
      { ...ok, language: "fr" },
      { ...ok, tzOffsetHours: 7.5 },
      { ...ok, tzOffsetHours: 20 },
      { ...ok, latitude: -6.2, longitude: 106.8 },
      { ...ok, city: "Jakarta" },
    ]) {
      expect((await call(user, "PUT", "/profile", bad)).status).toBe(400);
    }
    expect((await call(user, "PUT", "/profile", ok)).status).toBe(200);
  });

  test("handles are unique regardless of case", async () => {
    const a = await createUser(`dup${++counter}`);
    const b = await createUser(`dup${++counter}`);
    const body = { gender: "ikhwan", language: "id", tzOffsetHours: 7 };
    expect((await call(a, "PUT", "/profile", { ...body, handle: "Hamba_Allah" })).status).toBe(200);
    const clash = await call(b, "PUT", "/profile", { ...body, handle: "hamba_allah" });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toBe("handle_taken");
  });
});

describe("gender isolation", () => {
  test("a private circle's code, feed, posts, media and moderation are invisible to the other gender", async () => {
    const brother = await member("ikhwan");
    const sister = await member("akhwat");
    const circle = await privateCircle(brother);
    const p = await post(brother, circle.id, "bismillah");
    expect(
      (await call(brother, "PUT", `/${circle.id}/posts/${p.id}/reaction`, { emoji: SPARKLE }))
        .status,
    ).toBe(200);
    const week = {
      weekEnd: new Date().toISOString().slice(0, 10),
      countedDays: 5,
      fardhOnTime: 28,
      fardhJamaah: 10,
      pages: 42,
    };

    expect((await joinCode(sister, circle.inviteCode)).status).toBe(404);
    for (const [method, path, json] of [
      ["GET", `/${circle.id}`],
      ["GET", `/${circle.id}/feed`],
      ["POST", `/${circle.id}/posts`, { text: "salam" }],
      ["DELETE", `/${circle.id}/posts/${p.id}`],
      ["PUT", `/${circle.id}/posts/${p.id}/reaction`, { emoji: SPARKLE }],
      ["DELETE", `/${circle.id}/posts/${p.id}/reaction`],
      ["POST", `/${circle.id}/posts/${p.id}/report`, { target: "post", reason: "spam" }],
      ["POST", `/${circle.id}/posts/${p.id}/block`],
      ["POST", `/${circle.id}/summary`, week],
      ["PUT", `/${circle.id}/media`],
      ["GET", `/${circle.id}/media/${p.id}`],
      ["POST", `/${circle.id}/pause`],
      ["POST", `/${circle.id}/resume`],
      ["POST", `/${circle.id}/leave`],
    ] as const) {
      const res = await call(sister, method, path, json);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    expect((await call(sister, "GET", "")).body.circles).toEqual([]);
    const posts = await feed(brother, circle.id);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.reactions[SPARKLE]).toBe(1);

    // POST /private: a circle the sister creates stays closed to the brother, code and all.
    const hers = await privateCircle(sister);
    expect((await joinCode(brother, hers.inviteCode)).status).toBe(404);
    expect((await call(brother, "GET", `/${hers.id}`)).status).toBe(404);
    const brotherCircles = (await call(brother, "GET", "")).body.circles as { id: string }[];
    expect(brotherCircles.map((c) => c.id)).toEqual([circle.id]);
  });

  test("the database refuses a cross-gender membership even around the API", async () => {
    const brother = await member("ikhwan");
    const sister = await member("akhwat");
    const circle = await privateCircle(brother);
    await expect(
      env.APP_DB.prepare(
        `INSERT INTO circle_member (circle_id, user_id, circle_kind, status, joined_at, updated_at)
         VALUES (?1, ?2, 'private', 'active', 1, 1)`,
      )
        .bind(circle.id, sister.id)
        .run(),
    ).rejects.toThrow(/gender_mismatch/);
  });

  test("public auto-match never mixes genders, even with everything else equal", async () => {
    const brothers = [await member("ikhwan"), await member("ikhwan")];
    const sisters = [await member("akhwat"), await member("akhwat")];
    const brotherCircles = new Set<string>();
    const sisterCircles = new Set<string>();
    for (const user of brothers) brotherCircles.add((await join(user)).body.circle.id);
    for (const user of sisters) sisterCircles.add((await join(user)).body.circle.id);
    expect(brotherCircles.size).toBe(1);
    expect(sisterCircles.size).toBe(1);
    expect([...brotherCircles][0]).not.toBe([...sisterCircles][0]);
    const circles = await env.APP_DB.prepare("SELECT gender FROM circle ORDER BY gender").all<{
      gender: string;
    }>();
    expect(circles.results.map((c) => c.gender)).toEqual(["akhwat", "ikhwan"]);
  });
});

describe("matching and fill", () => {
  test("fills a circle to 12, then opens a new one", async () => {
    const users: TestUser[] = [];
    for (let i = 0; i < 13; i++) users.push(await member("ikhwan"));
    const first = await join(users[0]!);
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    const circleId = first.body.circle.id;
    for (let i = 1; i < 12; i++) {
      const res = await join(users[i]!);
      expect(res.status).toBe(200);
      expect(res.body.circle.id).toBe(circleId);
      expect(res.body.created).toBe(false);
    }
    const full = await call(users[0]!, "GET", `/${circleId}`);
    expect(full.body.circle).toMatchObject({ memberCount: 12, ready: true, full: true });

    const overflow = await join(users[12]!);
    expect(overflow.status).toBe(201);
    expect(overflow.body.created).toBe(true);
    expect(overflow.body.circle.id).not.toBe(circleId);
    expect(overflow.body.circle.memberCount).toBe(1);
    expect(overflow.body.circle.ready).toBe(false);
  });

  test("joining again returns the same circle", async () => {
    const user = await member("akhwat");
    const a = await join(user);
    const b = await join(user);
    expect(b.status).toBe(200);
    expect(b.body.alreadyMember).toBe(true);
    expect(b.body.circle.id).toBe(a.body.circle.id);
  });

  test("keeps language and timezone apart", async () => {
    const indo = await member("ikhwan", { language: "id", tz: 7 });
    const english = await member("ikhwan", { language: "en", tz: 7 });
    const faraway = await member("ikhwan", { language: "id", tz: -6 });
    const nearby = await member("ikhwan", { language: "id", tz: 9 });
    const a = (await join(indo)).body.circle.id;
    expect((await join(english)).body.circle.id).not.toBe(a);
    expect((await join(faraway)).body.circle.id).not.toBe(a);
    expect((await join(nearby)).body.circle.id).toBe(a);
  });

  test("seats freed by leaving are refilled, fullest circle first", async () => {
    const users: TestUser[] = [];
    for (let i = 0; i < 15; i++) users.push(await member("akhwat"));
    const circleA = (await join(users[0]!)).body.circle.id;
    for (let i = 1; i < 12; i++) await join(users[i]!);
    const circleB = (await join(users[12]!)).body.circle.id;
    expect(circleB).not.toBe(circleA);

    expect((await call(users[1]!, "POST", `/${circleA}/leave`)).status).toBe(200);
    expect((await call(users[2]!, "POST", `/${circleA}/leave`)).status).toBe(200);
    const next = await join(users[13]!);
    expect(next.body.circle.id).toBe(circleA);
    expect(next.body.circle.memberCount).toBe(11);

    // A member who left is never matched back into the same circle.
    const left = await join(users[1]!);
    expect(left.body.circle.id).toBe(circleB);
  });

  test("concurrent joins never exceed 12 seats", async () => {
    const users: TestUser[] = [];
    for (let i = 0; i < 16; i++) users.push(await member("ikhwan"));
    await Promise.all(users.map((u) => join(u)));
    const { results } = await env.APP_DB.prepare(
      `SELECT circle_id, COUNT(*) AS n FROM circle_member WHERE status = 'active' GROUP BY circle_id`,
    ).all<{ n: number }>();
    expect(results.reduce((sum, r) => sum + r.n, 0)).toBe(16);
    for (const r of results) expect(r.n).toBeLessThanOrEqual(12);
  });

  test("a private circle is capped at 12 and joined by code", async () => {
    const owner = await member("ikhwan");
    const circle = await privateCircle(owner);
    expect(circle.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    for (let i = 1; i < 12; i++) {
      const friend = await member("ikhwan");
      const res = await joinCode(friend, circle.inviteCode.toLowerCase());
      expect(res.status).toBe(200);
    }
    const late = await member("ikhwan");
    const res = await joinCode(late, circle.inviteCode);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("circle_full");
    expect((await joinCode(late, "NOPE2345")).status).toBe(404);
  });

  test("only members see the invite code, and rejoining after leaving works", async () => {
    const owner = await member("akhwat");
    const friend = await member("akhwat");
    const circle = await privateCircle(owner);
    const joined = await joinCode(friend, circle.inviteCode);
    expect(joined.body.circle.inviteCode).toBe(circle.inviteCode);
    expect((await call(friend, "POST", `/${circle.id}/leave`)).body).toEqual({ status: "left" });
    expect((await call(friend, "GET", `/${circle.id}`)).status).toBe(404);
    const back = await joinCode(friend, circle.inviteCode);
    expect(back.status).toBe(200);
    expect(back.body.circle.myStatus).toBe("active");
  });

  test("a public circle never reveals an invite code", async () => {
    const user = await member("akhwat");
    expect((await join(user)).body.circle.inviteCode).toBeNull();
  });
});

describe("pause and leave", () => {
  test("pausing keeps the seat, blocks posting, allows reading, and is silent for others", async () => {
    const owner = await member("ikhwan");
    const friend = await member("ikhwan");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    await post(owner, circle.id, "satu");

    const before = JSON.stringify(await feed(owner, circle.id));
    const ownerBefore = (await call(owner, "GET", `/${circle.id}`)).body.circle;
    const paused = await call(friend, "POST", `/${circle.id}/pause`);
    expect(paused.body).toEqual({ status: "paused" });

    expect(JSON.stringify(await feed(owner, circle.id))).toBe(before);
    expect((await call(owner, "GET", `/${circle.id}`)).body.circle).toEqual(ownerBefore);
    const rows = await env.APP_DB.prepare("SELECT COUNT(*) AS n FROM circle_post").first<{
      n: number;
    }>();
    expect(rows?.n).toBe(1);

    expect(await feed(friend, circle.id)).toHaveLength(1);
    const blocked = await call(friend, "POST", `/${circle.id}/posts`, { text: "halo" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("circle_paused");
    expect((await call(friend, "GET", `/${circle.id}`)).body.circle.myStatus).toBe("paused");

    expect((await call(friend, "POST", `/${circle.id}/resume`)).body).toEqual({ status: "active" });
    await post(friend, circle.id, "kembali");
  });

  test("leaving ends access, frees the seat, and repeating it is harmless", async () => {
    const owner = await member("akhwat");
    const friend = await member("akhwat");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    expect((await call(friend, "POST", `/${circle.id}/leave`)).status).toBe(200);
    expect((await call(friend, "POST", `/${circle.id}/leave`)).status).toBe(200);
    expect((await call(friend, "GET", `/${circle.id}/feed`)).status).toBe(404);
    expect((await call(friend, "POST", `/${circle.id}/pause`)).status).toBe(404);
    expect((await call(owner, "GET", `/${circle.id}`)).body.circle.memberCount).toBe(1);
  });

  test("a stranger cannot pause, resume or leave someone else's circle", async () => {
    const owner = await member("ikhwan");
    const stranger = await member("ikhwan");
    const circle = await privateCircle(owner);
    for (const action of ["pause", "resume", "leave"]) {
      expect((await call(stranger, "POST", `/${circle.id}/${action}`)).status).toBe(404);
    }
    expect((await call(owner, "GET", `/${circle.id}`)).body.circle.myStatus).toBe("active");
  });
});

describe("posts and reactions", () => {
  test("text posts: limits, halaqah link, listing newest first with paging", async () => {
    const owner = await member("ikhwan");
    const circle = await privateCircle(owner);
    const long = await call(owner, "POST", `/${circle.id}/posts`, { text: "x".repeat(2001) });
    expect(long.status).toBe(400);
    const max = await call(owner, "POST", `/${circle.id}/posts`, { text: "x".repeat(2000) });
    expect(max.status).toBe(201);
    expect((await call(owner, "POST", `/${circle.id}/posts`, { text: "   " })).status).toBe(400);
    expect((await call(owner, "POST", `/${circle.id}/posts`, {})).status).toBe(400);
    const badLink = await call(owner, "POST", `/${circle.id}/posts`, {
      text: "a",
      halaqahDayId: "not ok!",
    });
    expect(badLink.status).toBe(400);

    const linked = await call(owner, "POST", `/${circle.id}/posts`, {
      text: "refleksi",
      halaqahDayId: "2027-02-08",
    });
    expect(linked.body.post).toMatchObject({
      kind: "text",
      text: "refleksi",
      halaqahDayId: "2027-02-08",
      mine: true,
      handle: expect.stringMatching(/^hamba/),
    });
    expect(JSON.stringify(linked.body)).not.toContain(owner.id);

    const page1 = await call(owner, "GET", `/${circle.id}/feed?limit=1`);
    expect(page1.body.posts).toHaveLength(1);
    expect(page1.body.posts[0].text).toBe("refleksi");
    expect(page1.body.nextBefore).not.toBeNull();
    const page2 = await call(
      owner,
      "GET",
      `/${circle.id}/feed?limit=1&before=${page1.body.nextBefore}`,
    );
    expect(page2.body.posts[0].text).toHaveLength(2000);
    expect(page2.body.nextBefore).toBeNull();
    expect((await call(owner, "GET", `/${circle.id}/feed?limit=0`)).status).toBe(400);
    expect((await call(owner, "GET", `/${circle.id}/feed?before=x`)).status).toBe(400);
  });

  test("authors can delete their own posts, nobody else's", async () => {
    const owner = await member("ikhwan");
    const friend = await member("ikhwan");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    const mine = await post(owner, circle.id, "milikku");
    expect((await call(friend, "DELETE", `/${circle.id}/posts/${mine.id}`)).status).toBe(404);
    expect(await feed(friend, circle.id)).toHaveLength(1);
    expect((await call(owner, "DELETE", `/${circle.id}/posts/${mine.id}`)).status).toBe(200);
    expect(await feed(friend, circle.id)).toHaveLength(0);
  });

  test("one reaction per person from the fixed set, counted and changeable", async () => {
    const owner = await member("akhwat");
    const friend = await member("akhwat");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    const p = await post(owner, circle.id, "alhamdulillah");
    const react = (user: TestUser, emoji: unknown) =>
      call(user, "PUT", `/${circle.id}/posts/${p.id}/reaction`, { emoji });

    // The heart is accepted with or without its emoji variation selector.
    expect((await react(friend, "\u2764")).body).toMatchObject({
      myReaction: HEART,
      reactions: { [HEART]: 1, [HANDS]: 0, [SPARKLE]: 0 },
    });
    await react(owner, HANDS);
    expect((await feed(friend, circle.id))[0]).toMatchObject({
      myReaction: HEART,
      reactions: { [HEART]: 1, [HANDS]: 1, [SPARKLE]: 0 },
    });
    expect((await react(friend, SPARKLE)).body.reactions).toEqual({
      [HEART]: 0,
      [HANDS]: 1,
      [SPARKLE]: 1,
    });
    expect((await react(friend, "\u{1F44D}")).status).toBe(400);
    expect((await react(friend, "like")).status).toBe(400);
    const removed = await call(friend, "DELETE", `/${circle.id}/posts/${p.id}/reaction`);
    expect(removed.body.myReaction).toBeNull();
  });
});

describe("voice notes", () => {
  const audio = (size: number) => new Uint8Array(size).fill(7);
  const upload = (
    user: TestUser,
    circleId: string,
    body: Uint8Array,
    type = "audio/mp4",
    seconds: string | null = "12",
  ) =>
    api(`/v1/circles/${circleId}/media`, {
      user,
      method: "PUT",
      body,
      headers: { "content-type": type, ...(seconds ? { "x-duration-seconds": seconds } : {}) },
    });

  test("upload, attach to a post, and stream with byte ranges to members only", async () => {
    const owner = await member("ikhwan");
    const friend = await member("ikhwan");
    const sister = await member("akhwat");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);

    const res = await upload(owner, circle.id, audio(1000));
    expect(res.status).toBe(201);
    const media = (await res.json()) as { mediaId: string; bytes: number };
    expect(media.bytes).toBe(1000);

    const created = await call(owner, "POST", `/${circle.id}/posts`, {
      mediaId: media.mediaId,
      text: "dari hati",
    });
    expect(created.status).toBe(201);
    expect(created.body.post).toMatchObject({
      kind: "voice",
      media: { id: media.mediaId, mime: "audio/mp4", bytes: 1000, durationSeconds: 12 },
    });

    const again = await call(owner, "POST", `/${circle.id}/posts`, { mediaId: media.mediaId });
    expect(again.status).toBe(400);

    const url = `/v1/circles/${circle.id}/media/${media.mediaId}`;
    const full = await api(url, { user: friend });
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("audio/mp4");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect((await full.arrayBuffer()).byteLength).toBe(1000);

    const part = await api(url, { user: friend, headers: { range: "bytes=10-19" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 10-19/1000");
    expect((await part.arrayBuffer()).byteLength).toBe(10);
    const tail = await api(url, { user: friend, headers: { range: "bytes=-5" } });
    expect(tail.headers.get("content-range")).toBe("bytes 995-999/1000");
    await tail.arrayBuffer();
    expect((await api(url, { user: friend, headers: { range: "bytes=5000-" } })).status).toBe(416);

    expect((await api(url, { user: sister })).status).toBe(404);
    const stranger = await member("ikhwan");
    expect((await api(url, { user: stranger })).status).toBe(404);
  });

  test("rejects non-audio, oversize, empty and unmarked uploads", async () => {
    const owner = await member("akhwat");
    const circle = await privateCircle(owner);
    expect((await upload(owner, circle.id, audio(100), "image/png")).status).toBe(415);
    expect((await upload(owner, circle.id, audio(100), "application/octet-stream")).status).toBe(
      415,
    );
    expect((await upload(owner, circle.id, audio(5 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await upload(owner, circle.id, audio(0))).status).toBe(400);
    expect((await upload(owner, circle.id, audio(10), "audio/mp4", null)).status).toBe(400);
    expect((await upload(owner, circle.id, audio(10), "audio/mp4", "999")).status).toBe(400);
    const exact = await upload(owner, circle.id, audio(5 * 1024 * 1024), "audio/mp4; codecs=mp4a");
    expect(exact.status).toBe(201);
  });

  test("a voice note belongs to its uploader and its circle", async () => {
    const owner = await member("ikhwan");
    const friend = await member("ikhwan");
    const circle = await privateCircle(owner);
    const other = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    const media = (await (await upload(owner, circle.id, audio(50))).json()) as { mediaId: string };

    const stolen = await call(friend, "POST", `/${circle.id}/posts`, { mediaId: media.mediaId });
    expect(stolen.status).toBe(400);
    const elsewhere = await call(owner, "POST", `/${other.id}/posts`, { mediaId: media.mediaId });
    expect(elsewhere.status).toBe(400);
    const own = await call(owner, "POST", `/${circle.id}/posts`, { mediaId: media.mediaId });
    expect(own.status).toBe(201);
  });

  test("deleting the post removes the object from R2", async () => {
    const owner = await member("akhwat");
    const circle = await privateCircle(owner);
    const media = (await (await upload(owner, circle.id, audio(20))).json()) as { mediaId: string };
    const created = await call(owner, "POST", `/${circle.id}/posts`, { mediaId: media.mediaId });
    const key = `circle/${circle.id}/${media.mediaId}`;
    expect(await env.CIRCLE_MEDIA.head(key)).not.toBeNull();
    await call(owner, "DELETE", `/${circle.id}/posts/${created.body.post.id}`);
    expect(await env.CIRCLE_MEDIA.head(key)).toBeNull();
  });

  test("a shared halaqah voice reflection: stored in R2, linked to its day, played back by members", async () => {
    const owner = await member("akhwat");
    const friend = await member("akhwat");
    const circle = await privateCircle(owner);
    await joinCode(friend, circle.inviteCode);
    const media = (await (
      await upload(owner, circle.id, audio(300), "audio/mp4", "45")
    ).json()) as {
      mediaId: string;
    };
    expect(await env.CIRCLE_MEDIA.head(`circle/${circle.id}/${media.mediaId}`)).not.toBeNull();

    const created = await call(owner, "POST", `/${circle.id}/posts`, {
      text: "refleksi hari ke-12",
      mediaId: media.mediaId,
      halaqahDayId: "ramadhan-1448:12",
    });
    expect(created.status).toBe(201);
    expect(created.body.post).toMatchObject({
      kind: "voice",
      halaqahDayId: "ramadhan-1448:12",
      media: { id: media.mediaId, durationSeconds: 45 },
    });

    const feed = await call(friend, "GET", `/${circle.id}/feed`);
    expect(feed.body.posts[0]).toMatchObject({ halaqahDayId: "ramadhan-1448:12", mine: false });
    const played = await api(`/v1/circles/${circle.id}/media/${media.mediaId}`, { user: friend });
    expect(played.status).toBe(200);
    expect((await played.arrayBuffer()).byteLength).toBe(300);
  });
});

describe("weekly summary share", () => {
  const week = () => ({
    weekEnd: new Date().toISOString().slice(0, 10),
    countedDays: 5,
    fardhOnTime: 28,
    fardhJamaah: 10,
    pages: 42,
  });

  test("needs opt-in, validates aggregates, and replaces the same week", async () => {
    const user = await member("ikhwan");
    const circle = await privateCircle(user);
    const denied = await call(user, "POST", `/${circle.id}/summary`, week());
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("summary_opt_in_required");

    const optIn = await call(user, "PUT", "/profile", {
      handle: `hamba${counter}`,
      language: "id",
      tzOffsetHours: 7,
      summaryOptIn: true,
    });
    expect(optIn.body.profile.summaryOptIn).toBe(true);
    const shared = await call(user, "POST", `/${circle.id}/summary`, week());
    expect(shared.status).toBe(201);
    expect(shared.body.post).toMatchObject({ kind: "summary", summary: week() });

    const redone = await call(user, "POST", `/${circle.id}/summary`, { ...week(), pages: 50 });
    expect(redone.body.post.id).toBe(shared.body.post.id);
    expect(redone.body.post.summary.pages).toBe(50);
    expect(await feed(user, circle.id)).toHaveLength(1);

    for (const bad of [
      { ...week(), countedDays: 8 },
      { ...week(), fardhOnTime: -1 },
      { ...week(), pages: 1.5 },
      { ...week(), weekEnd: "2020-01-01" },
      { ...week(), weekEnd: "2027-13-40" },
      { ...week(), items: ["tahajjud"] },
      { ...week(), streak: 30 },
    ]) {
      expect((await call(user, "POST", `/${circle.id}/summary`, bad)).status).toBe(400);
    }
  });
});

describe("blocking", () => {
  test("blocks hide both people from each other, reactions included, and can be undone", async () => {
    const a = await member("ikhwan");
    const b = await member("ikhwan");
    const c = await member("ikhwan");
    const circle = await privateCircle(a);
    await joinCode(b, circle.inviteCode);
    await joinCode(c, circle.inviteCode);
    const fromA = await post(a, circle.id, "dari A");
    const fromB = await post(b, circle.id, "dari B");
    await call(a, "PUT", `/${circle.id}/posts/${fromB.id}/reaction`, { emoji: SPARKLE });
    await call(c, "PUT", `/${circle.id}/posts/${fromB.id}/reaction`, { emoji: SPARKLE });
    expect(await feed(b, circle.id)).toHaveLength(2);

    const blocked = await call(a, "POST", `/${circle.id}/posts/${fromB.id}/block`);
    expect(blocked.status).toBe(201);
    expect(blocked.body.block.handle).toMatch(/^hamba/);
    expect(JSON.stringify(blocked.body)).not.toContain(b.id);

    expect((await feed(a, circle.id)).map((p) => p.id)).toEqual([fromA.id]);
    expect((await feed(b, circle.id)).map((p) => p.id)).toEqual([fromB.id]);
    // A's reaction is hidden from B; C, who blocked nobody, still sees both.
    const ownView = (await feed(b, circle.id))[0]!;
    expect(ownView.reactions[SPARKLE]).toBe(1);
    const seenByC = await feed(c, circle.id);
    expect(seenByC).toHaveLength(2);
    expect(seenByC.find((p) => p.id === fromB.id)?.reactions[SPARKLE]).toBe(2);

    // Neither side can touch the other's post any more.
    for (const [user, target] of [
      [a, fromB.id],
      [b, fromA.id],
    ] as const) {
      const react = await call(user, "PUT", `/${circle.id}/posts/${target}/reaction`, {
        emoji: SPARKLE,
      });
      expect(react.status).toBe(404);
      const report = await call(user, "POST", `/${circle.id}/posts/${target}/report`, {
        target: "post",
        reason: "spam",
      });
      expect(report.status).toBe(404);
    }

    const list = await call(a, "GET", "/blocks");
    expect(list.body.blocks).toHaveLength(1);
    expect((await call(b, "GET", "/blocks")).body.blocks).toHaveLength(0);

    expect((await call(b, "DELETE", `/blocks/${list.body.blocks[0].id}`)).status).toBe(404);
    expect((await call(a, "DELETE", `/blocks/${list.body.blocks[0].id}`)).status).toBe(200);
    expect(await feed(a, circle.id)).toHaveLength(2);
  });

  test("a block can only target someone met through a post, never yourself", async () => {
    const a = await member("akhwat");
    const circle = await privateCircle(a);
    const own = await post(a, circle.id, "sendiri");
    expect((await call(a, "POST", `/${circle.id}/posts/${own.id}/block`)).status).toBe(400);
    const ghost = await call(a, "POST", `/${circle.id}/posts/${crypto.randomUUID()}/block`);
    expect(ghost.status).toBe(404);
  });

  test("auto-match skips circles with someone you blocked or who blocked you", async () => {
    const a = await member("akhwat");
    const b = await member("akhwat");
    const priv = await privateCircle(a);
    await joinCode(b, priv.inviteCode);
    const p = await post(b, priv.id, "halo");
    await call(a, "POST", `/${priv.id}/posts/${p.id}/block`);

    const bCircle = (await join(b)).body.circle.id;
    const aCircle = await join(a);
    expect(aCircle.body.circle.id).not.toBe(bCircle);
    expect(aCircle.body.created).toBe(true);

    // From the blocked side too: b cannot be matched next to a.
    await call(b, "POST", `/${bCircle}/leave`);
    const rejoin = await join(b);
    expect(rejoin.body.circle.id).not.toBe(aCircle.body.circle.id);
  });

  test("blocked users cannot join the same private circle via code", async () => {
    const a = await member("ikhwan");
    const b = await member("ikhwan");
    const first = await privateCircle(a);
    await joinCode(b, first.inviteCode);
    const p = await post(b, first.id, "assalamualaikum");
    await call(a, "POST", `/${first.id}/posts/${p.id}/block`);
    await call(b, "POST", `/${first.id}/leave`);
    expect((await joinCode(b, first.inviteCode)).status).toBe(404);
  });
});

describe("moderation", () => {
  async function circleOf(size: number) {
    const owner = await member("akhwat");
    const circle = await privateCircle(owner);
    const others: TestUser[] = [];
    for (let i = 0; i < size; i++) {
      const u = await member("akhwat");
      await joinCode(u, circle.inviteCode);
      others.push(u);
    }
    return { owner, circle, others };
  }

  const report = (user: TestUser, circleId: string, postId: string, reason = "spam") =>
    call(user, "POST", `/${circleId}/posts/${postId}/report`, { target: "post", reason });

  test("three distinct reporters hide a post; fewer, or repeats, do not", async () => {
    const { owner, circle, others } = await circleOf(4);
    const bad = await post(owner, circle.id, "iklan");
    const [r1, r2, r3, r4] = others as [TestUser, TestUser, TestUser, TestUser];

    expect((await report(r1, circle.id, bad.id)).status).toBe(201);
    expect((await report(r1, circle.id, bad.id)).status).toBe(201);
    expect((await report(r1, circle.id, bad.id)).status).toBe(201);
    expect((await report(r2, circle.id, bad.id, "harassment")).status).toBe(201);
    expect(await feed(r4, circle.id)).toHaveLength(1);

    expect((await report(r3, circle.id, bad.id, "inappropriate")).status).toBe(201);
    expect(await feed(r4, circle.id)).toHaveLength(0);
    expect(await feed(owner, circle.id)).toHaveLength(0);
    expect(await feed(r1, circle.id)).toHaveLength(0);
    expect((await report(r4, circle.id, bad.id)).status).toBe(404);

    const row = await env.APP_DB.prepare("SELECT status FROM circle_post WHERE id = ?1")
      .bind(bad.id)
      .first<{ status: string }>();
    expect(row?.status).toBe("hidden");
  });

  test("users cannot report themselves or send bad input", async () => {
    const { owner, circle, others } = await circleOf(1);
    const p = await post(owner, circle.id, "satu");
    expect((await report(owner, circle.id, p.id)).status).toBe(400);
    const friend = others[0]!;
    const path = `/${circle.id}/posts/${p.id}/report`;
    expect((await call(friend, "POST", path, { target: "post", reason: "meh" })).status).toBe(400);
    expect((await call(friend, "POST", path, { target: "all", reason: "spam" })).status).toBe(400);
  });

  test("user reports never hide a post by themselves", async () => {
    const { owner, circle, others } = await circleOf(3);
    const p = await post(owner, circle.id, "satu");
    for (const u of others) {
      const res = await call(u, "POST", `/${circle.id}/posts/${p.id}/report`, {
        target: "user",
        reason: "harassment",
        note: "tidak nyaman",
      });
      expect(res.status).toBe(201);
    }
    expect(await feed(others[0]!, circle.id)).toHaveLength(1);
  });

  test("the admin queue is closed to everyone except ADMIN_USER_IDS", async () => {
    const regular = await member("akhwat");
    expect((await api("/v1/admin/circles/queue", { user: regular })).status).toBe(403);
    const resolve = await api("/v1/admin/circles/posts/abc", {
      user: regular,
      json: { action: "remove" },
    });
    expect(resolve.status).toBe(403);
    const suspend = await api("/v1/admin/circles/users/abc", {
      user: regular,
      json: { action: "suspend" },
    });
    expect(suspend.status).toBe(403);
  });

  test("admins review hidden posts: restore needs three new reporters, remove is final", async () => {
    const root = await admin();
    const { owner, circle, others } = await circleOf(6);
    const keep = await post(owner, circle.id, "salah paham");
    const drop = await post(owner, circle.id, "spam beneran");
    for (const target of [keep, drop]) {
      for (const u of others.slice(0, 3)) await report(u, circle.id, target.id);
    }
    expect(await feed(owner, circle.id)).toHaveLength(0);

    const queue = await api("/v1/admin/circles/queue", { user: root });
    expect(queue.status).toBe(200);
    const body = (await queue.json()) as {
      posts: { id: string; hidden: boolean; pendingReports: number; authorUserId: string }[];
    };
    expect(body.posts.map((p) => p.id).sort()).toEqual([keep.id, drop.id].sort());
    expect(body.posts.every((p) => p.hidden && p.pendingReports === 3)).toBe(true);
    expect(body.posts[0]!.authorUserId).toBe(owner.id);

    const restored = await api(`/v1/admin/circles/posts/${keep.id}`, {
      user: root,
      json: { action: "restore" },
    });
    expect(restored.status).toBe(200);
    const removed = await api(`/v1/admin/circles/posts/${drop.id}`, {
      user: root,
      json: { action: "remove" },
    });
    expect(removed.status).toBe(200);

    expect((await feed(others[0]!, circle.id)).map((p) => p.id)).toEqual([keep.id]);
    // Reports were cleared and the earlier reporters cannot pile on again: it takes three new people.
    for (const u of [others[0]!, others[3]!, others[4]!]) await report(u, circle.id, keep.id);
    expect(await feed(owner, circle.id)).toHaveLength(1);
    await report(others[5]!, circle.id, keep.id);
    expect(await feed(owner, circle.id)).toHaveLength(0);

    const after = await api("/v1/admin/circles/queue", { user: root });
    expect(((await after.json()) as { posts: unknown[] }).posts).toHaveLength(1);
    const again = await api(`/v1/admin/circles/posts/${drop.id}`, {
      user: root,
      json: { action: "restore" },
    });
    expect(again.status).toBe(404);
    const unknown = await api(`/v1/admin/circles/posts/${keep.id}`, {
      user: root,
      json: { action: "ban" },
    });
    expect(unknown.status).toBe(400);
  });

  test("suspending a user ends their circle access until lifted", async () => {
    const root = await admin();
    const { owner, circle, others } = await circleOf(1);
    const p = await post(owner, circle.id, "satu");
    await call(others[0]!, "POST", `/${circle.id}/posts/${p.id}/report`, {
      target: "user",
      reason: "harassment",
    });
    const queue = (await (await api("/v1/admin/circles/queue", { user: root })).json()) as {
      users: { userId: string; pendingReports: number; suspended: boolean }[];
    };
    expect(queue.users).toEqual([
      expect.objectContaining({ userId: owner.id, pendingReports: 1, suspended: false }),
    ]);

    const res = await api(`/v1/admin/circles/users/${owner.id}`, {
      user: root,
      json: { action: "suspend" },
    });
    expect(res.status).toBe(200);
    expect((await call(owner, "GET", `/${circle.id}`)).status).toBe(403);
    expect((await join(owner)).body.error).toBe("suspended");
    expect((await call(others[0]!, "GET", `/${circle.id}`)).body.circle.memberCount).toBe(1);

    await api(`/v1/admin/circles/users/${owner.id}`, { user: root, json: { action: "unsuspend" } });
    expect((await call(owner, "GET", "")).status).toBe(200);
  });
});

describe("rate limits", () => {
  test("posting is limited per user per hour with Retry-After", async () => {
    const user = await member("ikhwan");
    const other = await member("ikhwan");
    const circle = await privateCircle(user);
    const otherCircle = await privateCircle(other);
    for (let i = 0; i < 12; i++) {
      expect((await call(user, "POST", `/${circle.id}/posts`, { text: `p${i}` })).status).toBe(201);
    }
    const limited = await call(user, "POST", `/${circle.id}/posts`, { text: "one too many" });
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("rate_limited");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await feed(user, circle.id)).toHaveLength(12);

    // Per user, not global.
    const fine = await call(other, "POST", `/${otherCircle.id}/posts`, { text: "fine" });
    expect(fine.status).toBe(201);
    // Reading is never limited.
    expect((await call(user, "GET", `/${circle.id}/feed`)).status).toBe(200);
  });

  test("invite-code guessing is limited", async () => {
    const user = await member("akhwat");
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await joinCode(user, "ABCD2345")).status;
    expect(last).toBe(429);
  });

  test("the window resets after an hour", async () => {
    const user = await member("akhwat");
    const circle = await privateCircle(user);
    for (let i = 0; i < 13; i++) await call(user, "POST", `/${circle.id}/posts`, { text: `p${i}` });
    expect((await call(user, "POST", `/${circle.id}/posts`, { text: "blocked" })).status).toBe(429);
    await env.APP_DB.prepare(
      "UPDATE circle_rate SET window_start = window_start - 3700000 WHERE user_id = ?1 AND bucket = 'post'",
    )
      .bind(user.id)
      .run();
    expect((await call(user, "POST", `/${circle.id}/posts`, { text: "again" })).status).toBe(201);
  });
});

describe("routing", () => {
  test("unknown paths and wrong methods", async () => {
    const user = await member("ikhwan");
    expect((await call(user, "GET", "/nope/nothing/here/at-all")).status).toBe(404);
    const res = await call(user, "DELETE", "/profile");
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, PUT");
    expect((await call(user, "GET", "/not-a-circle-%20id")).status).toBe(404);
  });
});

describe("summary replacement", () => {
  const week = () => ({
    weekEnd: new Date().toISOString().slice(0, 10),
    countedDays: 4,
    fardhOnTime: 20,
    fardhJamaah: 5,
    pages: 10,
  });

  test("never rewrites a summary that is hidden or removed", async () => {
    const user = await member("akhwat");
    const circle = await privateCircle(user);
    await call(user, "PUT", "/profile", {
      handle: `hamba${counter}`,
      language: "id",
      tzOffsetHours: 7,
      summaryOptIn: true,
    });
    const shared = await call(user, "POST", `/${circle.id}/summary`, week());
    expect(shared.status).toBe(201);
    const postId = shared.body.post.id as string;

    for (const status of ["hidden", "removed"]) {
      await env.APP_DB.prepare("UPDATE circle_post SET status = ?2 WHERE id = ?1")
        .bind(postId, status)
        .run();
      const again = await call(user, "POST", `/${circle.id}/summary`, { ...week(), pages: 99 });
      expect(again.status).toBe(409);
      expect(again.body.error).toBe("summary_unavailable");
      const row = await env.APP_DB.prepare(
        "SELECT status, summary_json FROM circle_post WHERE id = ?1",
      )
        .bind(postId)
        .first<{ status: string; summary_json: string }>();
      expect(row?.status).toBe(status);
      expect(JSON.parse(row!.summary_json).pages).toBe(10);
    }
    const count = await env.APP_DB.prepare("SELECT COUNT(*) AS n FROM circle_post").first<{
      n: number;
    }>();
    expect(count?.n).toBe(1);
  });
});

describe("media cleanup", () => {
  const upload = async (user: TestUser, circleId: string, size = 30) => {
    const res = await api(`/v1/circles/${circleId}/media`, {
      user,
      method: "PUT",
      body: new Uint8Array(size).fill(1),
      headers: { "content-type": "audio/mp4", "x-duration-seconds": "5" },
    });
    expect(res.status).toBe(201);
    const { mediaId } = (await res.json()) as { mediaId: string };
    return { mediaId, key: `circle/${circleId}/${mediaId}` };
  };

  test("deleting the account removes every voice note object, posted or not", async () => {
    const user = await createUser(`leaver${++counter}`);
    expect(
      (
        await call(user, "PUT", "/profile", {
          handle: `leaver${counter}`,
          gender: "ikhwan",
          language: "id",
          tzOffsetHours: 7,
        })
      ).status,
    ).toBe(200);
    const bystander = await member("ikhwan");
    const circle = await privateCircle(user);
    const other = await privateCircle(bystander);

    const posted = await upload(user, circle.id);
    await call(user, "POST", `/${circle.id}/posts`, { mediaId: posted.mediaId });
    const unposted = await upload(user, circle.id);
    const others = await upload(bystander, other.id);
    for (const { key } of [posted, unposted, others]) {
      expect(await env.CIRCLE_MEDIA.head(key)).not.toBeNull();
    }

    const res = await api("/api/auth/delete-user", {
      user,
      json: {},
      headers: { origin: "http://localhost" },
    });
    expect(res.status).toBe(200);

    expect(await env.CIRCLE_MEDIA.head(posted.key)).toBeNull();
    expect(await env.CIRCLE_MEDIA.head(unposted.key)).toBeNull();
    expect(await env.CIRCLE_MEDIA.head(others.key)).not.toBeNull();
    const rows = await env.APP_DB.prepare(
      "SELECT COUNT(*) AS n FROM circle_media WHERE user_id = ?1",
    )
      .bind(user.id)
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  test("the sweep removes uploads never posted after 24h and nothing else", async () => {
    const user = await member("akhwat");
    const circle = await privateCircle(user);
    const HOUR = 3_600_000;
    const staleOrphan = await upload(user, circle.id);
    const freshOrphan = await upload(user, circle.id);
    const oldPosted = await upload(user, circle.id);
    await call(user, "POST", `/${circle.id}/posts`, { mediaId: oldPosted.mediaId });
    const age = (mediaId: string, hours: number) =>
      env.APP_DB.prepare("UPDATE circle_media SET created_at = ?2 WHERE id = ?1")
        .bind(mediaId, Date.now() - hours * HOUR)
        .run();
    await age(staleOrphan.mediaId, 25);
    await age(freshOrphan.mediaId, 23);
    await age(oldPosted.mediaId, 48);

    expect(await sweepOrphanUploads(env, Date.now())).toBe(1);
    expect(await env.CIRCLE_MEDIA.head(staleOrphan.key)).toBeNull();
    expect(await env.CIRCLE_MEDIA.head(freshOrphan.key)).not.toBeNull();
    expect(await env.CIRCLE_MEDIA.head(oldPosted.key)).not.toBeNull();
    expect(await sweepOrphanUploads(env, Date.now())).toBe(0);

    const left = await env.APP_DB.prepare("SELECT id FROM circle_media ORDER BY id").all<{
      id: string;
    }>();
    expect(left.results.map((r) => r.id).sort()).toEqual(
      [freshOrphan.mediaId, oldPosted.mediaId].sort(),
    );
  });

  test("the worker's scheduled handler runs the sweep", async () => {
    const user = await member("ikhwan");
    const circle = await privateCircle(user);
    const stale = await upload(user, circle.id);
    await env.APP_DB.prepare("UPDATE circle_media SET created_at = ?2 WHERE id = ?1")
      .bind(stale.mediaId, Date.now() - 30 * 3_600_000)
      .run();
    const worker = (await import("../worker")).default;
    const waits: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "17 * * * *", noRetry() {} } as ScheduledController,
      env,
      {
        waitUntil: (p: Promise<unknown>) => void waits.push(p),
        passThroughOnException() {},
      } as ExecutionContext,
    );
    await Promise.all(waits);
    expect(await env.CIRCLE_MEDIA.head(stale.key)).toBeNull();
  });
});

describe("premium gate (CIRCLES_REQUIRES_PREMIUM=true)", () => {
  const premiumEnv = { ...env, CIRCLES_REQUIRES_PREMIUM: "true" };

  const gated = async (user: TestUser, method: string, path: string, json?: unknown) => {
    const res = await handleCircles(
      new Request(`http://localhost/v1/circles${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: json === undefined ? undefined : JSON.stringify(json),
      }),
      premiumEnv,
      user.id,
      new URL(`http://localhost/v1/circles${path}`),
    );
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  const subscribe = (user: TestUser) =>
    writeEntitlement(
      env.APP_DB,
      {
        userId: user.id,
        source: "apple",
        externalId: `orig-${crypto.randomUUID()}`,
        productId: "dat.waqtu.premium.monthly",
        environment: "production",
        expiresAt: Date.now() + 30 * 86_400_000,
        signedAt: Date.now(),
      },
      Date.now(),
    );

  test("config reports the flag", async () => {
    const user = await member("ikhwan");
    expect((await gated(user, "GET", "/config")).body.requiresPremium).toBe(true);
  });

  test("free accounts cannot join, create or post, but can still read", async () => {
    const owner = await member("ikhwan");
    // Joined while circles were free.
    const circle = await privateCircle(owner);
    const premiumRequired = { status: 403, body: { error: "premium_required" } };

    expect(await gated(owner, "POST", "/join")).toEqual(premiumRequired);
    expect(await gated(owner, "POST", "/join-private", { code: circle.inviteCode })).toEqual(
      premiumRequired,
    );
    expect(await gated(owner, "POST", "/private", { name: "Lagi" })).toEqual(premiumRequired);
    expect(await gated(owner, "POST", `/${circle.id}/posts`, { text: "salam" })).toEqual(
      premiumRequired,
    );
    expect(await gated(owner, "POST", `/${circle.id}/summary`, {})).toEqual(premiumRequired);
    expect(await gated(owner, "PUT", `/${circle.id}/media`)).toEqual(premiumRequired);

    expect((await gated(owner, "GET", "")).status).toBe(200);
    expect((await gated(owner, "GET", `/${circle.id}/feed`)).status).toBe(200);
  });

  test("premium accounts join and post as usual", async () => {
    const user = await member("akhwat");
    await subscribe(user);
    const created = await gated(user, "POST", "/private", { name: "Premium" });
    expect(created.status).toBe(201);
    const posted = await gated(user, "POST", `/${created.body.circle.id}/posts`, { text: "salam" });
    expect(posted.status).toBe(201);
    expect((await gated(user, "POST", "/join")).status).toBeLessThan(300);
  });

  test("with the flag off, free accounts are not checked", async () => {
    const user = await member("ikhwan");
    expect((await join(user)).status).toBeLessThan(300);
  });
});
