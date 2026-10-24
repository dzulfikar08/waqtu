import type { Entry, Setting } from "./validate";

interface SettingRow {
  key: string;
  value: string;
  updatedAt: number;
}

/** Merge duplicate keys inside one request with the same last-write-wins rule used by the store. */
export function mergeEntries(entries: Entry[]): Entry[] {
  const merged = new Map<string, Entry>();
  for (const e of entries) {
    const k = `${e.date}\u0000${e.itemId}`;
    const cur = merged.get(k);
    if (
      !cur ||
      e.updatedAt > cur.updatedAt ||
      (e.updatedAt === cur.updatedAt && e.value > cur.value)
    ) {
      merged.set(k, e);
    }
  }
  return [...merged.values()];
}

export function mergeSettings(settings: Setting[]): Setting[] {
  const merged = new Map<string, Setting>();
  for (const s of settings) {
    const cur = merged.get(s.key);
    if (
      !cur ||
      s.updatedAt > cur.updatedAt ||
      (s.updatedAt === cur.updatedAt && s.value > cur.value)
    ) {
      merged.set(s.key, s);
    }
  }
  return [...merged.values()];
}

/**
 * Applies the writes atomically in one D1 batch. For each row, a counter bump that only fires when
 * the row would win, followed by the upsert stamped with the bumped counter. A losing or identical
 * row changes nothing, so the revision only advances on real writes and every applied row gets a
 * unique, increasing rev.
 */
export async function applyWrites(
  db: D1Database,
  userId: string,
  rawEntries: Entry[],
  rawSettings: Setting[],
): Promise<{ applied: { entries: number; settings: number }; cursor: string }> {
  const entries = mergeEntries(rawEntries);
  const settings = mergeSettings(rawSettings);

  const stmts: D1PreparedStatement[] = [
    db.prepare("INSERT OR IGNORE INTO sync_state (user_id, rev) VALUES (?1, 0)").bind(userId),
  ];

  for (const e of entries) {
    stmts.push(
      db
        .prepare(
          `UPDATE sync_state SET rev = rev + 1
           WHERE user_id = ?1 AND NOT EXISTS (
             SELECT 1 FROM mutabaah_entry
             WHERE user_id = ?1 AND date = ?2 AND item_id = ?3
               AND NOT (?5 > updated_at OR (?5 = updated_at AND ?4 > value)))`,
        )
        .bind(userId, e.date, e.itemId, e.value, e.updatedAt),
      db
        .prepare(
          `INSERT INTO mutabaah_entry (user_id, date, item_id, value, updated_at, rev)
           SELECT ?1, ?2, ?3, ?4, ?5, rev FROM sync_state WHERE user_id = ?1
           ON CONFLICT (user_id, date, item_id) DO UPDATE SET
             value = excluded.value, updated_at = excluded.updated_at, rev = excluded.rev
           WHERE excluded.updated_at > mutabaah_entry.updated_at
              OR (excluded.updated_at = mutabaah_entry.updated_at AND excluded.value > mutabaah_entry.value)`,
        )
        .bind(userId, e.date, e.itemId, e.value, e.updatedAt),
    );
  }

  for (const s of settings) {
    stmts.push(
      db
        .prepare(
          `UPDATE sync_state SET rev = rev + 1
           WHERE user_id = ?1 AND NOT EXISTS (
             SELECT 1 FROM app_setting
             WHERE user_id = ?1 AND key = ?2
               AND NOT (?4 > updated_at OR (?4 = updated_at AND ?3 > value)))`,
        )
        .bind(userId, s.key, s.value, s.updatedAt),
      db
        .prepare(
          `INSERT INTO app_setting (user_id, key, value, updated_at, rev)
           SELECT ?1, ?2, ?3, ?4, rev FROM sync_state WHERE user_id = ?1
           ON CONFLICT (user_id, key) DO UPDATE SET
             value = excluded.value, updated_at = excluded.updated_at, rev = excluded.rev
           WHERE excluded.updated_at > app_setting.updated_at
              OR (excluded.updated_at = app_setting.updated_at AND excluded.value > app_setting.value)`,
        )
        .bind(userId, s.key, s.value, s.updatedAt),
    );
  }

  stmts.push(db.prepare("SELECT rev FROM sync_state WHERE user_id = ?1").bind(userId));

  const results = await db.batch(stmts);
  let appliedEntries = 0;
  let appliedSettings = 0;
  for (let i = 0; i < entries.length; i++) {
    appliedEntries += results[1 + i * 2]!.meta.changes;
  }
  for (let i = 0; i < settings.length; i++) {
    appliedSettings += results[1 + entries.length * 2 + i * 2]!.meta.changes;
  }
  const rev = (results[results.length - 1]!.results[0] as { rev: number }).rev;
  return { applied: { entries: appliedEntries, settings: appliedSettings }, cursor: String(rev) };
}

export async function readChanges(
  db: D1Database,
  userId: string,
  since: number,
  limit: number,
): Promise<{
  entries: Entry[];
  settings: SettingRow[];
  cursor: string;
  hasMore: boolean;
}> {
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT 'e' AS kind, date AS a, item_id AS b, value AS v, updated_at, rev
           FROM mutabaah_entry WHERE user_id = ?1 AND rev > ?2
         UNION ALL
         SELECT 's' AS kind, key AS a, NULL AS b, value AS v, updated_at, rev
           FROM app_setting WHERE user_id = ?1 AND rev > ?2
       ) ORDER BY rev ASC LIMIT ?3`,
    )
    .bind(userId, since, limit + 1)
    .all<{
      kind: "e" | "s";
      a: string;
      b: string | null;
      v: number | string;
      updated_at: number;
      rev: number;
    }>();

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  const entries: Entry[] = [];
  const settings: SettingRow[] = [];
  for (const r of page) {
    if (r.kind === "e") {
      entries.push({
        date: r.a,
        itemId: r.b as string,
        value: r.v as number,
        updatedAt: r.updated_at,
      });
    } else {
      settings.push({ key: r.a, value: r.v as string, updatedAt: r.updated_at });
    }
  }
  const last = page[page.length - 1];
  return { entries, settings, cursor: String(last ? last.rev : since), hasMore };
}
