import { HttpError, notFound } from "./http";
import { removePost } from "./posts";

/** `ADMIN_USER_IDS` is a comma-separated list of better-auth user ids. Empty or unset means nobody. */
export function isAdmin(adminIds: string | undefined, userId: string): boolean {
  return (adminIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

export function requireAdmin(adminIds: string | undefined, userId: string): void {
  if (!isAdmin(adminIds, userId)) throw new HttpError(403, "forbidden");
}

export interface QueuePost {
  id: string;
  circleId: string;
  authorUserId: string;
  authorHandle: string;
  kind: string;
  text: string | null;
  hidden: boolean;
  pendingReports: number;
  reasons: string[];
  createdAt: number;
}

export interface QueueUser {
  userId: string;
  handle: string;
  suspended: boolean;
  pendingReports: number;
  reasons: string[];
}

export interface ModerationQueue {
  posts: QueuePost[];
  users: QueueUser[];
}

const QUEUE_LIMIT = 100;

/** Posts with pending reports (hidden ones first) and users with pending user reports. */
export async function readQueue(db: D1Database): Promise<ModerationQueue> {
  const posts = await db
    .prepare(
      `SELECT p.id, p.circle_id, p.user_id, pr.handle, p.kind, p.body, p.status, p.created_at,
         COUNT(DISTINCT r.reporter_id) AS reports, GROUP_CONCAT(DISTINCT r.reason) AS reasons
       FROM circle_post p
       JOIN circle_report r ON r.post_id = p.id AND r.target = 'post' AND r.status = 'pending'
       JOIN circle_profile pr ON pr.user_id = p.user_id
       WHERE p.status IN ('visible', 'hidden')
       GROUP BY p.id
       ORDER BY (p.status = 'hidden') DESC, reports DESC, p.seq
       LIMIT ?1`,
    )
    .bind(QUEUE_LIMIT)
    .all<{
      id: string;
      circle_id: string;
      user_id: string;
      handle: string;
      kind: string;
      body: string | null;
      status: string;
      created_at: number;
      reports: number;
      reasons: string;
    }>();
  const users = await db
    .prepare(
      `SELECT r.reported_user_id AS user_id, pr.handle, pr.suspended_at,
         COUNT(DISTINCT r.reporter_id) AS reports, GROUP_CONCAT(DISTINCT r.reason) AS reasons
       FROM circle_report r
       JOIN circle_profile pr ON pr.user_id = r.reported_user_id
       WHERE r.target = 'user' AND r.status = 'pending'
       GROUP BY r.reported_user_id
       ORDER BY reports DESC
       LIMIT ?1`,
    )
    .bind(QUEUE_LIMIT)
    .all<{
      user_id: string;
      handle: string;
      suspended_at: number | null;
      reports: number;
      reasons: string;
    }>();
  return {
    posts: posts.results.map((r) => ({
      id: r.id,
      circleId: r.circle_id,
      authorUserId: r.user_id,
      authorHandle: r.handle,
      kind: r.kind,
      text: r.body,
      hidden: r.status === "hidden",
      pendingReports: r.reports,
      reasons: r.reasons.split(","),
      createdAt: r.created_at,
    })),
    users: users.results.map((r) => ({
      userId: r.user_id,
      handle: r.handle,
      suspended: r.suspended_at !== null,
      pendingReports: r.reports,
      reasons: r.reasons.split(","),
    })),
  };
}

/**
 * `hide` takes a post out of every feed while its reports stay pending, so it stays in the queue for a
 * final decision; `restore` shows it again (also the way to dismiss reports on a visible post) and
 * dismisses its reports (it takes three new reporters to hide it again; the earlier ones cannot report
 * it twice); `remove` deletes its content and its voice note. Returns R2 keys to delete.
 */
export async function resolvePost(
  db: D1Database,
  postId: string,
  action: "hide" | "restore" | "remove",
): Promise<string[]> {
  const post = await db
    .prepare("SELECT id FROM circle_post WHERE id = ?1 AND status <> 'removed'")
    .bind(postId)
    .first();
  if (!post) throw notFound();
  if (action === "hide") {
    await db.prepare("UPDATE circle_post SET status = 'hidden' WHERE id = ?1").bind(postId).run();
    return [];
  }
  if (action === "restore") {
    await db.batch([
      db.prepare("UPDATE circle_post SET status = 'visible' WHERE id = ?1").bind(postId),
      db
        .prepare(
          "UPDATE circle_report SET status = 'dismissed' WHERE post_id = ?1 AND target = 'post' AND status = 'pending'",
        )
        .bind(postId),
    ]);
    return [];
  }
  const keys = await removePost(db, postId);
  await db
    .prepare(
      "UPDATE circle_report SET status = 'actioned' WHERE post_id = ?1 AND target = 'post' AND status = 'pending'",
    )
    .bind(postId)
    .run();
  return keys;
}

/** `suspend` ends the user's circle access and memberships; `unsuspend` lifts it; `dismiss` closes the reports. */
export async function resolveUser(
  db: D1Database,
  userId: string,
  action: "suspend" | "unsuspend" | "dismiss",
  now: number,
): Promise<void> {
  const profile = await db
    .prepare("SELECT 1 AS hit FROM circle_profile WHERE user_id = ?1")
    .bind(userId)
    .first();
  if (!profile) throw notFound();
  const closeReports = (status: string) =>
    db
      .prepare(
        "UPDATE circle_report SET status = ?2 WHERE reported_user_id = ?1 AND target = 'user' AND status = 'pending'",
      )
      .bind(userId, status);
  if (action === "dismiss") {
    await closeReports("dismissed").run();
  } else if (action === "unsuspend") {
    await db
      .prepare("UPDATE circle_profile SET suspended_at = NULL, updated_at = ?2 WHERE user_id = ?1")
      .bind(userId, now)
      .run();
  } else {
    await db.batch([
      db
        .prepare("UPDATE circle_profile SET suspended_at = ?2, updated_at = ?2 WHERE user_id = ?1")
        .bind(userId, now),
      db
        .prepare(
          "UPDATE circle_member SET status = 'left', updated_at = ?2 WHERE user_id = ?1 AND status <> 'left'",
        )
        .bind(userId, now),
      closeReports("actioned"),
    ]);
  }
}
