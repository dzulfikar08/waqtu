# Waqtu

Prayer times, mutabaah yaumiyah, and halaqah for Muslims with little time. Privacy-first and open
source. Website: [getwaqtu.com](https://getwaqtu.com).

## Layout

| Path           | What                                                                     | Stack                       |
| -------------- | ------------------------------------------------------------------------ | --------------------------- |
| `apps/web`     | getwaqtu.com landing, blog, Polar checkout + webhook                     | Astro on Cloudflare Workers |
| `apps/apple`   | macOS menu-bar companion (direct + Mac App Store), iOS, watchOS, widgets | Swift / SwiftUI, Xcode      |
| `apps/mobile`  | iOS + Android phone app: Today, Ramadhan, settings, offline-first SQLite | Expo / React Native, EAS    |
| `services/api` | Sparkle appcast, DMG download, license activate/validate                 | Cloudflare Worker, D1, R2   |

Prayer-time math runs on the device; location never leaves it.

## Develop

```bash
bun install
bun run dev:web        # landing page
bun run dev:api        # updates/license worker
bun run dev:mobile     # Expo dev server (phone app)
open apps/apple/waqt.xcodeproj   # Apple apps (Xcode, macOS only)
```

Checks (CI runs the same):

```bash
bun run lint && bun run fmt:check && bun run typecheck && bun run build
```

## Releases

GitHub Actions builds everything; no local Mac is needed.

- **CI** (`.github/workflows/ci.yml`): gitleaks over full history, lint/format/typecheck/build, and an
  unsigned `xcodebuild` of the macOS and iOS apps on `macos-latest`.
- **Release macOS** (`release-macos.yml`, manual): runs `apps/apple/scripts/release.sh` → Developer ID
  sign, notarize, DMG, Sparkle sign, upload to R2, record in D1. Secrets are listed at the top of the
  workflow and live in the `release` environment.

## Premium

One Waqtu subscription unlocks the phone apps (iOS, Android) and the Mac app; prayer times, adhan
reminders and basic mutabaah stay free. Mac lifetime buyers (Polar license keys) keep premium forever
by linking their key to their account. Premium belongs to the signed-in account: every source
(App Store, Google Play, Polar, Mac license) writes a row into the `entitlement` table of `waqtu-db`,
and `GET /v1/entitlement` answers `{ premium, source, expiresAt }` (`expiresAt` null with `premium` true
= lifetime). Trust never comes from a client claim: App Store receipts are JWS chains verified to
Apple Root CA G3, Play purchases are re-read from the Android Publisher API, Polar webhooks are
HMAC-signed, license keys are validated by Polar. Endpoints and tests: `services/api/README.md`.

Prices live in the stores, not in code. Suggested prices:

| Plan    | Indonesia (IDR) | Elsewhere (USD) |
| ------- | --------------- | --------------- |
| Monthly | Rp 29.000       | 2.99            |
| Yearly  | Rp 249.000      | 24.99           |

Product ids (already used by the code, do not rename): App Store subscription group `Waqtu Premium`
with `dat.waqtu.premium.monthly` and `dat.waqtu.premium.yearly`; Play subscription `premium` with base
plans `monthly` and `yearly`; Polar product ids come from env.

### Store setup

Everything below is a one-time job for the account owner. Nothing here is done by the code.

#### App Store Connect (app `dat.waqtu.ios`, Apple id 6826628861)

1. Agreements, Tax, and Banking: the **Paid Apps** agreement must be active, with bank and tax info.
2. Monetization → Subscriptions → group **Waqtu Premium**: subscriptions `dat.waqtu.premium.monthly`
   (1 month) and `dat.waqtu.premium.yearly` (1 year) in the same group, prices equalized from
   Rp 29.000 / Rp 249.000, localizations id + en, and a review screenshot of the paywall for each.
   Status must reach **Ready to Submit**; attach both to the app version at its first submission.
3. App Information → **App Store Server Notifications**: set the Production **and** Sandbox Server URL
   to `https://api.getwaqtu.com/v1/billing/apple/notifications`, version **2**.
4. Business → Sandbox Testers: create at least one tester to try purchases (sandbox renewals are
   accelerated, a monthly plan lasts a few minutes).
5. App Privacy and the app description must link `https://getwaqtu.com/privacy` and
   `https://getwaqtu.com/terms` (the paywall shows both links; Apple requires them for subscriptions).
6. No in-app purchase capability or key file is needed: StoreKit 2 receipts are verified with Apple's
   public root certificate, so there is no App Store Connect API key to configure.

#### Play Console (app `dat.waqtu.app`)

1. Play only unlocks subscription creation after an upload that contains the `BILLING` permission.
   `expo-iap` adds it, so build this branch (versionCode 2 or higher), e.g.
   `gh workflow run release-android.yml --ref <branch> -f profile=production -f play_track=internal`,
   and roll it out to internal testing.
2. Monetize with Play → Products → Subscriptions → **Create subscription**: product id `premium` (can
   never change), name `Waqtu Premium`. Add base plan `monthly` (auto-renewing, monthly) at Rp 29.000
   and base plan `yearly` (auto-renewing, yearly) at Rp 249.000, set other regions from the suggested
   USD prices, and **Activate** both. Do not add promotional offers: the app buys each plan's plain
   base-plan offer.
3. Service account: `joyorogo-play-billing@joyorogo.iam.gserviceaccount.com` already has financial and
   orders/subscriptions permissions on Waqtu. Its JSON key is the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   secret below, and the **Google Play Android Developer API** must be enabled in its project.
4. Real-time notifications (renewals, refunds): in the same Google Cloud project create a Pub/Sub topic
   `play-rtdn` and give `google-play-developer-notifications@system.gserviceaccount.com` the
   **Pub/Sub Publisher** role on it. Create a **push** subscription on the topic with endpoint
   `https://api.getwaqtu.com/v1/billing/google/rtdn`, authentication on, a push service account
   (its email is `GOOGLE_PLAY_RTDN_PUSH_EMAIL`) and audience exactly
   `https://api.getwaqtu.com/v1/billing/google/rtdn` (no query string). Grant the Pub/Sub service agent
   (`service-<project-number>@gcp-sa-pubsub.iam.gserviceaccount.com`) **Service Account Token Creator**
   on the push service account. Alternative without JWT: set `GOOGLE_PLAY_RTDN_TOKEN` to a long random
   string and use `https://api.getwaqtu.com/v1/billing/google/rtdn?token=<that string>` as the endpoint
   with authentication off.
5. Monetization setup → **Real-time developer notifications**: enable, topic
   `projects/<project-id>/topics/play-rtdn`, notifications for subscriptions and all voided purchases;
   use **Send test message** (the endpoint answers 204).
6. Settings → License testing: add the testers' Google accounts. Test subscriptions renew on an
   accelerated schedule.

#### Polar (web and Mac)

1. In the Waqtu organisation create two **subscription** products, monthly (USD 2.99) and yearly
   (USD 24.99), separate from the Mac lifetime license product. Copy their product ids.
2. Settings → Webhooks → add endpoint `https://api.getwaqtu.com/v1/billing/polar/webhook`, format
   **Raw**, events `subscription.created`, `subscription.active`, `subscription.updated`,
   `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, plus `benefit_grant.revoked`
   and `order.refunded` (a refunded Mac license key loses its lifetime premium). Copy the secret.
3. The access token behind `POLAR_ACCESS_TOKEN` (the one the Mac license routes already use) needs the
   `checkouts:write`, `customer_sessions:write` and `license_keys:read` scopes besides what licensing
   needs. `license_keys:read` lets the worker re-confirm linked Mac keys every 7 days; without it a
   refund is still caught by the webhook events above.

#### Worker secrets (`waqt-updates`)

```bash
cd services/api
npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   # paste the whole JSON key file
npx wrangler secret put GOOGLE_PLAY_RTDN_PUSH_EMAIL        # or GOOGLE_PLAY_RTDN_TOKEN, see above
npx wrangler secret put POLAR_WEBHOOK_SECRET
npx wrangler secret put POLAR_PRODUCT_MONTHLY_ID
npx wrangler secret put POLAR_PRODUCT_YEARLY_ID
npx wrangler d1 migrations apply waqtu-db --remote          # creates the entitlement table
```

Already set and reused: `BETTER_AUTH_URL` (must be `https://api.getwaqtu.com`, it is the RTDN audience),
`POLAR_ACCESS_TOKEN`, `POLAR_ORG_ID`. `APPLE_APP_ID` (6826628861) is a plain var in `wrangler.toml`.
Optional: `GOOGLE_PLAY_PACKAGE_NAME` (default `dat.waqtu.app`), `POLAR_SERVER=sandbox` for Polar's
sandbox, `POLAR_SUCCESS_URL` (where Polar sends buyers after paying, default `https://getwaqtu.com/`).
A feature stays off, answering `404 {"error":"unavailable"}`, until its secrets are set.

After deploying, check: sign in on a phone with a sandbox / license-tester account, buy a plan, then
`GET /v1/entitlement` answers `premium: true`; restore the purchase on a second device with the same
account; link a Mac license key from the paywall.

## License

- `services/api`: [AGPL-3.0-only](services/api/LICENSE). If you run a modified server, publish your changes.
- Everything else: [MPL-2.0](LICENSE). File-level copyleft, compatible with App Store distribution.
- `content/quran` and `apps/mobile/assets/fonts`: third-party Quran text and metadata (Tanzil Project, CC BY 3.0, verbatim only) and the Amiri Quran font (SIL OFL 1.1). Terms in [`content/quran/README.md`](content/quran/README.md).

The **Waqtu** name and logo are not covered by these licenses; forks must use their own branding.

Contributions require signing the [CLA](CLA.md) (the bot asks on your first pull request).
