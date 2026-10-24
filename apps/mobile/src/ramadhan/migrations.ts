/**
 * Schema for the Ramadhan features; spread into `MIGRATIONS` in db/migrations.ts as one step.
 * Dates are "YYYY-MM-DD" civil dates in the user's zone.
 */
export const RAMADHAN_MIGRATION: readonly string[] = [
  `CREATE TABLE ramadhan_daily (
    date TEXT PRIMARY KEY NOT NULL,
    puasa INTEGER NOT NULL DEFAULT 0,
    tarawih INTEGER NOT NULL DEFAULT 0,
    tadarus INTEGER NOT NULL DEFAULT 0,
    itikaf INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE ramadhan_khatam (
    hijri_year INTEGER PRIMARY KEY NOT NULL,
    target INTEGER NOT NULL CHECK (target >= 1),
    start_date TEXT NOT NULL
  )`,
  `CREATE TABLE ramadhan_khatam_log (
    date TEXT PRIMARY KEY NOT NULL,
    pages INTEGER NOT NULL CHECK (pages >= 0)
  )`,
  `CREATE TABLE ramadhan_qadha (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('owed', 'made_up')),
    count INTEGER NOT NULL CHECK (count >= 1),
    date TEXT NOT NULL
  )`,
];
