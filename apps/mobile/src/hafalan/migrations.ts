/**
 * Schema for hafalan (memorisation) plans; spread into `MIGRATIONS` in db/migrations.ts as one step.
 * Everything here is device-local, recordings included. Only the `murojaah` mutabaah entry syncs.
 */
export const HAFALAN_MIGRATION: readonly string[] = [
  // The one active plan (id is always 1). `from_n`/`to_n` are surah, juz or page numbers by `kind`.
  `CREATE TABLE hafalan_plan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    kind TEXT NOT NULL CHECK (kind IN ('surah', 'juz', 'pages')),
    from_n INTEGER NOT NULL,
    to_n INTEGER NOT NULL,
    start_day TEXT NOT NULL,
    deadline TEXT NOT NULL,
    max_review INTEGER NOT NULL CHECK (max_review >= 1),
    created_at INTEGER NOT NULL
  )`,
  // Scheduler state of a unit; a unit without a row is new. `unit` is the index within the plan.
  `CREATE TABLE hafalan_unit (
    unit INTEGER PRIMARY KEY,
    ease REAL NOT NULL,
    interval_days INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    due TEXT,
    learned_on TEXT,
    last_on TEXT,
    last_grade INTEGER CHECK (last_grade BETWEEN 0 AND 5)
  )`,
  // The latest self-listen recording of a unit; `file` is a name inside the app's private hafalan folder.
  `CREATE TABLE hafalan_recording (
    unit INTEGER PRIMARY KEY,
    file TEXT NOT NULL,
    seconds INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
];
