import { readEntitlement } from "../billing/entitlement";
import { isAdmin, readQueue, requireAdmin, resolvePost, resolveUser } from "./admin";
import {
  changeMembership,
  createPrivate,
  joinPrivate,
  joinPublic,
  listMyCircles,
  requireMember,
} from "./circles";
import {
  AUDIO_MIME_TYPES,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  MAX_MEMBERS,
  MAX_TEXT_LENGTH,
  MIN_MEMBERS,
  REACTIONS,
  REPORT_REASONS,
} from "./constants";
import { errorResponse, HttpError, json, notFound, readJson } from "./http";
import { serveMedia, uploadMedia } from "./media";
import { blockAuthor, listBlocks, reportPost, unblock } from "./moderation";
import {
  createPost,
  deleteOwnPost,
  parseFeedQuery,
  readFeed,
  requireVisiblePost,
  setReaction,
  shareSummary,
} from "./posts";
import { getProfile, requireProfile, saveProfile } from "./profile";
import { enforceRate } from "./rateLimit";
import {
  isId,
  parseAction,
  parseJoinPrivate,
  parsePost,
  parsePrivateCircle,
  parseProfile,
  parseReaction,
  parseReport,
  parseSummary,
} from "./validate";

export interface CirclesEnv {
  APP_DB: D1Database;
  CIRCLE_MEDIA: R2Bucket;
  ADMIN_USER_IDS?: string;
  /** "true" makes circles premium: joining, creating and posting need an active entitlement. */
  CIRCLES_REQUIRES_PREMIUM?: string;
}

interface Ctx {
  env: CirclesEnv;
  request: Request;
  url: URL;
  userId: string;
  now: number;
  params: Record<string, string>;
}

type Handler = (c: Ctx) => Promise<Response>;

interface Route {
  method: string;
  pattern: string[];
  handler: Handler;
}

const db = (c: Ctx) => c.env.APP_DB;

/** Looks up a circle the caller belongs to; every `/:id` route starts here. */
async function member(c: Ctx, active = false) {
  const circleId = c.params.id as string;
  if (!isId(circleId)) throw notFound();
  await requireProfile(db(c), c.userId);
  return requireMember(db(c), c.userId, circleId, { active });
}

/** Joining and posting need premium while `CIRCLES_REQUIRES_PREMIUM` is "true"; reading never does. */
async function requirePremium(c: Ctx): Promise<void> {
  if (c.env.CIRCLES_REQUIRES_PREMIUM !== "true") return;
  const { premium } = await readEntitlement(db(c), c.userId, c.now);
  if (!premium) throw new HttpError(403, "premium_required");
}

function postParam(c: Ctx): string {
  const postId = c.params.postId as string;
  if (!isId(postId)) throw notFound();
  return postId;
}

const routes: Route[] = [
  {
    method: "GET",
    pattern: ["config"],
    handler: async (c) =>
      json({
        requiresPremium: c.env.CIRCLES_REQUIRES_PREMIUM === "true",
        circleSize: { min: MIN_MEMBERS, max: MAX_MEMBERS },
        maxTextLength: MAX_TEXT_LENGTH,
        maxAudioBytes: MAX_AUDIO_BYTES,
        maxAudioSeconds: MAX_AUDIO_SECONDS,
        audioMimeTypes: AUDIO_MIME_TYPES,
        reactions: REACTIONS,
        reportReasons: REPORT_REASONS,
        isAdmin: isAdmin(c.env.ADMIN_USER_IDS, c.userId),
      }),
  },
  {
    method: "GET",
    pattern: ["profile"],
    handler: async (c) => json({ profile: await getProfile(db(c), c.userId) }),
  },
  {
    method: "PUT",
    pattern: ["profile"],
    handler: async (c) => {
      const input = parseProfile(await readJson(c.request));
      await enforceRate(db(c), c.userId, "profile", c.now);
      return json({ profile: await saveProfile(db(c), c.userId, input, c.now) });
    },
  },
  {
    method: "GET",
    pattern: ["blocks"],
    handler: async (c) => json({ blocks: await listBlocks(db(c), c.userId) }),
  },
  {
    method: "DELETE",
    pattern: ["blocks", ":blockId"],
    handler: async (c) => {
      const blockId = c.params.blockId as string;
      if (!isId(blockId)) throw notFound();
      await enforceRate(db(c), c.userId, "block", c.now);
      await unblock(db(c), c.userId, blockId);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["join"],
    handler: async (c) => {
      const profile = await requireProfile(db(c), c.userId);
      await requirePremium(c);
      await enforceRate(db(c), c.userId, "join", c.now);
      const result = await joinPublic(db(c), c.userId, profile, c.now);
      return json(result, result.created ? 201 : 200);
    },
  },
  {
    method: "POST",
    pattern: ["join-private"],
    handler: async (c) => {
      const profile = await requireProfile(db(c), c.userId);
      await requirePremium(c);
      const { code } = parseJoinPrivate(await readJson(c.request));
      await enforceRate(db(c), c.userId, "join", c.now);
      return json(await joinPrivate(db(c), c.userId, profile, code, c.now));
    },
  },
  {
    method: "POST",
    pattern: ["private"],
    handler: async (c) => {
      const profile = await requireProfile(db(c), c.userId);
      await requirePremium(c);
      const { name } = parsePrivateCircle(await readJson(c.request));
      await enforceRate(db(c), c.userId, "join", c.now);
      return json({ circle: await createPrivate(db(c), c.userId, profile, name, c.now) }, 201);
    },
  },
  {
    method: "GET",
    pattern: [],
    handler: async (c) => {
      await requireProfile(db(c), c.userId);
      return json({ circles: await listMyCircles(db(c), c.userId) });
    },
  },
  {
    method: "GET",
    pattern: [":id"],
    handler: async (c) => json({ circle: await member(c) }),
  },
  ...(["pause", "resume", "leave"] as const).map((change): Route => ({
    method: "POST",
    pattern: [":id", change],
    handler: async (c) => {
      const circleId = c.params.id as string;
      if (!isId(circleId)) throw notFound();
      await enforceRate(db(c), c.userId, "state", c.now);
      return json(await changeMembership(db(c), c.userId, circleId, change, c.now));
    },
  })),
  {
    method: "GET",
    pattern: [":id", "feed"],
    handler: async (c) => {
      await member(c);
      const { before, limit } = parseFeedQuery(c.url.searchParams);
      return json(await readFeed(db(c), c.userId, c.params.id as string, before, limit));
    },
  },
  {
    method: "POST",
    pattern: [":id", "posts"],
    handler: async (c) => {
      await member(c, true);
      await requirePremium(c);
      const input = parsePost(await readJson(c.request));
      await enforceRate(db(c), c.userId, "post", c.now);
      const post = await createPost(db(c), c.userId, c.params.id as string, input, c.now);
      return json({ post }, 201);
    },
  },
  {
    method: "DELETE",
    pattern: [":id", "posts", ":postId"],
    handler: async (c) => {
      await member(c);
      const postId = postParam(c);
      await enforceRate(db(c), c.userId, "state", c.now);
      const keys = await deleteOwnPost(db(c), c.userId, c.params.id as string, postId);
      if (keys.length > 0) await c.env.CIRCLE_MEDIA.delete(keys);
      return json({ ok: true });
    },
  },
  {
    method: "PUT",
    pattern: [":id", "posts", ":postId", "reaction"],
    handler: async (c) => {
      await member(c, true);
      const postId = postParam(c);
      const emoji = parseReaction(await readJson(c.request));
      await enforceRate(db(c), c.userId, "react", c.now);
      await requireVisiblePost(db(c), c.userId, c.params.id as string, postId);
      return json(await setReaction(db(c), c.userId, postId, emoji, c.now));
    },
  },
  {
    method: "DELETE",
    pattern: [":id", "posts", ":postId", "reaction"],
    handler: async (c) => {
      await member(c, true);
      const postId = postParam(c);
      await enforceRate(db(c), c.userId, "react", c.now);
      await requireVisiblePost(db(c), c.userId, c.params.id as string, postId);
      return json(await setReaction(db(c), c.userId, postId, null, c.now));
    },
  },
  {
    method: "POST",
    pattern: [":id", "posts", ":postId", "report"],
    handler: async (c) => {
      await member(c);
      const postId = postParam(c);
      const input = parseReport(await readJson(c.request));
      await enforceRate(db(c), c.userId, "report", c.now);
      await reportPost(db(c), c.userId, c.params.id as string, postId, input, c.now);
      return json({ ok: true }, 201);
    },
  },
  {
    method: "POST",
    pattern: [":id", "posts", ":postId", "block"],
    handler: async (c) => {
      await member(c);
      const postId = postParam(c);
      await enforceRate(db(c), c.userId, "block", c.now);
      const block = await blockAuthor(db(c), c.userId, c.params.id as string, postId, c.now);
      return json({ block }, 201);
    },
  },
  {
    method: "POST",
    pattern: [":id", "summary"],
    handler: async (c) => {
      await member(c, true);
      await requirePremium(c);
      const profile = await requireProfile(db(c), c.userId);
      if (!profile.summaryOptIn) throw new HttpError(403, "summary_opt_in_required");
      const input = parseSummary(await readJson(c.request), c.now);
      await enforceRate(db(c), c.userId, "post", c.now);
      const post = await shareSummary(db(c), c.userId, c.params.id as string, input, c.now);
      return json({ post }, 201);
    },
  },
  {
    method: "PUT",
    pattern: [":id", "media"],
    handler: async (c) => {
      await member(c, true);
      await requirePremium(c);
      await enforceRate(db(c), c.userId, "upload", c.now);
      return await uploadMedia(c.env, c.request, c.userId, c.params.id as string, c.now);
    },
  },
  {
    method: "GET",
    pattern: [":id", "media", ":mediaId"],
    handler: async (c) => {
      await member(c);
      const mediaId = c.params.mediaId as string;
      if (!isId(mediaId)) throw notFound();
      return await serveMedia(c.env, c.request, c.userId, c.params.id as string, mediaId);
    },
  },
];

const adminRoutes: Route[] = [
  {
    method: "GET",
    pattern: ["queue"],
    handler: async (c) => json(await readQueue(db(c))),
  },
  {
    method: "POST",
    pattern: ["posts", ":postId"],
    handler: async (c) => {
      const action = parseAction(await readJson(c.request), ["restore", "remove"] as const);
      const keys = await resolvePost(db(c), postParam(c), action);
      if (keys.length > 0) await c.env.CIRCLE_MEDIA.delete(keys);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["users", ":userId"],
    handler: async (c) => {
      const action = parseAction(await readJson(c.request), [
        "suspend",
        "unsuspend",
        "dismiss",
      ] as const);
      await resolveUser(db(c), c.params.userId as string, action, c.now);
      return json({ ok: true });
    },
  },
];

function match(pattern: string[], segments: string[]): Record<string, string> | null {
  if (pattern.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i] as string;
    const s = segments[i] as string;
    if (p.startsWith(":")) params[p.slice(1)] = s;
    else if (p !== s) return null;
  }
  return params;
}

export const isCirclesPath = (pathname: string): boolean =>
  pathname === "/v1/circles" ||
  pathname.startsWith("/v1/circles/") ||
  pathname.startsWith("/v1/admin/circles/");

/** Dispatches `/v1/circles/*` and `/v1/admin/circles/*` for an authenticated user. */
export async function handleCircles(
  request: Request,
  env: CirclesEnv,
  userId: string,
  url: URL,
): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean);
  const admin = segments[1] === "admin";
  const table = admin ? adminRoutes : routes;
  const rest = segments.slice(admin ? 3 : 2);

  try {
    if (admin) requireAdmin(env.ADMIN_USER_IDS, userId);
    const allowed = new Set<string>();
    for (const route of table) {
      const params = match(route.pattern, rest);
      if (!params) continue;
      if (route.method !== request.method) {
        allowed.add(route.method);
        continue;
      }
      return await route.handler({ env, request, url, userId, now: Date.now(), params });
    }
    if (allowed.size > 0) {
      throw new HttpError(405, "method_not_allowed", undefined, {
        allow: [...allowed].join(", "),
      });
    }
    throw notFound();
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    throw e;
  }
}
