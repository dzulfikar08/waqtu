import { FEED_PAGE_DEFAULT, FEED_PAGE_MAX, REACTIONS, type Reaction } from "./constants";
import { HttpError, notFound } from "./http";
import type { PostInput, SummaryInput } from "./validate";

export interface PostView {
  id: string;
  kind: "text" | "voice" | "summary";
  /** Display handle only. User ids never leave the server. */
  handle: string;
  mine: boolean;
  text: string | null;
  createdAt: number;
  halaqahDayId: string | null;
  media: { id: string; mime: string; bytes: number; durationSeconds: number } | null;
  summary: SummaryInput | null;
  reactions: Record<string, number>;
  myReaction: Reaction | null;
}

interface PostRow {
  seq: number;
  id: string;
  user_id: string;
  kind: PostView["kind"];
  body: string | null;
  halaqah_day_id: string | null;
  summary_json: string | null;
  created_at: number;
  handle: string;
  media_id: string | null;
  media_mime: string | null;
  media_bytes: number | null;
  media_seconds: number | null;
}

const POST_SELECT = `
  SELECT p.seq, p.id, p.user_id, p.kind, p.body, p.halaqah_day_id, p.summary_json, p.created_at,
    pr.handle, md.id AS media_id, md.mime AS media_mime, md.bytes AS media_bytes,
    md.duration_seconds AS media_seconds
  FROM circle_post p
  JOIN circle_profile pr ON pr.user_id = p.user_id
  LEFT JOIN circle_media md ON md.post_id = p.id`;

/** `?1` is always the viewer. A block hides the pair from each other, whoever placed it. */
export const NOT_BLOCKED = (other: string) => `NOT EXISTS (
  SELECT 1 FROM circle_block b
  WHERE (b.blocker_id = ?1 AND b.blocked_id = ${other})
     OR (b.blocker_id = ${other} AND b.blocked_id = ?1))`;

const emptyReactions = (): Record<string, number> =>
  Object.fromEntries(REACTIONS.map((r) => [r, 0]));

async function toViews(db: D1Database, viewerId: string, rows: PostRow[]): Promise<PostView[]> {
  if (rows.length === 0) return [];
  const marks = rows.map((_, i) => `?${i + 2}`).join(", ");
  const { results } = await db
    .prepare(
      `SELECT r.post_id, r.emoji, COUNT(*) AS n, MAX(r.user_id = ?1) AS mine
       FROM circle_reaction r
       WHERE r.post_id IN (${marks}) AND ${NOT_BLOCKED("r.user_id")}
       GROUP BY r.post_id, r.emoji`,
    )
    .bind(viewerId, ...rows.map((r) => r.id))
    .all<{ post_id: string; emoji: Reaction; n: number; mine: number }>();
  const byPost = new Map<string, { counts: Record<string, number>; mine: Reaction | null }>();
  for (const r of results) {
    const entry = byPost.get(r.post_id) ?? { counts: emptyReactions(), mine: null };
    entry.counts[r.emoji] = r.n;
    if (r.mine === 1) entry.mine = r.emoji;
    byPost.set(r.post_id, entry);
  }
  return rows.map((r) => {
    const reactions = byPost.get(r.id);
    return {
      id: r.id,
      kind: r.kind,
      handle: r.handle,
      mine: r.user_id === viewerId,
      text: r.body,
      createdAt: r.created_at,
      halaqahDayId: r.halaqah_day_id,
      media:
        r.media_id === null
          ? null
          : {
              id: r.media_id,
              mime: r.media_mime as string,
              bytes: r.media_bytes as number,
              durationSeconds: r.media_seconds as number,
            },
      summary: r.summary_json ? (JSON.parse(r.summary_json) as PostView["summary"]) : null,
      reactions: reactions?.counts ?? emptyReactions(),
      myReaction: reactions?.mine ?? null,
    };
  });
}

export interface Feed {
  posts: PostView[];
  /** Pass as `before` for the next older page; null at the end. */
  nextBefore: string | null;
}

export function parseFeedQuery(params: URLSearchParams): { before: number; limit: number } {
  const rawBefore = params.get("before");
  const rawLimit = params.get("limit");
  if (rawBefore !== null && !/^\d{1,15}$/.test(rawBefore)) {
    throw new HttpError(400, "invalid_request", "before must be a feed cursor");
  }
  if (rawLimit !== null && !/^\d{1,3}$/.test(rawLimit)) {
    throw new HttpError(400, "invalid_request", `limit must be 1..${FEED_PAGE_MAX}`);
  }
  const limit = rawLimit === null ? FEED_PAGE_DEFAULT : Number(rawLimit);
  if (limit < 1 || limit > FEED_PAGE_MAX) {
    throw new HttpError(400, "invalid_request", `limit must be 1..${FEED_PAGE_MAX}`);
  }
  return { before: rawBefore === null ? Number.MAX_SAFE_INTEGER : Number(rawBefore), limit };
}

/** Callers must have passed `requireMember` for this circle. Hidden, removed and blocked posts are left out. */
export async function readFeed(
  db: D1Database,
  viewerId: string,
  circleId: string,
  before: number,
  limit: number,
): Promise<Feed> {
  const { results } = await db
    .prepare(
      `${POST_SELECT}
       WHERE p.circle_id = ?2 AND p.status = 'visible' AND p.seq < ?3 AND ${NOT_BLOCKED("p.user_id")}
       ORDER BY p.seq DESC LIMIT ?4`,
    )
    .bind(viewerId, circleId, before, limit + 1)
    .all<PostRow>();
  const more = results.length > limit;
  const page = more ? results.slice(0, limit) : results;
  const last = page[page.length - 1];
  return {
    posts: await toViews(db, viewerId, page),
    nextBefore: more && last ? String(last.seq) : null,
  };
}

async function postById(db: D1Database, viewerId: string, postId: string): Promise<PostView> {
  const row = await db
    .prepare(`${POST_SELECT} WHERE p.id = ?2`)
    .bind(viewerId, postId)
    .first<PostRow>();
  if (!row) throw notFound();
  const [view] = await toViews(db, viewerId, [row]);
  return view as PostView;
}

/** A visible post of this circle by someone the viewer has no block with. Callers passed `requireMember`. */
export async function requireVisiblePost(
  db: D1Database,
  viewerId: string,
  circleId: string,
  postId: string,
): Promise<{ id: string; userId: string }> {
  const row = await db
    .prepare(
      `SELECT p.id, p.user_id FROM circle_post p
       WHERE p.id = ?2 AND p.circle_id = ?3 AND p.status = 'visible' AND ${NOT_BLOCKED("p.user_id")}`,
    )
    .bind(viewerId, postId, circleId)
    .first<{ id: string; user_id: string }>();
  if (!row) throw notFound();
  return { id: row.id, userId: row.user_id };
}

export async function createPost(
  db: D1Database,
  userId: string,
  circleId: string,
  input: PostInput,
  now: number,
): Promise<PostView> {
  const id = crypto.randomUUID();
  const kind = input.mediaId ? "voice" : "text";
  // The voice note must be this user's own upload for this circle and not yet used by another post.
  const insert = await db
    .prepare(
      `INSERT INTO circle_post (id, circle_id, user_id, kind, body, halaqah_day_id, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
       WHERE ?8 IS NULL OR EXISTS (
         SELECT 1 FROM circle_media
         WHERE id = ?8 AND circle_id = ?2 AND user_id = ?3 AND post_id IS NULL)`,
    )
    .bind(id, circleId, userId, kind, input.text, input.halaqahDayId, now, input.mediaId)
    .run();
  if (insert.meta.changes === 0) throw new HttpError(400, "invalid_request", "unknown mediaId");
  if (input.mediaId) {
    const attach = await db
      .prepare(
        "UPDATE circle_media SET post_id = ?1 WHERE id = ?2 AND user_id = ?3 AND post_id IS NULL",
      )
      .bind(id, input.mediaId, userId)
      .run();
    if (attach.meta.changes === 0) {
      await db.prepare("DELETE FROM circle_post WHERE id = ?1").bind(id).run();
      throw new HttpError(409, "media_already_used");
    }
  }
  return postById(db, userId, id);
}

export async function shareSummary(
  db: D1Database,
  userId: string,
  circleId: string,
  input: SummaryInput,
  now: number,
): Promise<PostView> {
  const { weekEnd, ...counts } = input;
  await db
    .prepare(
      `INSERT INTO circle_post (id, circle_id, user_id, kind, summary_json, week_end, created_at)
       VALUES (?1, ?2, ?3, 'summary', ?4, ?5, ?6)
       ON CONFLICT (circle_id, user_id, week_end) WHERE kind = 'summary' DO UPDATE SET
         summary_json = excluded.summary_json`,
    )
    .bind(
      crypto.randomUUID(),
      circleId,
      userId,
      JSON.stringify({ weekEnd, ...counts }),
      weekEnd,
      now,
    )
    .run();
  const row = await db
    .prepare(
      "SELECT id FROM circle_post WHERE circle_id = ?1 AND user_id = ?2 AND week_end = ?3 AND kind = 'summary'",
    )
    .bind(circleId, userId, weekEnd)
    .first<{ id: string }>();
  if (!row) throw new Error("summary vanished after upsert");
  return postById(db, userId, row.id);
}

/** Removes the author's own post and returns the R2 keys of its voice note, if any. */
export async function deleteOwnPost(
  db: D1Database,
  userId: string,
  circleId: string,
  postId: string,
): Promise<string[]> {
  const post = await db
    .prepare(
      "SELECT id FROM circle_post WHERE id = ?1 AND circle_id = ?2 AND user_id = ?3 AND status <> 'removed'",
    )
    .bind(postId, circleId, userId)
    .first();
  if (!post) throw notFound();
  return removePost(db, postId);
}

/** Marks a post removed, clears its content and drops its voice note row. Returns R2 keys to delete. */
export async function removePost(db: D1Database, postId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT r2_key FROM circle_media WHERE post_id = ?1")
    .bind(postId)
    .all<{ r2_key: string }>();
  await db.batch([
    db
      .prepare(
        "UPDATE circle_post SET status = 'removed', body = NULL, summary_json = NULL WHERE id = ?1",
      )
      .bind(postId),
    db.prepare("DELETE FROM circle_media WHERE post_id = ?1").bind(postId),
  ]);
  return results.map((r) => r.r2_key);
}

export interface ReactionState {
  reactions: Record<string, number>;
  myReaction: Reaction | null;
}

export async function setReaction(
  db: D1Database,
  userId: string,
  postId: string,
  emoji: Reaction | null,
  now: number,
): Promise<ReactionState> {
  if (emoji) {
    await db
      .prepare(
        `INSERT INTO circle_reaction (post_id, user_id, emoji, created_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (post_id, user_id) DO UPDATE SET emoji = excluded.emoji`,
      )
      .bind(postId, userId, emoji, now)
      .run();
  } else {
    await db
      .prepare("DELETE FROM circle_reaction WHERE post_id = ?1 AND user_id = ?2")
      .bind(postId, userId)
      .run();
  }
  const view = await postById(db, userId, postId);
  return { reactions: view.reactions, myReaction: view.myReaction };
}
