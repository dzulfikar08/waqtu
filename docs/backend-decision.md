# Backend decision: replace `mutabaahapp-production`, do not reuse

Investigated 2026-10-24 (read-only; Cloudflare API on the production account + a read-only Postgres session).

## What `api.getwaqtu.com` serves today

- Custom domain `api.getwaqtu.com` is bound to the Cloudflare Worker `mutabaahapp-production` (last deployed 2026-02-14, `wrangler`).
- Source is the private repo `dzulfikar08/mutabaah-bhvr` (`server/`): Hono + Drizzle + **Neon Postgres** (`DATABASE_URL` binding) + better-auth (Google + credential) + Polar checkout/webhook. No D1, no KV, no R2.
- Its data model is the older Mutabaah iOS family app: roles/permissions, `ibadah_types` (user-defined, 32 rows), `ibadah_records` (per type per day, JSONB value, soft delete), `family_groups`/`family_members`, `muhasabah_entries`, `habit_reminders`, `purchase_entitlements`, device tokens.
- Production data: **3 users** (2 Google, 1 credential; all created 1–4 Jan 2026, all `premium` tier, 0 active sessions, 0 purchase entitlements), 142 `ibadah_records`, 2 family groups, 2 muhasabah entries. No Apple sign-in accounts.
- The legacy iOS app (`dzulfikar08/Mutabaah`) calls `mutabaahapp-production.dzulfikar-at.workers.dev` and `mutabaah-family-sync-*.workers.dev`, not `api.getwaqtu.com`, so repointing the domain does not break it.

## Decision: replace

Waqtu needs a small, offline-first sync API (per-entry last-write-wins, since-cursor pull), not the old role/permission/family model. Reusing would mean:

- a Postgres dependency (Neon, outside Cloudflare) on a worker whose stack (Hono + Drizzle/pg) differs from `services/api`;
- porting a model (`ibadah_types` ids are per-user UUIDs, JSONB values, soft deletes keyed by server timestamps) that cannot do client-side LWW merging without a rewrite anyway;
- Apple sign-in (required on iOS next to Google) is absent.

New backend: `services/api` (`waqt-updates`) with better-auth (Apple + Google) on the new D1 database `waqtu-db` (`ec7bbfbc-9f2c-4a25-a26c-6022d9cd1ebf`), see `services/api/README.md`.

## Migration plan for the 3 existing users

Not automated: three accounts, all created within four days in January 2026, with no sessions since, look like test accounts. Their 142 records use custom per-user item ids that do not map to Waqtu's built-in checklist.

If the owner confirms any are real users:

1. They sign in to Waqtu with the same Google account (new account in `waqtu-db`; better-auth links by email only within one database, so history does not carry over by itself).
2. One-off script (not committed): export their `ibadah_records` joined to `ibadah_types.name`, map names to Waqtu item ids (`fajr`..`isha`, `dhuha`, `tahajjud`, `tilawah`, `dzikir_pagi`, `dzikir_petang`, `sedekah`, `puasa`, others become custom items), and POST them to `/v1/sync` with the original `updated_at`.

## Cutover steps (parent, after merge)

1. Apply D1 migrations: `wrangler d1 migrations apply waqtu-db --remote` from `services/api`.
2. Set secrets listed in `services/api/README.md` (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://api.getwaqtu.com`, Google, Apple).
3. `wrangler deploy` `waqt-updates`; move the custom domain `api.getwaqtu.com` from `mutabaahapp-production` to `waqt-updates`; set `EXPO_PUBLIC_API_URL=https://api.getwaqtu.com` in the EAS build profiles.
4. Leave `mutabaahapp-production` running on its workers.dev URL for the legacy iOS app until it is retired.

## Security finding

The Neon `DATABASE_URL` (including the password) is stored as a **plain-text** worker binding and is committed in `wrangler.jsonc` of the private `mutabaah-bhvr` repo. Rotate the Neon password and move it to a secret (or retire the database) regardless of this decision. The value is deliberately not reproduced here.

## Decision record: the Expo app replaces the Swift iPhone app

- **Bundle id.** The Expo app (`apps/mobile`) ships on the existing App Store record `dat.waqtu.ios`
  (Apple id 6826628861) as the next version, replacing the Swift iPhone app from `apps/apple`. The
  Swift code keeps building only the Mac app (direct + Mac App Store).
- **Old widget and watch targets.** The Swift iOS widget and watchOS targets are not shipped with the
  Expo binary; users who update lose them until equivalents exist in the Expo app. The targets stay in
  `apps/apple` for reference and CI builds only, and are not submitted again under `dat.waqtu.ios`.
- **Mac App Store lifetime buyers.** Resolved 2026-10-25 (see below): the Mac App Store lifetime
  purchase `dat.waqtu.lifetime` is replaced by subscriptions; nobody bought it.
- **Submitting.** `apps/mobile/eas.json` `submit.production` targets `ascAppId` 6826628861 and the Play
  `internal` track. The Play service-account key is read from
  `apps/mobile/google-play-service-account.json` (git-ignored, never committed); in CI write it from a
  secret before `eas submit`. The `development` profile builds for physical iPhones;
  `development-simulator` keeps the simulator build.

## Decision record: Premium is one subscription (2026-10-25, DEV-12 / DEV-13)

Owner decisions: sync across devices is Premium; Circles are Premium; the Mac moves to subscriptions
(no lifetime); the website stops selling lifetime. There were no paid users, so nothing is grandfathered.

- **What is Premium.** iPhone/Android: free core is prayer times, mutabaah on the device, Ramadhan
  basics, halaqah program and hafalan; Premium adds sync across devices, Circles and the paid trackers
  on the paywall. Mac: a 7-day free trial, then the app needs Premium.
- **One subscription, Rp 29.000 / month or Rp 249.000 / year.** iPhone `dat.waqtu.premium.monthly|yearly`
  (app `dat.waqtu.ios`), Play `premium` (`monthly`/`yearly`), Mac App Store
  `dat.waqtu.mac.premium.monthly|yearly` (app `dat.waqtu`, its own subscription group with the same
  prices). Every purchase is linked to the Waqtu account (`POST /v1/billing/apple` accepts both Apple
  apps, each only with its own products) so it unlocks every platform via `GET /v1/entitlement`.
- **Direct-download Mac build** sells nothing: premium comes from signing in with a subscribed Waqtu
  account; the Upgrade screen points to the phone apps.
- **Web** sells nothing: `getwaqtu.com` lost its Polar lifetime checkout and webhook routes and shows the
  store badges. The API's Polar subscription checkout stays (it needs a signed-in account the site does
  not have) but no client calls it.
- **Circles** are enforced on the server: `CIRCLES_REQUIRES_PREMIUM = "true"` in `wrangler.toml` (403
  `premium_required` on join/create/post; reading stays open).
- **Sync is gated in the apps, not on `/v1/sync`.** Considered and rejected: a server-side 403 for
  non-premium accounts. The Mac app syncs during its free trial, which is local to the Mac and invisible
  to the server, and the first sign-in on a device uploads its log before the app has fetched the
  account's entitlement; both would break. The mobile app already syncs only with premium (PR #24).
  `services/api/test/sync.test.ts` pins this behaviour.
- **Removed (clean cutover):** web lifetime checkout and webhook (`apps/web/src/pages/api/payments/*`),
  the Mac App Store lifetime IAP, the direct build's Polar license-key UI and `LicenseManager`,
  `POST /license/activate`, `POST /v1/entitlement/link-license`, license entitlement rows and their
  columns (migration `0005`).
- **Kept for already-installed Mac versions:** the Sparkle appcast (`/appcast.xml`, `/`, `/latest`) so
  they can update to the subscription build, and `POST /license/validate`, which old direct builds call on
  launch with a stored key; it still answers `{ valid }`, and any failure makes them fall back to their
  trial state.
