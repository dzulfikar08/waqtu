/**
 * The private muhasabah journal; spread into `MIGRATIONS` in db/migrations.ts as one step. Device-local: the sync engine
 * only reads `entries` and `settings`, so these rows never leave the phone.
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
