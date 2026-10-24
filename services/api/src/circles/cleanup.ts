/** R2 accepts at most 1000 keys per delete call. */
const R2_BATCH = 1000;
const SWEEP_BATCH = 200;
const SWEEP_MAX_BATCHES = 25;

export const ORPHAN_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function deleteObjects(bucket: R2Bucket, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += R2_BATCH) {
    await bucket.delete(keys.slice(i, i + R2_BATCH));
  }
}

/**
 * Deletes every voice note object a user uploaded, posted or not. Runs before account deletion
 * cascades the circle_media rows away; if R2 fails the error propagates and the account is kept,
 * so a retry still finds the rows and no object is orphaned.
 */
export async function deleteUserMedia(
  env: { APP_DB: D1Database; CIRCLE_MEDIA: R2Bucket },
  userId: string,
): Promise<void> {
  const { results } = await env.APP_DB.prepare("SELECT r2_key FROM circle_media WHERE user_id = ?1")
    .bind(userId)
    .all<{ r2_key: string }>();
  await deleteObjects(
    env.CIRCLE_MEDIA,
    results.map((r) => r.r2_key),
  );
}

/**
 * Removes uploads that never became part of a post within 24 hours. Rows go first (guarded by
 * `post_id IS NULL`, so an upload that was just attached survives), then their objects. Returns how
 * many uploads were removed.
 */
export async function sweepOrphanUploads(
  env: { APP_DB: D1Database; CIRCLE_MEDIA: R2Bucket },
  now: number,
): Promise<number> {
  const cutoff = now - ORPHAN_UPLOAD_MAX_AGE_MS;
  let removed = 0;
  for (let batch = 0; batch < SWEEP_MAX_BATCHES; batch++) {
    const { results } = await env.APP_DB.prepare(
      `DELETE FROM circle_media WHERE id IN (
         SELECT id FROM circle_media WHERE post_id IS NULL AND created_at < ?1 LIMIT ?2)
         AND post_id IS NULL
       RETURNING r2_key`,
    )
      .bind(cutoff, SWEEP_BATCH)
      .all<{ r2_key: string }>();
    if (results.length === 0) break;
    await deleteObjects(
      env.CIRCLE_MEDIA,
      results.map((r) => r.r2_key),
    );
    removed += results.length;
    if (results.length < SWEEP_BATCH) break;
  }
  return removed;
}
