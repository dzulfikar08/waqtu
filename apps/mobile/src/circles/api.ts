import type { ErrorGroup } from "../errors/report";
import { clampVoiceSeconds, errorKey, type ErrorKey } from "./logic";
import type {
  Block,
  Circle,
  CircleProfile,
  CirclesConfig,
  Feed,
  JoinResult,
  ModerationQueue,
  NewPost,
  Post,
  PostAction,
  ProfileInput,
  Report,
  UserAction,
  WeeklySummary,
} from "./types";

export class CirclesHttpError extends Error {
  constructor(
    /** Null when the request never got an answer (offline). */
    readonly status: number | null,
    readonly code: string | null,
    readonly retryAfter: number | null = null,
  ) {
    super(code ?? (status === null ? "network" : `http_${status}`));
    this.name = "CirclesHttpError";
  }

  get key(): ErrorKey {
    return errorKey(this.status, this.code);
  }
}

export const isUnauthorized = (e: unknown): boolean =>
  e instanceof CirclesHttpError && e.status === 401;

export interface CirclesApiOptions {
  baseUrl: string;
  /** The better-auth session cookie header value (`client.getCookie()`). */
  getCookie: () => Promise<string> | string;
  fetchImpl?: typeof fetch;
  /** Reads a local file (a recorded voice note) as a body. */
  readBlob?: (uri: string) => Promise<Blob>;
  /** Called when the server refuses a join or post with 403 `premium_required` (opens the paywall). */
  onPremiumRequired?: () => void;
}

export type CirclesApi = ReturnType<typeof createCirclesApi>;

/** Client for `/v1/circles` of services/api, plus the admin routes under `/v1/admin` (403 for everyone else). */
export function createCirclesApi(options: CirclesApiOptions) {
  const base = options.baseUrl.replace(/\/+$/, "");
  const root = `${base}/v1/circles`;
  const adminRoot = `${base}/v1/admin`;
  const doFetch = options.fetchImpl ?? fetch;
  const readBlob = options.readBlob ?? (async (uri: string) => (await doFetch(uri)).blob());

  async function headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const cookie = await options.getCookie();
    return { ...extra, ...(cookie ? { cookie } : {}) };
  }

  async function send(method: string, url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, method, credentials: "omit" });
    } catch {
      throw new CirclesHttpError(null, null);
    }
    if (res.ok) return res;
    let code: string | null = null;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") code = body.error;
    } catch {
      // Not JSON; the status is enough.
    }
    if (res.status === 403 && code === "premium_required") options.onPremiumRequired?.();
    const retry = Number(res.headers.get("retry-after"));
    throw new CirclesHttpError(
      res.status,
      code,
      Number.isFinite(retry) && retry > 0 ? retry : null,
    );
  }

  async function call<T>(method: string, path: string, body?: unknown, prefix = root): Promise<T> {
    const res = await send(method, `${prefix}${path}`, {
      headers: await headers(body === undefined ? {} : { "content-type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as T;
  }

  const segment = encodeURIComponent;

  return {
    config: () => call<CirclesConfig>("GET", "/config"),
    getProfile: async () =>
      (await call<{ profile: CircleProfile | null }>("GET", "/profile")).profile,
    saveProfile: async (input: ProfileInput) =>
      (await call<{ profile: CircleProfile }>("PUT", "/profile", input)).profile,
    list: async () => (await call<{ circles: Circle[] }>("GET", "")).circles,
    get: async (id: string) => (await call<{ circle: Circle }>("GET", `/${segment(id)}`)).circle,
    joinPublic: () => call<JoinResult>("POST", "/join", {}),
    joinPrivate: (code: string) => call<JoinResult>("POST", "/join-private", { code }),
    createPrivate: async (name: string | null) =>
      (await call<{ circle: Circle }>("POST", "/private", name ? { name } : {})).circle,
    /** Silent for everyone else: only the caller's own membership changes. */
    changeState: (id: string, change: "pause" | "resume" | "leave") =>
      call<{ status: "active" | "paused" | "left" }>("POST", `/${segment(id)}/${change}`),
    feed: (id: string, before?: string | null, limit = 30) =>
      call<Feed>(
        "GET",
        `/${segment(id)}/feed?limit=${limit}${before ? `&before=${segment(before)}` : ""}`,
      ),
    post: async (id: string, input: NewPost) =>
      (await call<{ post: Post }>("POST", `/${segment(id)}/posts`, input)).post,
    deletePost: (id: string, postId: string) =>
      call<{ ok: true }>("DELETE", `/${segment(id)}/posts/${segment(postId)}`),
    react: (id: string, postId: string, emoji: string | null) =>
      emoji
        ? call<{ reactions: Record<string, number>; myReaction: string | null }>(
            "PUT",
            `/${segment(id)}/posts/${segment(postId)}/reaction`,
            { emoji },
          )
        : call<{ reactions: Record<string, number>; myReaction: string | null }>(
            "DELETE",
            `/${segment(id)}/posts/${segment(postId)}/reaction`,
          ),
    report: (id: string, postId: string, report: Report) =>
      call<{ ok: true }>("POST", `/${segment(id)}/posts/${segment(postId)}/report`, report),
    block: async (id: string, postId: string) =>
      (await call<{ block: Block }>("POST", `/${segment(id)}/posts/${segment(postId)}/block`))
        .block,
    blocks: async () => (await call<{ blocks: Block[] }>("GET", "/blocks")).blocks,
    unblock: (blockId: string) => call<{ ok: true }>("DELETE", `/blocks/${segment(blockId)}`),
    shareSummary: async (id: string, summary: WeeklySummary) =>
      (await call<{ post: Post }>("POST", `/${segment(id)}/summary`, summary)).post,

    /** Admin moderation queue: posts and people with pending reports. */
    adminQueue: () => call<ModerationQueue>("GET", "/circles/queue", undefined, adminRoot),
    adminPost: (postId: string, action: PostAction) =>
      call<{ ok: true }>("POST", `/circles/posts/${segment(postId)}`, { action }, adminRoot),
    adminUser: (userId: string, action: UserAction) =>
      call<{ ok: true }>("POST", `/circles/users/${segment(userId)}`, { action }, adminRoot),
    /** Anonymous crash reports grouped by error, received since `since` (epoch ms; server default 7 days). */
    adminErrors: (since?: number) =>
      call<{ since: number; groups: ErrorGroup[] }>(
        "GET",
        `/errors${since === undefined ? "" : `?since=${since}`}`,
        undefined,
        adminRoot,
      ),

    /** Uploads a recorded voice note; the returned id goes into `post({ mediaId })`. */
    async uploadVoice(
      id: string,
      uri: string,
      mime: string,
      durationSeconds: number,
    ): Promise<{ mediaId: string }> {
      const body = await readBlob(uri);
      const res = await send("PUT", `${root}/${segment(id)}/media`, {
        headers: await headers({
          "content-type": mime,
          "x-duration-seconds": String(clampVoiceSeconds(durationSeconds)),
        }),
        body,
      });
      return (await res.json()) as { mediaId: string };
    },

    /** Source for expo-audio: the media route needs the session cookie, so it travels as a header. */
    async mediaSource(
      id: string,
      mediaId: string,
    ): Promise<{ uri: string; headers: Record<string, string> }> {
      return { uri: `${root}/${segment(id)}/media/${segment(mediaId)}`, headers: await headers() };
    },
  };
}
