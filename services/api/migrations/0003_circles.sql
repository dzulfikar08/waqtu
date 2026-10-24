-- Circles: small, public or private, gender-separated reflection groups. No DMs, no location.
-- Every row cascades away with its better-auth user. Gender isolation is enforced twice: by the
-- queries in src/circles and here, by triggers that make a cross-gender membership impossible.

CREATE TABLE circle_profile (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  handle TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('ikhwan', 'akhwat')),
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  -- Whole hours from UTC (WIB = 7). A coarse bucket, never a location.
  tz_offset_hours INTEGER NOT NULL CHECK (tz_offset_hours BETWEEN -12 AND 14),
  summary_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (summary_opt_in IN (0, 1)),
  suspended_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX circle_profile_handle_idx ON circle_profile (handle COLLATE NOCASE);

CREATE TABLE circle (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('public', 'private')),
  gender TEXT NOT NULL CHECK (gender IN ('ikhwan', 'akhwat')),
  language TEXT NOT NULL CHECK (language IN ('id', 'en')),
  tz_offset_hours INTEGER NOT NULL CHECK (tz_offset_hours BETWEEN -12 AND 14),
  name TEXT,
  invite_code TEXT UNIQUE,
  created_by TEXT REFERENCES "user" ("id") ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'private') = (invite_code IS NOT NULL))
);

CREATE INDEX circle_match_idx ON circle (kind, gender, language);

CREATE TABLE circle_member (
  circle_id TEXT NOT NULL REFERENCES circle (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  circle_kind TEXT NOT NULL CHECK (circle_kind IN ('public', 'private')),
  -- A paused member keeps the seat; a member who left has none. Nobody else is told either way.
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'left')),
  joined_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (circle_id, user_id)
);

CREATE INDEX circle_member_user_idx ON circle_member (user_id, status);
-- At most one public circle per person at a time, even under concurrent joins.
CREATE UNIQUE INDEX circle_member_one_public_idx ON circle_member (user_id)
  WHERE circle_kind = 'public' AND status IN ('active', 'paused');

CREATE TRIGGER circle_member_same_gender BEFORE INSERT ON circle_member
WHEN (SELECT gender FROM circle WHERE id = NEW.circle_id)
  IS NOT (SELECT gender FROM circle_profile WHERE user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'gender_mismatch');
END;

CREATE TRIGGER circle_profile_gender_locked BEFORE UPDATE OF gender ON circle_profile
WHEN OLD.gender IS NOT NEW.gender
BEGIN
  SELECT RAISE(ABORT, 'gender_locked');
END;

CREATE TABLE circle_post (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  circle_id TEXT NOT NULL REFERENCES circle (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'voice', 'summary')),
  body TEXT,
  halaqah_day_id TEXT,
  summary_json TEXT,
  week_end TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  created_at INTEGER NOT NULL
);

CREATE INDEX circle_post_feed_idx ON circle_post (circle_id, seq);
CREATE INDEX circle_post_user_idx ON circle_post (user_id);
-- One shared summary per person, circle and week; sharing again replaces it.
CREATE UNIQUE INDEX circle_post_summary_idx ON circle_post (circle_id, user_id, week_end)
  WHERE kind = 'summary';

CREATE TABLE circle_media (
  id TEXT NOT NULL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circle (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  post_id TEXT REFERENCES circle_post (id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX circle_media_post_idx ON circle_media (post_id);

CREATE TABLE circle_reaction (
  post_id TEXT NOT NULL REFERENCES circle_post (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE circle_block (
  id TEXT NOT NULL PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX circle_block_blocked_idx ON circle_block (blocked_id);

CREATE TABLE circle_report (
  id TEXT NOT NULL PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circle (id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES circle_post (id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('post', 'user')),
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'actioned', 'dismissed')),
  created_at INTEGER NOT NULL,
  UNIQUE (reporter_id, post_id, target)
);

CREATE INDEX circle_report_post_idx ON circle_report (post_id, status);
CREATE INDEX circle_report_user_idx ON circle_report (reported_user_id, status);

-- Fixed-window counters for per-user rate limits.
CREATE TABLE circle_rate (
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, bucket)
);
