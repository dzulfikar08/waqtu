import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.APP_DB, env.TEST_MIGRATIONS);

// Legacy release database, normally created from schema.sql.
await env.DB.exec(
  "CREATE TABLE IF NOT EXISTS releases (version INTEGER PRIMARY KEY, short_version_string TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, enclosure_url TEXT NOT NULL, ed_signature TEXT NOT NULL, length INTEGER NOT NULL, pub_date TEXT NOT NULL)",
);
