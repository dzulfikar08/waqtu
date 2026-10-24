import { AUTO_HIDE_REPORTS } from "./constants";
import { badRequest, notFound } from "./http";
import { requireVisiblePost } from "./posts";
import type { ReportInput } from "./validate";

/**
 * Files a report against a post or its author. Repeating the same report changes nothing. When
 * AUTO_HIDE_REPORTS distinct members have a post report pending, the post is hidden for everyone
 * in the same batch until an admin reviews it.
 */
export async function reportPost(
  db: D1Database,
  reporterId: string,
  circleId: string,
  postId: string,
  input: ReportInput,
  now: number,
): Promise<void> {
  const post = await requireVisiblePost(db, reporterId, circleId, postId);
  if (post.userId === reporterId) throw badRequest("you cannot report your own post");
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO circle_report
           (id, circle_id, reporter_id, post_id, reported_user_id, target, reason, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(
        crypto.randomUUID(),
        circleId,
        reporterId,
        post.id,
        post.userId,
        input.target,
        input.reason,
        input.note,
        now,
      ),
    db
      .prepare(
        `UPDATE circle_post SET status = 'hidden'
         WHERE id = ?1 AND status = 'visible' AND (
           SELECT COUNT(DISTINCT reporter_id) FROM circle_report
           WHERE post_id = ?1 AND target = 'post' AND status = 'pending') >= ?2`,
      )
      .bind(post.id, AUTO_HIDE_REPORTS),
  ]);
}

export interface BlockView {
  id: string;
  handle: string;
  createdAt: number;
}

/** Blocks the author of a post the caller can see. Hidden both ways from then on. */
export async function blockAuthor(
  db: D1Database,
  blockerId: string,
  circleId: string,
  postId: string,
  now: number,
): Promise<BlockView> {
  const post = await requireVisiblePost(db, blockerId, circleId, postId);
  if (post.userId === blockerId) throw badRequest("you cannot block yourself");
  await db
    .prepare(
      "INSERT OR IGNORE INTO circle_block (id, blocker_id, blocked_id, created_at) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(crypto.randomUUID(), blockerId, post.userId, now)
    .run();
  const row = await db
    .prepare(
      `SELECT b.id, pr.handle, b.created_at FROM circle_block b
       JOIN circle_profile pr ON pr.user_id = b.blocked_id
       WHERE b.blocker_id = ?1 AND b.blocked_id = ?2`,
    )
    .bind(blockerId, post.userId)
    .first<{ id: string; handle: string; created_at: number }>();
  if (!row) throw notFound();
  return { id: row.id, handle: row.handle, createdAt: row.created_at };
}

export async function listBlocks(db: D1Database, userId: string): Promise<BlockView[]> {
  const { results } = await db
    .prepare(
      `SELECT b.id, pr.handle, b.created_at FROM circle_block b
       JOIN circle_profile pr ON pr.user_id = b.blocked_id
       WHERE b.blocker_id = ?1 ORDER BY b.created_at DESC`,
    )
    .bind(userId)
    .all<{ id: string; handle: string; created_at: number }>();
  return results.map((r) => ({ id: r.id, handle: r.handle, createdAt: r.created_at }));
}

export async function unblock(db: D1Database, userId: string, blockId: string): Promise<void> {
  const res = await db
    .prepare("DELETE FROM circle_block WHERE id = ?1 AND blocker_id = ?2")
    .bind(blockId, userId)
    .run();
  if (res.meta.changes === 0) throw notFound();
}
