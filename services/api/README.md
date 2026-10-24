# Waqtu Sparkle updates worker

Serves the Sparkle appcast from D1 and serves DMG files from R2. No need to edit code for each release.

## One-time setup

### 1. Create D1 database

```bash
cd services/api   # from the repo root
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

From **`apps/apple`**:

1. In Xcode, set **CURRENT_PROJECT_VERSION** (build number) and **MARKETING_VERSION** (e.g. 1.0.1).
2. Run (from project root). R2 public base URL defaults to `https://waqt-r2-release.dzulfikar.com`:

```bash
./scripts/release.sh 1.0.1 "Short description for release notes."
```

The script will: build the DMG, sign it with Sparkle, upload to R2, and insert a row into D1. The worker will serve the updated appcast automatically.

## App backend: auth and sync (`/api/auth/*`, `/v1/*`)

The same worker also serves the Waqtu mobile app. `src/app.ts` exports `handleApp`, which `worker.ts` calls first; it answers `/api/auth/*` (better-auth) and `/v1/*` (sync API) and returns `null` for every other path so the release, appcast, and license routes above keep working unchanged.

### Database

A second D1 binding, `APP_DB` (`waqtu-db`), holds the app data. The existing `DB` binding stays for releases. Migrations live in `migrations/` (`0001_auth.sql` for better-auth, `0002_sync.sql` for sync data):

```bash
npx wrangler d1 migrations apply waqtu-db --remote   # production
npx wrangler d1 migrations apply waqtu-db --local    # wrangler dev
```

If the database was not created yet: `npx wrangler d1 create waqtu-db`, then put the `database_id` in `wrangler.toml`.

### Secrets

| Secret                    | Purpose                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`      | Signs session cookies. Generate with `openssl rand -base64 32`.                                             |
| `BETTER_AUTH_URL`         | Public origin of this worker, e.g. `https://api.getwaqtu.com`.                                              |
| `APPLE_CLIENT_ID`         | Enables native Sign in with Apple when set. Use the bundle id `dat.waqtu.ios`. No secret is needed.         |
| `GOOGLE_CLIENT_ID`        | Google OAuth **web** client id. Google is enabled only when this and `GOOGLE_CLIENT_SECRET` are both set.   |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth web client secret.                                                                             |
| `GOOGLE_EXTRA_CLIENT_IDS` | Optional, comma-separated Android and iOS Google client ids, accepted as id-token audiences (not a secret). |

```bash
cd services/api
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_EXTRA_CLIENT_IDS   # optional
```

For `wrangler dev`, put the same names in `services/api/.dev.vars`.

### Google & Apple client IDs

The server verifies native id tokens itself (better-auth 1.7.3), so what it needs depends on the sign-in flow:

| Flow                                                                             | Server needs                                                                                                        | Why (better-auth source)                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google web OAuth in the system browser (`signIn.social({ provider: 'google' })`) | `GOOGLE_CLIENT_ID` (web) + `GOOGLE_CLIENT_SECRET`; redirect URI `https://api.getwaqtu.com/api/auth/callback/google` | `createAuthorizationURL` throws `CLIENT_ID_AND_SECRET_REQUIRED` without both; the first `clientId` is the authorize and token-exchange client.                                              |
| Google native id token (`signIn.social({ provider: 'google', idToken })`)        | `GOOGLE_CLIENT_ID` plus `GOOGLE_EXTRA_CLIENT_IDS` (Android + iOS client ids)                                        | `idToken.audience` is the whole `clientId` option, which accepts `string \| string[]`; jose accepts a token whose `aud` matches any entry. The server adds web + extras to the array.       |
| Apple native id token (`signIn.social({ provider: 'apple', idToken })`)          | `APPLE_CLIENT_ID` (any non-empty value; set it to `dat.waqtu.ios`). No `APPLE_CLIENT_SECRET`.                       | Audience is `appBundleIdentifier` (hard-coded to `dat.waqtu.ios`), checked before `clientId`. The client secret is only read by the web redirect flow and token exchange, which are unused. |

What the app needs and where each id is created (Google Cloud console → APIs & Services → Credentials → Create credentials → OAuth client ID):

| App variable                           | Google Cloud OAuth client type | Created with                                                                                  | Also given to the server as                   |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`     | Web application                | Authorised redirect URI `https://api.getwaqtu.com/api/auth/callback/google`                   | `GOOGLE_CLIENT_ID` (+ `GOOGLE_CLIENT_SECRET`) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android                        | Package name `dat.waqtu.app` and the SHA-1 of the signing certificate                         | `GOOGLE_EXTRA_CLIENT_IDS`                     |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`     | iOS                            | Bundle ID `dat.waqtu.ios`                                                                     | `GOOGLE_EXTRA_CLIENT_IDS`                     |
| none                                   | Sign in with Apple             | App ID `dat.waqtu.ios` with the Sign in with Apple capability (Apple Developer → Identifiers) | `APPLE_CLIENT_ID=dat.waqtu.ios`               |

The web client id and secret are only needed while the app signs in through the browser flow. Android and iOS clients have no secret. The `EXPO_PUBLIC_GOOGLE_*` names are the convention for the native Google sign-in code in `apps/mobile`, which has not been added yet (today the app only reads `EXPO_PUBLIC_API_URL`).

### Endpoints

All `/v1/*` routes need a better-auth session (cookie from the Expo client, or a bearer token) and answer `401 {"error":"unauthorized"}` otherwise.

- `GET /v1/me` returns `{ id, email, name }`.
- `POST /v1/sync` with `{ entries?, settings? }` (max 500 entries, 100 settings, body at most 1,000,000 bytes: larger requests get `413 {"error":"payload_too_large"}`; unknown fields get 400) upserts last-write-wins and returns `{ applied: { entries, settings }, cursor }`. A write applies only if its `updatedAt` is newer, or equal with a greater value. Identical re-pushes change nothing and leave the cursor alone.
- `GET /v1/sync?since=<cursor>&limit=<1..500>` returns `{ entries, settings, cursor, hasMore }` ordered by revision. Settings are `{ key, value, updatedAt }`; there is no deletion, set a key to an empty string instead. Loop while `hasMore`, passing the returned `cursor` as `since`.
- Account deletion is `POST /api/auth/delete-user`; foreign keys cascade and remove the user's synced rows.

### Tests

```bash
bun run --filter @waqtu/api test
```

Tests run the real worker in miniflare with both D1 databases and the migrations applied.
