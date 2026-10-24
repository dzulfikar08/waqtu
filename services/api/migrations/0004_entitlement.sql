-- Premium entitlements: one row per store subscription (or lifetime license) a user holds.
-- `expires_at` is the store's own paid-through time in epoch ms; NULL means lifetime (Mac license key).
-- `signed_at` orders updates for one subscription: a row only moves forward, so a delayed
-- notification or an old receipt replay can never undo a newer state.
CREATE TABLE entitlement (
  source TEXT NOT NULL CHECK (source IN ('apple', 'google', 'polar', 'license')),
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

CREATE INDEX entitlement_user_idx ON entitlement (user_id);
