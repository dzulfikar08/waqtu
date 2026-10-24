-- Waitlist signups from getwaqtu.com. One row per email (lowercased).
CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  platform TEXT CHECK (platform IN ('ios', 'android', 'mac')),
  city TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('id', 'en')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Rate limiting: one counter per salted IP hash per 10-minute window.
-- Rows older than the previous window are deleted on every request, so a hashed IP
-- is kept for at most 20 minutes.
CREATE TABLE waitlist_rate (
  ip_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, bucket)
) WITHOUT ROWID;
