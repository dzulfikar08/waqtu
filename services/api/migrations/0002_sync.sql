-- User-scoped sync data. Every row cascades away with its better-auth user.
CREATE TABLE sync_state (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  rev INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE mutabaah_entry (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  date TEXT NOT NULL,
  item_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, date, item_id)
);

CREATE TABLE app_setting (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE INDEX mutabaah_entry_user_rev_idx ON mutabaah_entry (user_id, rev);
CREATE INDEX app_setting_user_rev_idx ON app_setting (user_id, rev);
