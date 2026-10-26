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

The same worker also serves the Waqtu mobile app. `src/app.ts` exports `handleApp`, which `worker.ts` calls first; it answers `/api/auth/*` (better-auth) and `/v1/*` (sync API) and returns `null` for every other path so the release, appcast, and legacy license routes above keep working unchanged.

### Legacy routes kept for installed Mac apps

Waqtu stopped selling the Mac lifetime license (2026-10-25: Premium is one subscription everywhere). Mac app versions released before that call two routes on their own, so these stay:

- `GET /appcast.xml` (and `/`, `/latest`): Sparkle update feed. Old versions update themselves to the subscription build through it.
- `POST /license/validate` `{ key, activation_id }`: old direct-download builds re-validate a stored Polar key on every launch. It still asks Polar and answers `{ valid }` (500 `License server not configured` without `POLAR_ACCESS_TOKEN`/`POLAR_ORG_ID`); old builds treat any failure as "not licensed" and fall back to their trial state, so it never crashes them.

Removed: `POST /license/activate` (only the purchase flow of old builds used it; nobody holds a key) and `POST /v1/entitlement/link-license`.

### Database

A second D1 binding, `APP_DB` (`waqtu-db`), holds the app data. The existing `DB` binding stays for releases. Migrations live in `migrations/` (`0001_auth.sql` for better-auth, `0002_sync.sql` for sync data, `0003_circles.sql` for halaqah circles, `0004_entitlement.sql` for premium entitlements, `0005_drop_license_entitlements.sql` removes the retired Mac license rows and columns, `0006_client_errors.sql` for anonymous crash reports):

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

All `/v1/*` routes except `POST /v1/errors` need a better-auth session (cookie from the Expo client, or a bearer token) and answer `401 {"error":"unauthorized"}` otherwise.

- `GET /v1/me` returns `{ id, email, name }`.
- `POST /v1/sync` with `{ entries?, settings? }` (max 500 entries, 100 settings, body at most 1,000,000 bytes: larger requests get `413 {"error":"payload_too_large"}`; unknown fields get 400) upserts last-write-wins and returns `{ applied: { entries, settings }, cursor }`. A write applies only if its `updatedAt` is newer, or equal with a greater value. Identical re-pushes change nothing and leave the cursor alone.
- Sync is a Waqtu Premium feature, but `/v1/sync` deliberately does not check premium: the gate lives in the apps (mobile syncs only with premium). The Mac app syncs during its free trial, which is a local trial the server cannot see, and a first sign-in uploads the device's log before the app has read the account's entitlement; a server-side `403` would break both. See `docs/backend-decision.md`.
- `GET /v1/sync?since=<cursor>&limit=<1..500>` returns `{ entries, settings, cursor, hasMore }` ordered by revision. Settings are `{ key, value, updatedAt }`; there is no deletion, set a key to an empty string instead. Loop while `hasMore`, passing the returned `cursor` as `since`.
- Account deletion is `POST /api/auth/delete-user`; foreign keys cascade and remove the user's synced rows.
- `POST /v1/errors` takes anonymous crash and error reports from the phone app, no session needed (a cookie that comes along is ignored): `{ events: [...] }`, 1 to 20 events of `{ platform: "ios"|"android", appVersion, buildNumber?, runtimeVersion?, updateId?, channel?, fatal, name, message (≤ 500 chars), stack? (≤ 8192 chars), screen?, count? (repeats folded on the phone, 1..10000) }`, body at most 256 KB. Unknown fields or anything out of range is `400` and nothing is stored; `202 { accepted }` otherwise. Rows hold no user id, no location and no IP: the per-IP limit (10 requests a minute, `429` with `Retry-After`) counts under an HMAC of the IP keyed with `BETTER_AUTH_SECRET`, and those counters are deleted after two minutes. The hourly cron deletes reports older than 90 days.
- `GET /v1/admin/errors?since=<epoch ms>` (default: last 7 days, admins in `ADMIN_USER_IDS` only, else `403`) returns `{ since, groups }`: reports grouped by `name` + `message` + top stack frame, most recent first (max 100), each with `fatal`, `reports`, `occurrences`, `firstSeen`, `lastSeen`, `platforms`, `appVersions`, `screens` and the latest `stack`.

### Premium (`/v1/entitlement`, `/v1/billing/*`)

Code: `src/billing/`. Setup of the stores and secrets: "Store setup" in the root README. Every source writes
rows into `entitlement` (`source`, `external_id`, `user_id`, `expires_at`); every source is a subscription
with an end date. A row only moves forward by its `signed_at`, so late notifications and old receipt
replays cannot undo a newer state, and a subscription held by one account is refused for another (409).

- `GET /v1/entitlement` (session) returns `{ premium, source, expiresAt }`. The latest expiry wins; when not
  premium, `source`/`expiresAt` describe the most recent lapsed period (both null if the user never held
  premium).
- `POST /v1/billing/apple` `{ signedTransaction }` (session): StoreKit 2 JWS verified to Apple Root CA G3,
  granted until the store's `expiresDate`. Two App Store apps sell Premium, each with its own products:
  the iPhone app (bundle `dat.waqtu.ios`, `dat.waqtu.premium.monthly|yearly`) and the Mac App Store app
  (bundle `dat.waqtu`, `dat.waqtu.mac.premium.monthly|yearly`). A product of the other app, or the retired
  Mac `dat.waqtu.lifetime`, is refused. Returns the entitlement.
- `POST /v1/billing/apple/notifications` `{ signedPayload }`: App Store Server Notifications V2 (Production and
  Sandbox) for both apps, verified like receipts; the transaction inside must belong to the app the
  notification names. Production notifications must carry the app's numeric id when it is configured
  (`APPLE_APP_ID` for the iPhone app, `APPLE_MAC_APP_ID` for the Mac app). Renewals, expiry and grace
  period rewrite the row. A refund/revoke only ends access when it is for the transaction the stored
  period came from (`order_id`); a refund of an earlier period leaves the paid period alone.
- `POST /v1/billing/google` `{ purchaseToken }` (session): re-read from the Android Publisher API
  (`premium`, base plan `monthly|yearly`), granted until Google's expiry, then acknowledged. Returns the
  entitlement plus `pending` (cash payments are granted only once Play charges them).
- `POST /v1/billing/google/rtdn`: Pub/Sub push of real-time developer notifications, authenticated by the
  Google-signed push JWT (`GOOGLE_PLAY_RTDN_PUSH_EMAIL`) or `?token=` (`GOOGLE_PLAY_RTDN_TOKEN`).
- `POST /v1/billing/polar/checkout` `{ plan: "monthly" | "yearly" }` (session) returns a hosted checkout
  `{ url }`; 409 `already_premium` if the account already has premium. `POST /v1/billing/polar/portal`
  returns the customer portal `{ url }`. No client calls checkout today (the website sells nothing).
- `POST /v1/billing/polar/webhook`: Polar `subscription.*` events (Standard Webhooks signature); ignored
  until the subscription products are configured.

Secrets: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_RTDN_PUSH_EMAIL` or `GOOGLE_PLAY_RTDN_TOKEN`,
`GOOGLE_PLAY_PACKAGE_NAME` (optional, default `dat.waqtu.app`), `POLAR_ACCESS_TOKEN`,
`POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_MONTHLY_ID`, `POLAR_PRODUCT_YEARLY_ID`, `POLAR_SERVER` and
`POLAR_SUCCESS_URL` (optional). `POLAR_ORG_ID` is only read by the legacy `/license/validate`.
`APPLE_APP_ID` is a plain var in `wrangler.toml`; add `APPLE_MAC_APP_ID` there once the Mac App Store
app's numeric id is known.

### Tests

```bash
bun run --filter @waqtu/api test
```

Tests run the real worker in miniflare with both D1 databases, the `CIRCLE_MEDIA` R2 bucket and the migrations applied.

## Circles (`/v1/circles/*`, `/v1/admin/circles/*`)

Small anonymous reflection groups, public or private, always gender-separated (ikhwan / akhwat), no DMs. Code lives in `src/circles/`, data in `migrations/0003_circles.sql`.

### Infra to create before deploying

| What                       | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 bucket for voice notes  | `npx wrangler r2 bucket create waqtu-circle-media`. Bound as `CIRCLE_MEDIA` in `wrangler.toml`. Keep it **private** (no public access, no custom domain): notes are only served through the Worker after a membership check. `wrangler deploy` fails until the bucket exists.                                                                                                                                                                                                                                     |
| D1 migration               | `npx wrangler d1 migrations apply waqtu-db --remote` (applies `0003_circles.sql`).                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ADMIN_USER_IDS` secret    | Comma-separated better-auth user ids that may use the moderation queue: `npx wrangler secret put ADMIN_USER_IDS`. Find an id with `GET /v1/me` while signed in. Unset means nobody is an admin. For `wrangler dev` put it in `.dev.vars`.                                                                                                                                                                                                                                                                         |
| `CIRCLES_REQUIRES_PREMIUM` | Plain var in `wrangler.toml`, `"true"` (owner decision 2026-10-25: circles are Premium). `GET /v1/circles/config` reports it as `requiresPremium`; the app then shows the premium gate instead of circles to accounts without premium. When `"true"`, the server refuses joining (`join`, `join-private`, `private`) and posting (`posts`, `summary`, media upload) with 403 `premium_required` unless `/v1/entitlement` would say premium; reading stays open. Tests run with `"false"` and turn it on per test. |

No other secrets: voice notes are uploaded through the Worker (5 MB limit, audio mime allowlist), so no R2 S3 credentials are needed.

### Rules the server enforces

- **Gender wall.** Gender is set once on the profile (`PUT /v1/circles/profile`, required) and cannot change. Every `/circles/:id/...` route first loads the circle with a join on `circle_profile.gender = circle.gender`; anything else is `404`, as is an invite code for the other gender. Two SQL triggers back this up: a membership of the other gender and a gender change both abort.
- **Matching.** `POST /v1/circles/join` picks a public circle with the same gender and language, a UTC offset within 4 hours, no block either way with any member, and one the user never left. It fills the fullest open circle first so circles grow to 12 before another opens (a circle is `ready` from 8 members). Seats are taken in one atomic statement, so concurrent joins cannot exceed 12. At most one public circle per person (a unique index) and 5 private ones.
- **Private circles.** `POST /v1/circles/private` returns an 8-character invite code (only members see it); `POST /v1/circles/join-private` joins with it.
- **Pause and leave are silent.** They only touch the caller's membership row: no event, notification or feed entry for anyone else. A paused member keeps the seat and can read but not post or react; leaving frees the seat.
- **Posts.** Text up to 2000 chars, or a voice note (`PUT /v1/circles/:id/media` raw body, `content-type: audio/*`, `x-duration-seconds`, max 5 MB and 180 s, returns `mediaId` for the post; `GET .../media/:mediaId` streams it with byte ranges), optionally linked to a `halaqahDayId`. Weekly summaries (`POST /v1/circles/:id/summary`) are opt-in on the profile and aggregate only: `countedDays`, `fardhOnTime`, `fardhJamaah`, `pages`. Reactions are one per person from `❤️ 🤲 ✨`.
- **Moderation.** `POST .../posts/:postId/report` (`target` `post` or `user`) and `POST .../posts/:postId/block`. People are only ever addressed through a post, so user ids never reach clients. A block hides the pair from each other in feeds, reactions and matching. Three distinct pending reporters hide a post for everyone until an admin decides.
- **Admin.** `GET /v1/admin/circles/queue`, `POST /v1/admin/circles/posts/:postId` (`hide` keeps the reports pending, `restore` unhides and dismisses them, also on a visible post, `remove` is final), `POST /v1/admin/circles/users/:userId` (`suspend` | `unsuspend` | `dismiss`). Anyone not in `ADMIN_USER_IDS` gets `403`. The phone app's Settings shows a Circles admin section (moderation queue and crash reports) to these users only.
- **Rate limits.** Per user, fixed one-hour windows, `429` with `Retry-After`: 12 posts or summaries, 12 uploads, 30 joins or invite attempts, 12 reports, 30 blocks, 200 reactions, 60 pause/leave/delete actions, 20 profile saves. Reads are not limited.
- **R2 cleanup.** Deleting an account (`POST /api/auth/delete-user`) first deletes all of the user's voice note objects (a better-auth `beforeDelete` hook; if R2 fails the deletion fails and can be retried), then the rows cascade. An hourly cron (`[triggers] crons` in `wrangler.toml`, `scheduled` in `worker.ts`) deletes uploads that were never attached to a post within 24 hours.
