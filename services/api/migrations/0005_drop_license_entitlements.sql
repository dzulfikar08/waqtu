-- Waqtu no longer sells a Mac lifetime license (owner decision 2026-10-25: Premium is one subscription
-- on every platform). Nobody bought one, so this drops any linked-license rows (test links) and the
-- two columns only license rows used. The CHECK on `source` keeps allowing 'license': SQLite cannot
-- change it without rebuilding the table, and no code writes that value anymore.
DELETE FROM entitlement WHERE source = 'license';
DROP INDEX IF EXISTS entitlement_customer_idx;
ALTER TABLE entitlement DROP COLUMN customer_ref;
ALTER TABLE entitlement DROP COLUMN checked_at;
