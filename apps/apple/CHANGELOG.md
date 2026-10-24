# Changelog

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
