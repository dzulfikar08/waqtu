-- Premium entitlements: one row per store subscription (or lifetime license) a user holds.
-- `expires_at` is the store's own paid-through time in epoch ms; NULL means lifetime (Mac license key).
-- `signed_at` orders updates for one subscription: a row only moves forward, so a delayed
-- notification or an old receipt replay can never undo a newer state.
-- `order_id` is the transaction/order the current period came from (Apple transaction id, Play order
-- id): a refund only ends access when it refunds that one. `customer_ref` and `checked_at` serve
-- license rows: the Polar customer (to find a refunded customer's keys) and when Polar last
-- confirmed the key is still granted (0 = check again at the next read).
CREATE TABLE entitlement (
  source TEXT NOT NULL CHECK (source IN ('apple', 'google', 'polar', 'license')),
  external_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  product_id TEXT,
  environment TEXT,
  expires_at INTEGER,
  order_id TEXT,
  revoked_at INTEGER,
  customer_ref TEXT,
  checked_at INTEGER,
  signed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, external_id)
);

CREATE INDEX entitlement_user_idx ON entitlement (user_id);
CREATE INDEX entitlement_customer_idx ON entitlement (source, customer_ref) WHERE customer_ref IS NOT NULL;
