# Waqtu Development Documentation

> **Last updated**: May 2025
> **App version**: 1.0+

---

## Architecture

Waqtu is a native macOS menu bar app built with SwiftUI and AppKit.

### Tech Stack

- **UI**: SwiftUI (menu bar, settings, overlay) + AppKit (NSWindow, NSSound)
- **Prayer calculation**: [Adhan](https://github.com/batoulapps/adhan-swift) library
- **Calendar**: EventKit (Exchange, iCloud, Google Calendar via CalDAV)
- **Location**: CoreLocation (on-device only, never transmitted)
- **Updates**: Sparkle 2 (auto-update via Cloudflare Worker + R2)
- **Payments**: Polar.sh (lifetime license via webhook → license key generation)
- **Slack**: Slack Web API (`users.profile.set`)

### Project Structure

```
waqtu/
├── App/
│   └── AppDelegate.swift          # App lifecycle, onboarding, notifications
├── Core/
│   ├── AppSettings.swift          # All UserDefaults-backed settings
│   ├── CalendarManager.swift      # EventKit: create/delete prayer blocks
│   ├── GoogleCalendarManager.swift # Google Calendar OAuth integration
│   ├── LicenseManager.swift       # Polar.sh license validation
│   ├── LocationManager.swift      # CoreLocation wrapper
│   ├── LocationProfilesManager.swift # Multiple location profiles
│   ├── PrayerReminderScheduler.swift # UNNotification reminders
│   ├── PrayerStreakManager.swift  # Prayer log + streak tracking
│   ├── PrayerTimeCalculator.swift # Adhan library wrapper
│   ├── SlackManager.swift         # Slack status integration
│   ├── TrialManager.swift         # 7-day trial logic
│   ├── CustomSoundManager.swift   # Custom notification sounds
│   └── DailyHadithProvider.swift  # Daily hadith/dua
├── Models/
│   ├── PrayerName.swift           # Prayer enum (Fajr..Isha)
│   └── PrayerTime.swift           # Prayer time model
├── ViewModels/
│   └── AppViewModel.swift         # Main view model, orchestrates all features
├── UI/
│   ├── MenuBarView.swift          # Menu bar popover + all Settings tabs
│   ├── OverlayView.swift          # Full-screen prayer reminder overlay
│   ├── OverlayWindow.swift        # NSWindow wrapper for overlay
│   └── OnboardingView.swift       # First-run walkthrough
├── Resources/
│   ├── adhan.mp3 / azan1.mp3      # Audio files
│   └── public_ed25519.pem         # License verification key
└── Assets.xcassets/               # Icons, logo, accent color
```

---

## Feature Reference

### 1. Menu Bar Countdown

Shows next prayer name and countdown (e.g., "Dhuhr in 2h 15m") in the menu bar. The popover lists all 5 daily prayers with icons, shows passed prayers in muted style, highlights the next prayer with gold accent.

### 2. Prayer Time Calculation

13 calculation methods supported via the Adhan library:

- Muslim World League, ISNA, Egyptian General Authority, Umm al-Qura (Makkah), Karachi, Dubai, Qatar, Kuwait, Singapore, Tehran, Turkey (Diyanet), Moonsighting Committee, Custom angles

**Madhab**: Shafi (earlier Asr) or Hanafi (later Asr)
**High latitude rules**: Auto, Middle of the night, Seventh of the night, Twilight angle
**Per-prayer offsets**: ±60 minute adjustments per prayer to match local mosque

### 3. Calendar Protection

Creates "busy" events in the user's calendar during prayer times.

| Setting           | Range     | Default |
| ----------------- | --------- | ------- |
| Block duration    | 10–20 min | 10 min  |
| Pre-prayer buffer | 0–10 min  | 0 min   |
| 5-min reminder    | on/off    | off     |

**Supported calendars**: Exchange (Outlook/Teams), iCloud, Google Calendar (CalDAV), local. Target calendar is selectable.

**Event format**: "Prayer – Dhuhr" with `Availability: busy`, tagged "Created by Waqtu" in notes. Regenerated daily at midnight.

### 4. Full-Screen Prayer Reminder (Overlay)

A peaceful overlay appears at prayer time (if enabled):

| Setting     | Default      |
| ----------- | ------------ |
| Duration    | 5–15 min     |
| Adhan audio | Off          |
| Theme       | Dark / Light |

**Overlay content**:

- Prayer name (large bold text)
- Current time
- Circular countdown timer
- Snooze menu (5/10/15 min)
- "I am going to pray" dismiss button
- Quranic quote (4:103)

**Light theme**: Warm cream gradient (`#F5F0E8` → `#D8CEBA`) with dark text and soft glows. Dark theme: deep green gradient with light text.

### 5. Prayer Habit Tracking (Streaks)

- **Logs**: prayed / missed per prayer per day, stored in UserDefaults JSON
- **Streak**: consecutive days with all 5 prayers completed
- **Report**: collapsible section in menu bar popover showing:
  - Current streak + best streak
  - Today's prayer status (Prayed / Missed / —)
  - 7-day mini-grid (● all done, ◐ partial, ○ missed)
  - Weekly progress percentage

**Auto-logging**:

- Clicking "I am going to pray" → marks as prayed
- Activity monitor detects user still working → marks as missed

### 6. Post-Prayer Activity Monitor

After clicking "I am going to pray", polls system idle time via `CGEventSource.secondsSinceLastEventType` every 10 seconds for 5 minutes. If mouse/keyboard activity is detected, sends a gentle notification: _"Still at your Mac? You tapped 'I am going to pray' for Dhuhr but your Mac is still active."_

No permissions needed — uses public CGEventSource API.

### 7. Slack Status Integration

Automatically sets Slack status during prayer times.

**Setup** (Settings → Slack tab):

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create an app with scope: `users.profile:write`
3. Install to workspace
4. Copy User OAuth Token (starts with `xoxp-`)
5. Paste into Waqtu Settings → Connect
6. Enable "Auto-set Slack status"

**Configuration**:

| Setting      | Default   |
| ------------ | --------- |
| Status text  | "Praying" |
| Status emoji | `:pray:`  |

**How it works**:

- When prayer overlay appears → Slack status set to "Praying — Dhuhr" with configurable emoji
- Uses Slack's native `status_expiration` field — status auto-clears after block duration
- Token stored securely in macOS Keychain
- No OAuth complexity — manual token entry (standard for Mac utilities)

### 8. Notification Reminders

Pre-prayer notifications: _"Asr in 5 minutes"_ configurable at 5/10/15/30 minutes before. Uses `UNUserNotificationCenter` with custom sounds support via `CustomSoundManager`.

### 9. Location

Auto-detect via CoreLocation or manual coordinates. Location never leaves the device.

**Location profiles**: Multiple profiles for office, home, traveling.

### 10. License & Trial

- 7-day free trial
- Lifetime license via Polar.sh
- License key activation (offline validation via Ed25519 signature)
- Trial banner in menu bar (days remaining)

### 11. First-Run Onboarding

4-step walkthrough on first launch:

1. "Never Miss a Prayer" — menu bar presence
2. "Calendar Protection" — Teams/Outlook busy blocks
3. "Let Waqtu Know Where You Are" — privacy-first location
4. "Gentle Reminders" — overlay + audio

### 12. Color System

Named colors via `Color` extension for consistency:

| Name                 | Hex       | Use                                 |
| -------------------- | --------- | ----------------------------------- |
| `waqtuPrimary`       | `#4A8B6F` | Primary buttons, active states      |
| `waqtuLight`         | `#6BA888` | Gradients, lighter accent           |
| `waqtuDark`          | `#2D5F4C` | Dark accents, pill backgrounds      |
| `waqtuBackground`    | `#1A2E25` | Background surfaces                 |
| `waqtuGold`          | `#D4A574` | Highlights, next prayer             |
| `waqtuText`          | `#E8F0ED` | Primary text                        |
| `waqtuMuted`         | `#A8C9B8` | Secondary text, captions            |
| `waqtuSecondary`     | `#6B8FAD` | Slate blue secondary (snooze, glow) |
| `waqtuSecondaryDark` | `#5A7D9A` | Dark mode variant                   |

---

## Build & Deployment

### Requirements

- Xcode 16+
- macOS 12+ deployment target
- Swift 5

### Build

```bash
xcodebuild -project waqt.xcodeproj -scheme waqtu -destination 'platform=macOS' build
```

### Release

```bash
./scripts/release.sh
```

Creates a DMG, signs with Developer ID, uploads to Cloudflare R2, updates the Sparkle appcast.

### Landing Page

Next.js 16 site in `/waqtu-landing`:

```bash
npm run dev    # development
npm run build  # production build
```

Deployed to Cloudflare Pages.

---

## Remaining Work

| Item                      | Priority | Notes                                                                                              |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Teams status integration  | Low      | Microsoft Graph presence API requires admin-consented permissions — impractical for individual app |
| iOS companion app         | Phase 4  | Share calendar events, view streaks                                                                |
| Apple Watch complications | Phase 4  | Prayer countdown on wrist                                                                          |
| Widgets                   | Phase 4  | macOS Notification Center, iOS home screen                                                         |
| Mosque time sync          | Phase 4  | Partner with Mawaqit or similar                                                                    |
