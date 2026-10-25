# Waqtu

Prayer times, mutabaah yaumiyah, and halaqah for Muslims with little time. Privacy-first and open
source. Website: [getwaqtu.com](https://getwaqtu.com).

## Layout

| Path            | What                                                                                                | Stack                       |
| --------------- | --------------------------------------------------------------------------------------------------- | --------------------------- |
| `apps/web`      | getwaqtu.com landing, blog, Polar checkout + webhook                                                | Astro on Cloudflare Workers |
| `apps/apple`    | macOS menu-bar app (direct + Mac App Store); the iPhone app is now `apps/mobile` on `dat.waqtu.ios` | Swift / SwiftUI, Xcode      |
| `apps/mobile`   | iOS + Android phone app: Today, Ramadhan, settings, offline-first SQLite                            | Expo / React Native, EAS    |
| `services/api`  | Auth, sync, circles (halaqah), billing/entitlements, releases (Sparkle appcast, DMG)                | Cloudflare Worker, D1, R2   |
| `packages/core` | Shared logic: prayer times, Hijri/Ramadhan, khatam plan, fidyah/zakat                               | TypeScript, bun test        |
| `content/`      | Bundled content: Quran text + metadata (Tanzil), halaqah material                                   | Data files                  |

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
- **Store screenshots** (`store-screenshots.yml`, manual): builds the phone app with `EXPO_PUBLIC_DEMO_MODE=1`
  (frozen clock, Jakarta, Ramadan day 5, demo data loaded by
  `waqtu://demo?lang=id|en&to=today|week|ramadhan|circles|settings`), then Maestro
  (`apps/mobile/store/maestro/screens.yaml`) captures id + en screenshots (light theme) on Android emulators (Pixel 6,
  Pixel 7 Pro) and a 6.9" iPhone simulator. Each artifact also holds design review shots under `review/{dark,light}`
  (the store screens in dark plus `review.yaml`: checklist, Circles, lower Settings). Output is the `screenshots-*`
  artifacts. Store listing text lives in `apps/mobile/store/`. No secrets needed, and no other build sets the demo flag.
- **Release macOS** (`release-macos.yml`, manual): runs `apps/apple/scripts/release.sh` → Developer ID
  sign, notarize, DMG, Sparkle sign, upload to R2, record in D1. Secrets are listed at the top of the
  workflow and live in the `release` environment.

## Premium

Owner decisions (2026-10-25): Waqtu Premium is **one auto-renewing subscription** for iPhone, Android
and Mac; there is no lifetime purchase anywhere (no paid users existed, so nobody is grandfathered).

| Free core (iPhone, Android)                                                                         | Waqtu Premium                                                                                                              |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Prayer times and adhan reminders, mutabaah on the device, Ramadhan basics, halaqah program, hafalan | Sync across devices, Circles, plus the paid trackers listed on the in-app paywall; the whole Mac app after its 7-day trial |

- **iPhone / Android:** bought in the app (App Store / Google Play).
- **Mac, Mac App Store edition (`dat.waqtu`):** bought in the app (StoreKit 2 subscriptions); the
  transaction is also sent to the account so the phone unlocks too. 7-day free trial first.
- **Mac, direct download (Developer ID):** sells nothing. 7-day free trial, then premium comes from
  signing in with a Waqtu account that holds a subscription bought on any platform.
- **Web (getwaqtu.com):** sells nothing; it points to the stores.

Premium belongs to the signed-in account: every source (App Store on iPhone or Mac, Google Play, Polar)
writes a row into the `entitlement` table of `waqtu-db`, and `GET /v1/entitlement` answers
`{ premium, source, expiresAt }`. Trust never comes from a client claim: App Store receipts are JWS
chains verified to Apple Root CA G3, Play purchases are re-read from the Android Publisher API, Polar
webhooks are HMAC-signed. RevenueCat is not used: it was replaced by native IAP (`expo-iap`, StoreKit 2
on the Mac) plus our own server-side verification. Circles are enforced on the server
(`CIRCLES_REQUIRES_PREMIUM = "true"`); sync is gated in the apps only (why: `docs/backend-decision.md`).
Endpoints and tests: `services/api/README.md`.

Prices live in the stores, not in code:

| Plan    | Indonesia (IDR) | Elsewhere (USD) |
| ------- | --------------- | --------------- |
| Monthly | Rp 29.000       | 2.99            |
| Yearly  | Rp 249.000      | 24.99           |

Product ids (already used by the code, do not rename): iPhone app subscription group `Waqtu Premium`
with `dat.waqtu.premium.monthly` and `dat.waqtu.premium.yearly`; Mac App Store app subscription group
`Waqtu Premium` with `dat.waqtu.mac.premium.monthly` and `dat.waqtu.mac.premium.yearly`; Play
subscription `premium` with base plans `monthly` and `yearly`; Polar product ids come from env.

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

#### App Store Connect (Mac App Store app `dat.waqtu`)

1. Monetization → Subscriptions → create a group **Waqtu Premium** for the Mac app with
   `dat.waqtu.mac.premium.monthly` (1 month) and `dat.waqtu.mac.premium.yearly` (1 year), the same
   prices (Rp 29.000 / Rp 249.000, other regions from the USD column), localizations id + en and a review
   screenshot of the Upgrade tab. Attach both to the next Mac App Store version. Remove the old
   non-consumable `dat.waqtu.lifetime` from sale (nobody bought it).
2. App Information → **App Store Server Notifications**: Production and Sandbox URL
   `https://api.getwaqtu.com/v1/billing/apple/notifications`, version **2** (same endpoint as the iPhone app).
3. Put the Mac app's numeric Apple id in `services/api/wrangler.toml` as `APPLE_MAC_APP_ID` so Production
   notifications are checked against it.
4. The local StoreKit test configuration is `apps/apple/WaqtuProducts.storekit` (select it in the
   `waqtu-mas` scheme's Run options to test purchases without App Store Connect).

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

#### Polar (optional web subscription)

The website sells nothing; Polar only matters if a signed-in web checkout is added later
(`POST /v1/billing/polar/checkout` already exists).

1. In the Waqtu organisation create two **subscription** products, monthly (USD 2.99) and yearly
   (USD 24.99), and archive the old Mac lifetime license product (nobody bought it). Copy the
   subscription product ids.
2. Settings → Webhooks → add endpoint `https://api.getwaqtu.com/v1/billing/polar/webhook`, format
   **Raw**, events `subscription.created`, `subscription.active`, `subscription.updated`,
   `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`. Copy the secret. Remove the
   old webhook to `getwaqtu.com/api/payments/webhook`: that route is gone.
3. The access token behind `POLAR_ACCESS_TOKEN` needs the `checkouts:write` and
   `customer_sessions:write` scopes.

#### Worker secrets (`waqt-updates`)

```bash
cd services/api
npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   # paste the whole JSON key file
npx wrangler secret put GOOGLE_PLAY_RTDN_PUSH_EMAIL        # or GOOGLE_PLAY_RTDN_TOKEN, see above
npx wrangler secret put POLAR_WEBHOOK_SECRET
npx wrangler secret put POLAR_PRODUCT_MONTHLY_ID
npx wrangler secret put POLAR_PRODUCT_YEARLY_ID
npx wrangler d1 migrations apply waqtu-db --remote          # entitlement table + license cleanup
```

Already set and reused: `BETTER_AUTH_URL` (must be `https://api.getwaqtu.com`, it is the RTDN audience),
`POLAR_ACCESS_TOKEN`, `POLAR_ORG_ID`. `APPLE_APP_ID` (6826628861) is a plain var in `wrangler.toml`.
Optional: `GOOGLE_PLAY_PACKAGE_NAME` (default `dat.waqtu.app`), `POLAR_SERVER=sandbox` for Polar's
sandbox, `POLAR_SUCCESS_URL` (where Polar sends buyers after paying, default `https://getwaqtu.com/`).
A feature stays off, answering `404 {"error":"unavailable"}`, until its secrets are set.

After deploying, check: sign in on a phone with a sandbox / license-tester account, buy a plan, then
`GET /v1/entitlement` answers `premium: true`; restore the purchase on a second device with the same
account; sign in on the Mac with that account and the trial lock lifts.

## License

- `services/api`: [AGPL-3.0-only](services/api/LICENSE). If you run a modified server, publish your changes.
- Everything else: [MPL-2.0](LICENSE). File-level copyleft, compatible with App Store distribution.
- `content/quran` and `apps/mobile/assets/fonts`: third-party Quran text and metadata (Tanzil Project, CC BY 3.0, verbatim only) and the Amiri Quran font (SIL OFL 1.1). Terms in [`content/quran/README.md`](content/quran/README.md).

The **Waqtu** name and logo are not covered by these licenses; forks must use their own branding.

Contributions require signing the [CLA](CLA.md) (the bot asks on your first pull request).
