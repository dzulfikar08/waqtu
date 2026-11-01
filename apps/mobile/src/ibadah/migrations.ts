/**
 * The private muhasabah journal; one step in `MIGRATIONS` (db/migrations.ts). Device-local by default: the mutabaah sync
 * engine only reads `entries` and `settings`, and rows leave the phone only through the opt-in cloud sync (cloud.ts).
 */
export const MUHASABAH_MIGRATION: readonly string[] = [
  `CREATE TABLE muhasabah (
    date TEXT PRIMARY KEY NOT NULL,
    feelings TEXT,
    new_action TEXT,
    taqwa INTEGER CHECK (taqwa BETWEEN 1 AND 10),
    gratitude INTEGER CHECK (gratitude BETWEEN 1 AND 10),
    energy INTEGER CHECK (energy BETWEEN 1 AND 10),
    willingness INTEGER CHECK (willingness BETWEEN 1 AND 10),
    continue_tomorrow TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
];

/**
 * Cloud sync bookkeeping for the journal. `dirty` marks days the server has not seen; `deleted` is a tombstone (the
 * day's fields stay null) so a deletion reaches other devices. Existing rows start dirty so opting in uploads them.
 */
export const MUHASABAH_CLOUD_MIGRATION: readonly string[] = [
  "ALTER TABLE muhasabah ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE muhasabah ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
];
