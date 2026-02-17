-- D1 schema for Waqtu Sparkle releases
-- Run once: wrangler d1 execute waqt-releases-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS releases (
  version INTEGER PRIMARY KEY,
  short_version_string TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  enclosure_url TEXT NOT NULL,
  ed_signature TEXT NOT NULL,
  length INTEGER NOT NULL,
  pub_date TEXT NOT NULL
);

-- Example (do not run in production; use release script to insert):
-- INSERT INTO releases (version, short_version_string, title, description, enclosure_url, ed_signature, length, pub_date)
-- VALUES (1, '1.0.0', 'Waqtu 1.0.0', 'Initial release.', 'https://your-r2.dev/Waqtu-1.0.0.dmg', 'SIGNATURE', 12345678, '2025-02-16T00:00:00.000Z');
