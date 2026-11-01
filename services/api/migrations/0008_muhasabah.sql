-- Opt-in cloud copy of the muhasabah journal (a user turns on "Sync muhasabah to the cloud" in the apps;
-- the journal is on-device otherwise). One row per user and day, whole entry last-write-wins. `data` is
-- the entry as canonical JSON, or '' for a deleted day (a tombstone, so deletions reach other devices).
-- Rows cascade away with the better-auth user, and DELETE /v1/muhasabah clears them on request.
CREATE TABLE muhasabah_state (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  rev INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE muhasabah_entry (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  date TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX muhasabah_entry_user_rev_idx ON muhasabah_entry (user_id, rev);
