# Changelog

## Unreleased

### Mac App Store

- **Free trial through the App Store** — The Mac App Store build no longer has its own 7-day trial kept in the Keychain (App Review Guidelines 3.1.1/3.1.2). Waqtu opens with Waqtu Premium: an App Store subscription (both `dat.waqtu.mac.premium.monthly` and `.yearly` carry a one-week free trial as their introductory offer) or premium on the signed-in Waqtu account. Without it the menu bar and Settings show the subscribe screen instead of trial banners, the "trial ending" sheet or "trial ended" copy. The direct-download build keeps its local 7-day trial unchanged.
- **Paywall** — Settings → Upgrade shows, per subscription, the price per period and, while the Apple ID is eligible, the free trial ("1 week free, then Rp 29.000/month"), plus auto-renewal terms, Restore Purchases and the Terms of Use and Privacy Policy (English pages, or the Indonesian ones when the app runs in Indonesian). `WaqtuProducts.storekit` gets the one-week free introductory offer on both products.
- **Reviewer sign-in** — Settings → Account (signed out) has the phone's quiet "App reviewer? Sign in with email" link (Indonesian: "Peninjau aplikasi? Masuk dengan email") under the Apple and Google buttons, in both builds. It opens an email and password form that signs in through better-auth `POST /api/auth/sign-in/email`; the server accepts only the store reviewer accounts, whose premium unlocks the app. Errors use the phone's wording.
- **Delete account** — Settings → Account → Delete account (signed in) deletes the Waqtu account and its server data after a confirmation, like the phone app.
- **Store build** — `release-mas.yml` archives `waqtu-mas` (now `Waqtu.app`), signs it with the Apple Distribution certificate and Mac App Store profiles, and uploads a signed .pkg; `store-submit.yml` (platform `mac`) fills the listing from `apps/apple/store` and submits it with the Mac subscriptions. The MAS build gets the location entitlement it needs under the sandbox, declares exempt encryption, and ships a full macOS icon set; the widget extension is sandboxed.

### Compact menu bar popover (DEV-17)

- **Fits a laptop screen** — The popover is about 500 pt tall by default (it used to run off the screen). Prayer rows are tighter; Hafalan, Circles and Worship (and Halaqah where released) are one row of buttons; the Pomodoro is one row with the time and Start inline; the footer is one row with Imsakiyah, Settings and Quit.
- **Mutabaah folds** — The five prayer chips stay; the other practices fold into a "3/8 more" row (Indonesian "3/8 lainnya") that opens them, and the choice is remembered. "Manage checklist" is the icon at the end of that row.
- **Overlay switch and test** — "Enable Overlay" and "Test Overlay" are only in Settings → General now, no longer rows in the menu.

### Ibadah tools on the Mac (DEV-17)

- **Menu bar → Ibadah (Indonesian) / Worship (English)** opens one window with the phone's Ibadah tools in a sidebar: qibla, Al-Ma'tsurat, dzikir pagi & petang, doa, tasbih and muhasabah. Everything works offline.
- **Qibla** — Bearing and distance to the Kaaba from the location the prayer times use (the detected fix, or the manual coordinates), with a dial that shows the direction against north. A Mac has no compass, so the dial does not turn. The bearing is `@waqtu/core`'s `qiblaBearing` (CI compares both against the same city figures; nothing is stored or sent).
- **Al-Ma'tsurat and dzikir** — Kubro and sughro, morning and evening, and the morning/evening dhikr with their hadith references, read from `content/adhkar` (bundled byte for byte; CI checks the SHA-256 pins the phone uses). A counter on every text counts down with each click (right-click resets it), progress is kept on this Mac for the day, and finishing a session offers to tick `dzikir_pagi` / `dzikir_petang` in today's mutabaah, which syncs to the phone like any other checklist edit.
- **Doa** — The 13 daily duas by category with search across title, transliteration, translation, Arabic and source, favourites, and the source shown with each dua.
- **Tasbih** — 33 · 33 · 34, 100 of one phrase or a free count with a target, undo, reset, trackpad haptics, and an optional "add to my own counter" for the mutabaah checklist. The count is kept between launches.
- **Muhasabah** — The daily reflection journal (two questions, four 1–10 ratings, an intention), a month calendar and the 30-day trend. On this Mac only by default: one file in Application Support, not part of the mutabaah sync, never sent anywhere.
- **Sync muhasabah to the cloud (opt-in)** — Settings → Account (signed in) has a "Sync muhasabah to the cloud" switch, off by default. Turned on, the journal is stored on Waqtu's servers tied to the account (`/v1/muhasabah`, whole day last-write-wins, deletions included) and follows you between this Mac and the phone (where it needs Premium); only the account can read it. The setting belongs to one account on this Mac: another account signing in finds it off. Turning it off stops syncing at once and offers to delete the cloud copy; "Delete cloud copy…" stays available while it is off. Entries on this Mac are never deleted by the switch. Deleting the account deletes the cloud copy too.
- Strings are in a catalog of their own (`waqtu/Resources/Ibadah.xcstrings`, Indonesian and English); CI checks it against the keys the views use and against the phone's copy (`apps/mobile/src/ibadah/strings.ts`).
- **Redesign** — The Worship window matches the app: the popover's deep green and gold on a dark window, a light paper version of them on a light one (shared `wq*` colour tokens, `waqtu/UI/WaqtuTheme.swift`, which also holds the palette that used to sit in `MenuBarView.swift`). The window runs up behind a transparent title bar, with the traffic lights over the sidebar; every tool has an opaque header (title, subtitle, controls) that content scrolls below, never under. The sidebar is branded: green selection with a filled icon, ⌘1–⌘6 for the six tools, and the "time for the morning dhikr" callout in gold with tinted buttons (green once the dzikir is recorded).
- **Readers** — Morning/evening and sughro/kubro are segmented controls in the header with "5/14 texts read", a progress ring and a progress line; the Latin and translation switches sit there too. Each text is a card with its number, a title (its own when it is unique in the session; otherwise the opening words of its translation, with the stored title above it, instead of "Text 13"), a gold repeat badge, the Arabic in Amiri Quran at 30 pt with comfortable line spacing, the transliteration in green, the translation, the source, and a counter button that fills as you recite, shows the number left in gold and turns into a green "Done". The next unfinished text scrolls into view after one finishes.
- **Sidebar and Doa lists respond** — The sidebar tagged its rows with `Optional(tool)` while a `List` with an optional selection matches non-optional tags, so no row ever matched and a click did nothing; the Doa list had the same bug. Both are plain buttons now, and the selection logic is covered by `IbadahNavigationTests`.
- **Settings → Upgrade and About respond** — The Settings window was a nine-tab system `TabView` in a 520 pt window, with Upgrade and About the last two tabs. The tab strip is now an explicit row of buttons (one per pane, setting the pane directly) in a 600 pt window wide enough for all nine, and About scrolls. The menu's Upgrade button and Circles' "Open settings" and "See Premium" open Settings (on the Upgrade or Account tab) through SwiftUI's `openSettings` action, handed over by the menu bar view (`SettingsOpener`), instead of sending the private `showSettingsWindow:` selector down the responder chain.

### Imsakiyah on the Mac (DEV-13)

- **Ramadhan month table** — Menu bar → Imsakiyah opens the table for the current or next Ramadhan: imsak (fajr − 10 min), Subuh, Dzuhur, Ashar, Maghrib, Isya for every day, today highlighted, with the start date, the day of Ramadhan and Idul Fitri. Uses the Mac's location, calculation method (incl. Kemenag), madhab, minute corrections and the moon-sighting correction synced from the phone; numbers match `@waqtu/core`'s `imsakiyahTable`.

### Same streak as the phone (DEV-13)

- **One streak rule everywhere** — The Mac's streak is now computed from the synced checklist with the phone's rules: a day counts when at least the chosen number of practices is recorded, missed days within the weekly grace are forgiven, and paused days (illness, travel, excuse) neither count nor break it. The old Mac-only rule (all five prayers every day, no grace) is gone, so both devices show the same number.
- **Streak settings sync** — Grace per week, the daily minimum and pauses live in Settings → Mutabaah and in the menu bar, stored in the account's `streak` setting shared with the phone.
- Widgets keep the five-prayer dots; their streak numbers follow the new rule.

### Full mutabaah checklist on the Mac (DEV-13)

- **Every practice** — The menu bar shows the whole mutabaah checklist, not only the five fardhu: rawatib, dhuha, tahajjud, tilawah pages, dzikir pagi/petang, sedekah, puasa sunnah, and your own practices. Fardhu chips mark a prayer done on time; right-click toggles on time, in congregation (jamaah) or made up (qadha), the same flags as the phone.
- **Any day** — Step back through previous days or pick one from a calendar to fill in what you missed.
- **Settings → Mutabaah** — Remove practices, add built-ins back (including halaqah and murojaah), or create your own checkbox or counter practice.
- **Same data as the phone** — Entries and the item list are stored with the phone's item ids, values and `items` setting, so edits made on either device show up on the other after sync. Works signed out too; the checklist uploads on the first sign-in.

### Bahasa Indonesia (DEV-13)

- **Indonesian and English** — The Mac app's menu bar, settings, onboarding, overlay and notifications are translated into Indonesian through a String Catalog (`waqtu/Localizable.xcstrings`). Macs set to Indonesian get Indonesian; everything else stays English. Prayer and mutabaah terms match the mobile app (Subuh, Dzuhur, Ashar, Maghrib, Isya; Istiqamah; Berbuka/Imsak).

### Waqtu Premium subscription replaces lifetime (DEV-12, DEV-13)

- **Mac App Store build** — The lifetime purchase (`dat.waqtu.lifetime`) is replaced by the auto-renewing subscriptions `dat.waqtu.mac.premium.monthly` and `.yearly` (StoreKit 2: purchase, restore, `Transaction.updates`, `currentEntitlements`). Each active subscription is also sent to the signed-in Waqtu account (`POST /v1/billing/apple`), so it unlocks the phone apps too. Settings → Upgrade shows the prices from the App Store, Restore Purchases, Manage Subscription, terms and privacy links.
- **Direct-download build** — The Polar license-key purchase and activation UI are gone. After the 7-day trial, Waqtu unlocks with a Waqtu account that holds a subscription bought on iPhone or Android; the Upgrade screen links to both apps and has an Account tab to sign in.
- Settings → Account shows whether the account has Waqtu Premium, with "Check again".

### Kemenag on the Mac (DEV-6)

- **Kemenag RI method** — New "Kemenag RI (Indonesia)" method (Fajr 20°, Isha 18°, ihtiyat, rounding up), identical to the mobile app. A phone set to Kemenag now syncs as Kemenag instead of being mapped to Singapore (which was 2–4 min off). CI compares the app's own calculator against `@waqtu/core` for Kemenag and MWL.

### Waqtu account and sync (DEV-13, Mac parity with the mobile app)

- **Waqtu account** — Settings → Account: Sign in with Google (system browser session) and, in the Mac App Store build, native Sign in with Apple. The session token lives in the Keychain; sign out ends it on the server too.
- **Sync** — The prayer log (five fardhu) and the prayer settings (calculation method, madhab, time adjustments) sync with the mobile app over `/v1/sync`, last-write-wins. Location is never uploaded.
- **Menu bar checklist** — "Today's prayers" shows the five fardhu; click one to mark it prayed (click again to undo). Edits sync in the background.
- **Ramadhan** — During Ramadhan the menu bar title counts down to iftar, or to imsak (fajr − 10 min) outside fasting hours. Follows the moon-sighting correction (`hijriOffset`) set on the phone. Can be turned off in Settings → Account.
- **Premium from the account** — An active Waqtu subscription (App Store, Play or Polar) on the signed-in account unlocks the Mac app (`GET /v1/entitlement`, refreshed on sign-in, launch and every sync; cached offline, cleared on sign-out).
- **Fix: non-Gregorian system calendars** — Prayer log day keys and Ramadhan detection always use Gregorian dates, so an Islamic, Buddhist or Japanese system calendar no longer writes Hijri-year keys into the synced log.
- **Fix: "still working" no longer erases the phone's record** — The "missed" the Mac infers after "I am going to pray" stays on this Mac and is never synced over a done/jamaah record made on the phone.
- Unit tests for the sync merge, mapping, settings whitelist and Ramadhan countdown run in CI (`xcodebuild test`, scheme `waqtu`).
- Imsakiyah engine for the Ramadhan month table: Hijri month start/length, current-or-next Ramadhan and the daily imsak…isha table, ported from `@waqtu/core` and tested in CI against fixtures generated from it (`scripts/imsakiyah-fixtures.ts`).

## 1.1.0 (May 2026)

### New Features

- **Slack status integration** — Auto-set "Praying" status during prayer times with configurable emoji and text. Uses Slack's native `status_expiration` for auto-clear. Token stored in macOS Keychain.
- **Pre-prayer calendar buffer** — Start calendar blocks 0–10 minutes before prayer time for wudu and preparation.
- **Dark/light overlay theme** — Toggle between dark (green gradient) and light (warm cream) themes for the prayer reminder overlay.
- **Prayer streak tracking** — Automatic prayer log with streak counter. Collapsible report in menu bar showing current/best streaks, today's status, weekly heatmap.
- **Post-prayer activity detection** — After clicking "I am going to pray", monitors system idle time for 5 minutes. Sends gentle reminder if user stays at their Mac.
- **First-run onboarding** — 4-step welcome walkthrough explaining menu bar, calendar protection, privacy, and reminders.
- **Google Calendar integration** — OAuth-based Google Calendar support for prayer blocks.
- **Custom notification sounds** — Calm alternatives to Adhan for office environments.
- **Multiple location profiles** — Switch between office, home, and traveling locations.
- **Daily hadith/dua** — Quranic quote displayed in prayer overlay.

### Improvements

- Refactored color system: all inline colors replaced with shared `Color.waqtu*` constants
- Added slate blue secondary color (`#6B8FAD`) for UI accents
- Snooze button now uses secondary color for visual distinction

### Settings

- **Slack tab**: Enable/disable, token management, status text and emoji customization
- **General tab**: Overlay theme picker (Dark / Light)
- **Calendar Protection**: Pre-prayer buffer slider (0–10 min)

---

## 1.0.0 (March 2026)

### Initial Release

- Prayer time countdown in macOS menu bar
- 13 prayer time calculation methods (MWL, ISNA, Egyptian, Umm al-Qura, Karachi, Dubai, Qatar, Kuwait, Singapore, Tehran, Turkey, Moonsighting Committee, Custom)
- Hanafi and Shafi'i Asr calculation
- Per-prayer minute adjustments (-60 to +60)
- Calendar protection: automatic busy blocks in Exchange, iCloud, Google Calendar
- Full-screen prayer reminder overlay with circular countdown timer
- Pre-prayer notification reminders (5/10/15/30 min before)
- Adhan audio playback (Fajr: full adhan, others: azan)
- Snooze functionality (5/10/15 minutes)
- Hijri date display in menu bar
- Offline prayer calculation (no internet required)
- Location privacy (coordinates never leave device)
- 7-day free trial with lifetime license ($9.99)
- Sparkle auto-updates via Cloudflare R2
- Polar.sh payment integration
- macOS 12+ support
