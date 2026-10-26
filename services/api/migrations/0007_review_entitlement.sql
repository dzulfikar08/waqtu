-- Store reviewer accounts (Google Play, App Store) get Premium from a `review` entitlement row, written
-- only by .github/workflows/review-account.yml. SQLite cannot change a CHECK in place, so the table is
-- rebuilt with 'review' allowed; 'license' goes (0005 deleted those rows and no code writes it).
-- Nothing references `entitlement`, so dropping the old table cascades nowhere.
CREATE TABLE entitlement_new (
  source TEXT NOT NULL CHECK (source IN ('apple', 'google', 'polar', 'review')),
  external_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  product_id TEXT,
  environment TEXT,
  expires_at INTEGER,
  order_id TEXT,
  revoked_at INTEGER,
  signed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, external_id)
);

INSERT INTO entitlement_new
  (source, external_id, user_id, product_id, environment, expires_at, order_id, revoked_at, signed_at, created_at, updated_at)
SELECT source, external_id, user_id, product_id, environment, expires_at, order_id, revoked_at, signed_at, created_at, updated_at
FROM entitlement
WHERE source IN ('apple', 'google', 'polar');

DROP TABLE entitlement;
ALTER TABLE entitlement_new RENAME TO entitlement;
CREATE INDEX entitlement_user_idx ON entitlement (user_id);
