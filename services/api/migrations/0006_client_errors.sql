-- Anonymous crash and error reports from the phone app (POST /v1/errors). On purpose there is no user
-- id, no location and no IP address: only what the app itself was running and what went wrong.
-- Rows older than 90 days are deleted by the hourly cron.
CREATE TABLE client_error (
  id TEXT NOT NULL PRIMARY KEY,
  received_at INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version TEXT NOT NULL,
  build_number TEXT,
  runtime_version TEXT,
  update_id TEXT,
  channel TEXT,
  fatal INTEGER NOT NULL CHECK (fatal IN (0, 1)),
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  -- First stack frame, derived on the server; the admin view groups by message + top frame.
  top_frame TEXT NOT NULL,
  screen TEXT,
  -- How many times the app saw this same error before sending it (repeats are folded on the phone).
  count INTEGER NOT NULL CHECK (count >= 1)
);

CREATE INDEX client_error_received_idx ON client_error (received_at);

-- Rate limiting for the unauthenticated endpoint: one counter per keyed IP hash per minute. Rows
-- older than the previous window are deleted on every request, so a hash is kept for two minutes.
CREATE TABLE client_error_rate (
  ip_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, bucket)
) WITHOUT ROWID;
