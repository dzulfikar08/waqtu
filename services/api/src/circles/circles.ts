import { MAX_MEMBERS, MAX_PRIVATE_CIRCLES, MAX_TZ_DISTANCE_HOURS, MIN_MEMBERS } from "./constants";
import { HttpError, notFound } from "./http";
import type { Profile } from "./profile";

export type MemberStatus = "active" | "paused";

export interface CircleView {
  id: string;
  kind: "public" | "private";
  name: string | null;
  memberCount: number;
  /** At least MIN_MEMBERS seats are taken. */
  ready: boolean;
  full: boolean;
  myStatus: MemberStatus;
  joinedAt: number;
  latestPostAt: number | null;
  /** Only members of a private circle see its code. */
  inviteCode: string | null;
}

interface CircleRow {
  id: string;
  kind: "public" | "private";
  name: string | null;
  invite_code: string | null;
  status: MemberStatus;
  joined_at: number;
  member_count: number;
  latest: number | null;
}

const toView = (r: CircleRow): CircleView => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  memberCount: r.member_count,
  ready: r.member_count >= MIN_MEMBERS,
  full: r.member_count >= MAX_MEMBERS,
  myStatus: r.status,
  joinedAt: r.joined_at,
  latestPostAt: r.latest,
  inviteCode: r.kind === "private" ? r.invite_code : null,
});

/**
 * Circles the user belongs to. The join on circle_profile.gender is the read-side gender wall: a
 * circle of the other gender never matches, whatever the membership table says.
 */
const MY_CIRCLES = `
  SELECT c.id, c.kind, c.name, c.invite_code, m.status, m.joined_at,
    (SELECT COUNT(*) FROM circle_member x
       WHERE x.circle_id = c.id AND x.status IN ('active', 'paused')) AS member_count,
    (SELECT MAX(p.created_at) FROM circle_post p
       WHERE p.circle_id = c.id AND p.status = 'visible') AS latest
  FROM circle_member m
  JOIN circle c ON c.id = m.circle_id
  JOIN circle_profile pr ON pr.user_id = m.user_id AND pr.gender = c.gender
  WHERE m.user_id = ?1 AND m.status IN ('active', 'paused')`;

export async function listMyCircles(db: D1Database, userId: string): Promise<CircleView[]> {
  const { results } = await db
    .prepare(`${MY_CIRCLES} ORDER BY m.joined_at, c.id`)
    .bind(userId)
    .all<CircleRow>();
  return results.map(toView);
}

/** Membership gate for every `/circles/:id/...` route. Anything the user may not see is a 404. */
export async function requireMember(
  db: D1Database,
  userId: string,
  circleId: string,
  opts: { active?: boolean } = {},
): Promise<CircleView> {
  const row = await db
    .prepare(`${MY_CIRCLES} AND c.id = ?2`)
    .bind(userId, circleId)
    .first<CircleRow>();
  if (!row) throw notFound();
  if (opts.active && row.status !== "active") throw new HttpError(409, "circle_paused");
  return toView(row);
}

const isUnique = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message);

/**
 * Takes a seat in one statement: the capacity check, the gender check and the insert cannot be
 * split by a concurrent join. Also revives a seat the user gave up earlier. False when the circle
 * is full, of the other gender, or the user already holds a seat.
 */
async function takeSeat(
  db: D1Database,
  circleId: string,
  userId: string,
  now: number,
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT INTO circle_member (circle_id, user_id, circle_kind, status, joined_at, updated_at)
       SELECT c.id, ?2, c.kind, 'active', ?3, ?3 FROM circle c
       WHERE c.id = ?1
         AND c.gender = (SELECT gender FROM circle_profile WHERE user_id = ?2)
         AND (SELECT COUNT(*) FROM circle_member
                WHERE circle_id = c.id AND status IN ('active', 'paused')) < ?4
       ON CONFLICT (circle_id, user_id) DO UPDATE SET
         status = 'active', joined_at = excluded.joined_at, updated_at = excluded.updated_at
       WHERE circle_member.status = 'left'`,
    )
    .bind(circleId, userId, now, MAX_MEMBERS)
    .run();
  return res.meta.changes > 0;
}

async function viewOf(db: D1Database, userId: string, circleId: string): Promise<CircleView> {
  return requireMember(db, userId, circleId);
}

async function currentPublic(db: D1Database, userId: string): Promise<CircleView | null> {
  const row = await db
    .prepare(`${MY_CIRCLES} AND c.kind = 'public'`)
    .bind(userId)
    .first<CircleRow>();
  return row ? toView(row) : null;
}

export interface JoinResult {
  circle: CircleView;
  /** A new circle was opened because no existing one fit. */
  created: boolean;
  /** The user already had this circle; nothing changed. */
  alreadyMember: boolean;
}

const CANDIDATES = `
  SELECT c.id, COUNT(m.user_id) AS seats FROM circle c
  JOIN circle_member m ON m.circle_id = c.id AND m.status IN ('active', 'paused')
  WHERE c.kind = 'public' AND c.gender = ?1 AND c.language = ?2
    AND ABS(c.tz_offset_hours - ?3) <= ?4
    AND NOT EXISTS (SELECT 1 FROM circle_member mine WHERE mine.circle_id = c.id AND mine.user_id = ?5)
    AND NOT EXISTS (
      SELECT 1 FROM circle_member other
      JOIN circle_block b ON (b.blocker_id = ?5 AND b.blocked_id = other.user_id)
                          OR (b.blocker_id = other.user_id AND b.blocked_id = ?5)
      WHERE other.circle_id = c.id AND other.status IN ('active', 'paused'))
  GROUP BY c.id HAVING seats < ?6
  ORDER BY seats DESC, c.created_at, c.id
  LIMIT 5`;

/**
 * Public auto-match. Same gender and language, UTC offset within MAX_TZ_DISTANCE_HOURS, no block
 * either way with any member, never a circle the user already left. Picks the fullest open circle
 * so circles fill toward MAX_MEMBERS; opens a new one when none fits.
 */
export async function joinPublic(
  db: D1Database,
  userId: string,
  profile: Profile,
  now: number,
): Promise<JoinResult> {
  const mine = await currentPublic(db, userId);
  if (mine) return { circle: mine, created: false, alreadyMember: true };

  try {
    const { results } = await db
      .prepare(CANDIDATES)
      .bind(
        profile.gender,
        profile.language,
        profile.tzOffsetHours,
        MAX_TZ_DISTANCE_HOURS,
        userId,
        MAX_MEMBERS,
      )
      .all<{ id: string }>();
    for (const candidate of results) {
      if (await takeSeat(db, candidate.id, userId, now)) {
        return {
          circle: await viewOf(db, userId, candidate.id),
          created: false,
          alreadyMember: false,
        };
      }
    }

    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO circle (id, kind, gender, language, tz_offset_hours, created_by, created_at)
           VALUES (?1, 'public', ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(id, profile.gender, profile.language, profile.tzOffsetHours, userId, now),
      db
        .prepare(
          `INSERT INTO circle_member (circle_id, user_id, circle_kind, status, joined_at, updated_at)
           VALUES (?1, ?2, 'public', 'active', ?3, ?3)`,
        )
        .bind(id, userId, now),
    ]);
    return { circle: await viewOf(db, userId, id), created: true, alreadyMember: false };
  } catch (e) {
    // A concurrent join won the one-public-circle index; report that circle instead.
    if (isUnique(e)) {
      const won = await currentPublic(db, userId);
      if (won) return { circle: won, created: false, alreadyMember: true };
    }
    throw e;
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function privateCount(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM circle_member
       WHERE user_id = ?1 AND circle_kind = 'private' AND status IN ('active', 'paused')`,
    )
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createPrivate(
  db: D1Database,
  userId: string,
  profile: Profile,
  name: string | null,
  now: number,
): Promise<CircleView> {
  if ((await privateCount(db, userId)) >= MAX_PRIVATE_CIRCLES) {
    throw new HttpError(409, "too_many_private_circles");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = crypto.randomUUID();
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO circle (id, kind, gender, language, tz_offset_hours, name, invite_code, created_by, created_at)
             VALUES (?1, 'private', ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
          )
          .bind(
            id,
            profile.gender,
            profile.language,
            profile.tzOffsetHours,
            name,
            newInviteCode(),
            userId,
            now,
          ),
        db
          .prepare(
            `INSERT INTO circle_member (circle_id, user_id, circle_kind, status, joined_at, updated_at)
             VALUES (?1, ?2, 'private', 'active', ?3, ?3)`,
          )
          .bind(id, userId, now),
      ]);
      return await viewOf(db, userId, id);
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  throw new HttpError(503, "try_again");
}

/**
 * Joins a private circle by invite code. A code that does not exist and a code for a circle of the
 * other gender look the same: 404.
 */
export async function joinPrivate(
  db: D1Database,
  userId: string,
  profile: Profile,
  code: string,
  now: number,
): Promise<JoinResult> {
  const circle = await db
    .prepare("SELECT id FROM circle WHERE invite_code = ?1 AND gender = ?2")
    .bind(code, profile.gender)
    .first<{ id: string }>();
  if (!circle) throw notFound();

  const held = await db
    .prepare(`SELECT status FROM circle_member WHERE circle_id = ?1 AND user_id = ?2`)
    .bind(circle.id, userId)
    .first<{ status: string }>();
  if (held && held.status !== "left") {
    return { circle: await viewOf(db, userId, circle.id), created: false, alreadyMember: true };
  }
  if ((await privateCount(db, userId)) >= MAX_PRIVATE_CIRCLES) {
    throw new HttpError(409, "too_many_private_circles");
  }
  const blocked = await db
    .prepare(
      `SELECT 1 AS hit FROM circle_member other
       JOIN circle_block b ON (b.blocker_id = ?2 AND b.blocked_id = other.user_id)
                           OR (b.blocker_id = other.user_id AND b.blocked_id = ?2)
       WHERE other.circle_id = ?1 AND other.status IN ('active', 'paused') LIMIT 1`,
    )
    .bind(circle.id, userId)
    .first();
  if (blocked) throw notFound();

  if (!(await takeSeat(db, circle.id, userId, now))) throw new HttpError(409, "circle_full");
  return { circle: await viewOf(db, userId, circle.id), created: false, alreadyMember: false };
}

type Change = "pause" | "resume" | "leave";

const TRANSITIONS: Record<Change, { to: "paused" | "active" | "left"; from: string }> = {
  pause: { to: "paused", from: "('active')" },
  resume: { to: "active", from: "('paused')" },
  leave: { to: "left", from: "('active', 'paused')" },
};

/**
 * Pause, resume or leave. Silent by construction: it touches only the caller's own membership row,
 * so no one else gets an event, a notification or a changed feed. Repeating a change is a no-op.
 */
export async function changeMembership(
  db: D1Database,
  userId: string,
  circleId: string,
  change: Change,
  now: number,
): Promise<{ status: "active" | "paused" | "left" }> {
  const row = await db
    .prepare("SELECT status FROM circle_member WHERE circle_id = ?1 AND user_id = ?2")
    .bind(circleId, userId)
    .first<{ status: "active" | "paused" | "left" }>();
  if (!row) throw notFound();
  const { to, from } = TRANSITIONS[change];
  if (row.status === "left" && change !== "leave") throw notFound();
  await db
    .prepare(
      `UPDATE circle_member SET status = ?3, updated_at = ?4
       WHERE circle_id = ?1 AND user_id = ?2 AND status IN ${from}`,
    )
    .bind(circleId, userId, to, now)
    .run();
  return { status: to };
}
