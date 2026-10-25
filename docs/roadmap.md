# Waqtu roadmap

> **Last updated:** 25 Oct 2026

Waqtu is prayer times, mutabaah yaumiyah and asynchronous halaqah for Muslims with little time:
privacy-first (prayer math on the device, location never leaves it) and open source. Positioning for
the phone launch: **Halaqah tanpa macet**.

## Launch timeline

From `docs/marketing/launch-plan.md`. Ramadhan dates follow the app's own calculation; Indonesia may
start a day later.

| Date            | Milestone                                             |
| --------------- | ----------------------------------------------------- |
| Dec 2026        | Build in public, waitlist, kajian channel list        |
| 1-14 Jan 2027   | Waitlist push, kajian pitches                         |
| **15 Jan 2027** | **Store submission target (App Store + Google Play)** |
| **~8 Feb 2027** | **Ramadhan 1448H day 1**: launch and daily use        |
| ~24 Feb 2027    | 17 Ramadhan                                           |
| ~9 Mar 2027     | Eid al-Fitr                                           |
| After Ramadhan  | Retention; fiqh companion at the earliest (see below) |

## Current state per platform

| Platform                  | Path            | State                                                                                                                                                   |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone app (iOS + Android) | `apps/mobile`   | Expo 57 / RN 0.86, version 0.1.0. Android versionCode 3 on Play internal testing. iOS ships as the next version of App Store record `dat.waqtu.ios`.    |
| Mac app                   | `apps/apple`    | Swift menu-bar app, direct (Developer ID, Sparkle) and Mac App Store builds. 1.1.0 released May 2026; account, sync and Kemenag are in _Unreleased_.    |
| Web                       | `apps/web`      | Astro on Cloudflare: landing (id + en), blog, Mac page, compare, changelog, resources, privacy/terms/support, waitlist, Polar checkout + webhook.       |
| API                       | `services/api`  | Cloudflare Worker `waqt-updates` with D1 `waqtu-db` and R2: better-auth (Apple + Google), sync, circles, billing/entitlements, Sparkle appcast and DMG. |
| Shared logic              | `packages/core` | Prayer times, Hijri/Ramadhan, khatam plan, fidyah/zakat, recitation alignment engine; `bun test`.                                                       |
| Content                   | `content/`      | Quran text + metadata (Tanzil), Ramadhan 1448 halaqah program (draft, pending owner approval).                                                          |

The Expo app replaces the Swift iPhone app; the old Swift iOS widget and watch targets stay in
`apps/apple` for CI only and are not submitted again (`docs/backend-decision.md`).

## Shipped

### Phone app (`apps/mobile`)

- **Today / Week tabs**: prayer times, adhan reminders (exact alarms on Android), mutabaah checklist
  with custom amalan, streak with grace days, one-time import of the Swift app's iCloud streak.
- **Ramadhan tab**: imsak/iftar countdown (lock screen where supported), daily fasting, tarawih,
  tadarus and i'tikaf log, shareable imsakiyah; khatam planner that rebalances, qadha/fidyah and
  zakat fitrah (Premium).
- **Halaqah**: Ramadhan 1448 program with voice reflection, share to circle, daily nudge and optional
  amalan; shown in release builds only once its content is approved.
- **Circles**: small anonymous halaqah groups for reflections and voice notes, handles, invite codes,
  gender isolation (Premium).
- **Hafalan & murojaah**: targets with self-check and recordings kept out of iOS backups.
- **Account and sync**: optional sign-in (Apple, Google), offline-first SQLite with last-write-wins
  sync (Premium), in-app account deletion.
- **Premium paywall**: native IAP (`expo-iap`), server-verified; id (default) and en.
- **Store pipeline**: demo mode and Maestro screenshot workflow, store listing text in
  `apps/mobile/store/`.

### Mac app (`apps/apple`)

- Menu-bar countdown, full-screen reminders, adhan and calm sounds, calendar protection (Exchange,
  iCloud, Google), Slack status, location profiles, streak, onboarding (1.1.0).
- Unreleased: Kemenag RI method matching `@waqtu/core`, Waqtu account (Google; Apple in the MAS
  build), sync of the five fardhu and prayer settings, menu-bar fardhu checklist, Ramadhan countdown,
  Premium from the signed-in account (`GET /v1/entitlement`).

### API (`services/api`)

- Replaces the legacy `mutabaahapp-production` worker (decision in `docs/backend-decision.md`).
- Entitlements from App Store (JWS verified to Apple Root CA G3), Google Play (Android Publisher API +
  RTDN) and Polar (HMAC webhooks).

## Premium

One subscription unlocks the phone apps (iOS, Android) and the Mac app. Prayer times, adhan reminders,
imsakiyah and basic mutabaah stay free.

| Item         | Value                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------- |
| Premium-only | Sync across devices, circles, Ramadhan trackers (khatam, qadha/fidyah, zakat fitrah)     |
| App Store    | Group `Waqtu Premium`: `dat.waqtu.premium.monthly`, `dat.waqtu.premium.yearly`           |
| Google Play  | Subscription `premium`, base plans `monthly` and `yearly`                                |
| Prices (IDR) | Rp 29.000 / month, Rp 249.000 / year                                                     |
| Server       | `GET /v1/entitlement` answers `{ premium, source, expiresAt }` for the signed-in account |

Owner decisions of 25 Oct 2026: sync and circles are Premium; the Mac moves to the same subscription;
**no lifetime**, and the web stops selling lifetime. There are no paid users yet, so no lifetime buyers
need grandfathering. Store products are configured by the owner (README, _Store setup_).

## In flight

| Work                         | Scope                                                                                                                       | Status                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Premium cutover              | Mac licensing to subscription, remove lifetime from web and paywall                                                         | In progress                                                                                                       |
| Mac phase 2                  | Localization (id + en), full mutabaah, streak, imsakiyah, halaqah, hafalan, circles                                         | In progress                                                                                                       |
| On-device recitation check   | `whisper.rn` with `tarteel-ai/whisper-base-ar-quran` (ggml q8_0, ~82 MB, downloaded on first use); alignment engine in core | Engine and harness done; model not yet run on a phone (`docs/recitation/model-evaluation.md`)                     |
| Fiqh companion (four madhab) | RAG over classical texts with exact citations, never picks a side                                                           | Research only; after Ramadhan, after scholar review, pending licence decision (`docs/fiqh-companion/research.md`) |

## Open owner decisions

| Decision                 | What is needed                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Halaqah content approval | `content/halaqah/ramadhan-1448/program.json` is `draft-pending-owner-approval`; release builds hide it and posts leave it out until approved.                                  |
| Fiqh licence (D1)        | OpenITI is CC BY-NC-SA 4.0: keep the companion free, get OpenITI/KITAB permission, or a legal opinion. Until then it cannot be Premium. Also D2-D8 in the research doc.        |
| Recitation recordings    | 50 labelled murojaah recordings from Indonesian memorisers with written consent (kept off the repo), plus a mid-range Android device test, before the feature can be accepted. |
| Legacy backend accounts  | Confirm whether the 3 `mutabaahapp-production` accounts are real users (migration is manual if so).                                                                            |
