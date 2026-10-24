export type EntitlementSource = "apple" | "google" | "polar" | "license";

export interface EntitlementRow {
  source: EntitlementSource;
  /** Epoch ms the paid period ends; null = lifetime. */
  expires_at: number | null;
}

/** What GET /v1/entitlement returns. */
export interface EntitlementView {
  premium: boolean;
  /**
   * The source that grants premium now (lifetime first, then the latest expiry). When not premium it
   * is the source of the most recent lapsed period, or null when the user never held premium.
   */
  source: EntitlementSource | null;
  /** ISO time premium ends; null for lifetime premium and for users who never held premium. */
  expiresAt: string | null;
}

/** Lifetime outranks any dated period; among dated periods the later one wins. */
const reach = (row: EntitlementRow): number => row.expires_at ?? Number.POSITIVE_INFINITY;

/**
 * Resolves a user's premium status from every entitlement row they hold. Sources are independent:
 * a Mac lifetime key keeps premium forever no matter what happens to a store subscription, and a
 * subscription bought on another platform keeps working alongside it.
 */
export function resolveEntitlement(rows: readonly EntitlementRow[], now: number): EntitlementView {
  let best: EntitlementRow | null = null;
  for (const row of rows) {
    if (best === null || reach(row) > reach(best)) best = row;
  }
  if (best === null) return { premium: false, source: null, expiresAt: null };
  const premium = best.expires_at === null || best.expires_at > now;
  return {
    premium,
    source: best.source,
    expiresAt: best.expires_at === null ? null : new Date(best.expires_at).toISOString(),
  };
}

export async function readEntitlement(
  db: D1Database,
  userId: string,
  now: number,
): Promise<EntitlementView> {
  const { results } = await db
    .prepare("SELECT source, expires_at FROM entitlement WHERE user_id = ?1")
    .bind(userId)
    .all<EntitlementRow>();
  return resolveEntitlement(results, now);
}

export interface EntitlementWrite {
  userId: string;
  source: EntitlementSource;
  /** Stable id of the subscription at its source (Apple original transaction id, Play token, ...). */
  externalId: string;
  productId: string | null;
  environment: "production" | "sandbox" | null;
  expiresAt: number | null;
  orderId?: string | null;
  revokedAt?: number | null;
  /** When the source produced this state (store signing time, event time, or now for a live read). */
  signedAt: number;
}

export type WriteOutcome = "applied" | "stale" | "other-account";

/**
 * Records one subscription state. One statement, so concurrent writers cannot interleave: the row
 * changes only for its owner and only when `signedAt` is not older than what it already holds.
 * A subscription already held by another user is refused (first account wins).
 */
export async function writeEntitlement(
  db: D1Database,
  write: EntitlementWrite,
  now: number,
): Promise<WriteOutcome> {
  const result = await db
    .prepare(
      `INSERT INTO entitlement
         (source, external_id, user_id, product_id, environment, expires_at, order_id, revoked_at, signed_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
       ON CONFLICT (source, external_id) DO UPDATE SET
         product_id = excluded.product_id,
         environment = excluded.environment,
         expires_at = excluded.expires_at,
         order_id = excluded.order_id,
         revoked_at = excluded.revoked_at,
         signed_at = excluded.signed_at,
         updated_at = excluded.updated_at
       WHERE entitlement.user_id = excluded.user_id AND entitlement.signed_at <= excluded.signed_at`,
    )
    .bind(
      write.source,
      write.externalId,
      write.userId,
      write.productId,
      write.environment,
      write.expiresAt,
      write.orderId ?? null,
      write.revokedAt ?? null,
      write.signedAt,
      now,
    )
    .run();
  if (result.meta.changes > 0) return "applied";
  const owner = await db
    .prepare("SELECT user_id FROM entitlement WHERE source = ?1 AND external_id = ?2")
    .bind(write.source, write.externalId)
    .first<{ user_id: string }>();
  return owner && owner.user_id !== write.userId ? "other-account" : "stale";
}

export interface StoredEntitlement {
  user_id: string;
  product_id: string | null;
  expires_at: number | null;
  order_id: string | null;
  revoked_at: number | null;
}

export function findEntitlement(
  db: D1Database,
  source: EntitlementSource,
  externalId: string,
): Promise<StoredEntitlement | null> {
  return db
    .prepare(
      "SELECT user_id, product_id, expires_at, order_id, revoked_at FROM entitlement WHERE source = ?1 AND external_id = ?2",
    )
    .bind(source, externalId)
    .first<StoredEntitlement>();
}

export async function userExists(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS ok FROM "user" WHERE id = ?1').bind(userId).first();
  return row !== null;
}
