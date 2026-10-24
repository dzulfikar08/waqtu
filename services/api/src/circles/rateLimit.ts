import { RATE_LIMITS, type RateBucket } from "./constants";
import { HttpError } from "./http";

/**
 * Fixed-window counter per user and bucket, advanced by one atomic upsert so concurrent requests
 * cannot both slip under the limit. Requests over the limit still count, which is harmless.
 */
export async function enforceRate(
  db: D1Database,
  userId: string,
  bucket: RateBucket,
  now: number,
): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const row = await db
    .prepare(
      `INSERT INTO circle_rate (user_id, bucket, window_start, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (user_id, bucket) DO UPDATE SET
         count = CASE WHEN ?3 - window_start >= ?4 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ?3 - window_start >= ?4 THEN ?3 ELSE window_start END
       RETURNING count, window_start`,
    )
    .bind(userId, bucket, now, windowMs)
    .first<{ count: number; window_start: number }>();
  if (row && row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000));
    throw new HttpError(429, "rate_limited", undefined, { "retry-after": String(retryAfter) });
  }
}
