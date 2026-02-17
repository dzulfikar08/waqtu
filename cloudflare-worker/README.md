# Waqtu Sparkle updates worker

Serves the Sparkle appcast from D1 and serves DMG files from R2. No need to edit code for each release.

## One-time setup

### 1. Create D1 database

```bash
cd cloudflare-worker
npx wrangler d1 create waqt-releases-db
```

Copy the `database_id` from the output into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "waqt-releases-db"
database_id = "YOUR_UUID_HERE"
```

### 2. Apply schema

```bash
npx wrangler d1 execute waqt-releases-db --remote --file=./schema.sql
```

### 3. Create R2 bucket (if needed)

```bash
npx wrangler r2 bucket create waqt-releases
```

Enable public access for the bucket in the Cloudflare dashboard (R2 → waqt-releases → Settings → Public access), or attach a custom domain. Note the public URL (e.g. `https://pub-xxxx.r2.dev/waqt-releases`).

### 4. Deploy worker

```bash
npx wrangler deploy
```

## Releasing a new version

From the **project root** (not cloudflare-worker):

1. In Xcode, set **CURRENT_PROJECT_VERSION** (build number) and **MARKETING_VERSION** (e.g. 1.0.1).
2. Run (from project root). R2 public base URL defaults to `https://waqt-r2-release.dzulfikar.com`:

```bash
./scripts/release.sh 1.0.1 "Short description for release notes."
```

The script will: build the DMG, sign it with Sparkle, upload to R2, and insert a row into D1. The worker will serve the updated appcast automatically.
