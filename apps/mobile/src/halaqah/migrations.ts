/**
 * Schema for the halaqah program; spread into `MIGRATIONS` in db/migrations.ts as one step.
 * Both tables are device-local: reflections are private and never leave the phone, and completion
 * reaches the account only through the `halaqah` mutabaah entry.
 */
export const HALAQAH_MIGRATION: readonly string[] = [
  // One row per completed program day; `completed_on` is the civil day (user's zone) it was marked.
  `CREATE TABLE halaqah_progress (
    program_id TEXT NOT NULL,
    day INTEGER NOT NULL CHECK (day >= 1),
    completed_on TEXT NOT NULL,
    PRIMARY KEY (program_id, day)
  )`,
  `CREATE TABLE halaqah_reflection (
    program_id TEXT NOT NULL,
    day INTEGER NOT NULL CHECK (day >= 1),
    body TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (program_id, day)
  )`,
];

/**
 * Private voice reflections: one recording per program day, a file in the app's private
 * `halaqah` folder (see recordings.ts). Device-local like the text reflection; a recording reaches
 * the server only when the user shares it to a circle, as an ordinary circle voice note.
 */
export const HALAQAH_VOICE_MIGRATION: readonly string[] = [
  `CREATE TABLE halaqah_voice (
    program_id TEXT NOT NULL,
    day INTEGER NOT NULL CHECK (day >= 1),
    file TEXT NOT NULL,
    seconds INTEGER NOT NULL CHECK (seconds >= 1),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (program_id, day)
  )`,
];
