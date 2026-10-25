# Changelog

## Unreleased

### Waqtu account and sync (DEV-13, Mac parity with the mobile app)

- **Waqtu account** — Settings → Account: Sign in with Google (system browser session) and, in the Mac App Store build, native Sign in with Apple. The session token lives in the Keychain; sign out ends it on the server too.
- **Sync** — The prayer log (five fardhu) and the prayer settings (calculation method, madhab, time adjustments) sync with the mobile app over `/v1/sync`, last-write-wins. Location is never uploaded.
- **Menu bar checklist** — "Today's prayers" shows the five fardhu; click one to mark it prayed (click again to undo). Edits sync in the background.
- **Ramadhan** — During Ramadhan the menu bar title counts down to iftar, or to imsak (fajr − 10 min) outside fasting hours. Follows the moon-sighting correction (`hijriOffset`) set on the phone. Can be turned off in Settings → Account.
- **Premium from the account** — An active Waqtu subscription (App Store, Play or Polar) on the signed-in account unlocks the Mac app (`GET /v1/entitlement`, refreshed on sign-in, launch and every sync; cached offline, cleared on sign-out).
- **Fix: non-Gregorian system calendars** — Prayer log day keys and Ramadhan detection always use Gregorian dates, so an Islamic, Buddhist or Japanese system calendar no longer writes Hijri-year keys into the synced log.
- **Fix: "still working" no longer erases the phone's record** — The "missed" the Mac infers after "I am going to pray" stays on this Mac and is never synced over a done/jamaah record made on the phone.
- **License** — Direct-download build: "Link license to account" attaches the Polar license to the signed-in account (hidden until the server offers it).
- Unit tests for the sync merge, mapping, settings whitelist and Ramadhan countdown run in CI (`xcodebuild test`, scheme `waqtu`).

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
