# Waqtu Development Roadmap

> **Last updated**: 6 May 2025
> **Overall progress**: Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 🚧 ~60%

---

## Current State (v1.0)

- macOS 12+ native menu bar app (Swift/SwiftUI)
- Prayer time countdown in menu bar
- Calendar protection (Exchange, iCloud, default calendar)
- Full-screen calm reminders
- Offline prayer time calculation
- Location-based (Core Location, never transmitted)
- Polar.sh payment, lifetime license ($9.99 regular, $2.99 intro)
- Landing page on Cloudflare (Next.js 16)

---

## Phase 1: Strengthen Core (Now → 4 weeks) ✅ COMPLETE

### Critical
- [x] Re-enable webhook signature verification (currently disabled in `src/app/api/payments/webhook/route.ts`) — Standard Webhooks HMAC verification active with Polar.sh
- [x] Add pre-prayer buffer notifications (10/15/20 min before) — top user request across Reddit
- [x] Support multiple prayer calculation methods with per-madhab Asr settings (Hanafi vs Shafi'i)
- [x] Add custom time offset per prayer to match local mosque times

### Polish
- [x] Adhan audio notification option
- [x] Improve onboarding flow — 4-step welcome walkthrough on first launch, explains privacy-first location
- [x] Add "next prayer" vs "current prayer" indicator in menu bar
- [x] Hijri date display in menu bar dropdown

---

## Phase 2: Professional Features (4 → 10 weeks) 🚧 IN PROGRESS

### Calendar & Work Integration
- [x] Google Calendar integration (OAuth) — GoogleCalendarManager built
- [x] Customizable calendar event titles and duration (e.g., "Prayer — Dhuhr" or just "Busy") — block duration slider in Settings
- [x] Pre-prayer buffer in calendar (block 0-10 min before for preparation/wudu) — slider in Calendar Protection settings
- [x] Slack status integration — auto-set "Praying" during prayer times via Keychain-backed token, auto-expires
- [~] Teams status integration — Microsoft Graph presence API requires admin-consented delegated permissions; impractical for individual Mac app

### Workplace Advocacy
- [x] Generate "prayer accommodation" email template for HR/managers — live at /resources/prayer-accommodation
- [x] Add printable/forwardable "prayer times card" for sharing with colleagues — live at /resources/prayer-times-card

---

## Phase 3: Engagement & Retention (10 → 16 weeks) 🚧 IN PROGRESS

### Prayer Habit Tracking
- [x] Simple prayer log (prayed / missed per prayer) — PrayerStreakManager with UserDefaults persistence
- [x] Weekly/monthly streak view — collapsible StreakReportView in menu bar with weekly mini-grid, current/best streak
- [x] Optional daily hadith or dua in the reminder overlay — Quranic quote + DailyHadithProvider
- [x] Post-prayer activity detection — monitors idle time after "I am going to pray"; sends reminder if user keeps working

### Notifications & Customization
- [x] Custom notification sounds (calm alternatives to Adhan for office) — CustomSoundManager
- [x] Dark/light mode for the reminder overlay — theme picker in Settings, warm cream light theme
- [x] Multiple location profiles (office vs home vs traveling) — LocationProfilesManager

---

## Phase 4: Growth (16 → 24 weeks) 🚧 IN PROGRESS

### ✅ 4.1 Apple Watch Complications (code complete, pending Xcode targets)
- 5 complication families: Graphic Corner, Graphic Circular, Graphic Rectangular, Modular Large, Modular Small
- Cached prayer times with once-daily refresh
- SharedDataBridge pushes data from Mac app

### ✅ 4.2 iOS Companion App (code complete, pending Xcode targets)
- Read-only companion — Today view, Streak view, Settings
- iCloud sync via NSUbiquitousKeyValueStore + shared app group
- Lock Screen / Home Screen widget (PrayerWidget)

### ✅ 4.3 macOS Widgets (code complete, pending Xcode target)
- Small: Next prayer countdown
- Medium: Countdown + prayer timeline
- Large: Weekly streak + prayer timeline
- WidgetKit with shared app group data source

### ⏳ 4.4 Mosque Time Sync (3–4 weeks, not started)
- **Scope**: Partner with Mawaqit or similar mosque time API to auto-sync mosque-specific jama'ah times
- **Flow**: User searches their mosque → Waqtu fetches official times → applies them as a "mosque profile" with auto-adjustments
- **Tech**: REST API integration, offline cache of mosque times (JSON)
- **Why now**: #1 complaint in research — "I can never match my local mosque times"
- **Key risk**: API availability and reliability. Plan fallback: manual mosque profile with user-entered offsets

#### 4.5 Congregation Finder (2–3 weeks, opt-in)
- **Scope**: Opt-in feature showing which colleagues in your Slack workspace or organization also use Waqtu
- **Privacy-first**: Only shows count of users, never names. Requires explicit opt-in
- **Why later**: Requires backend infrastructure. Evaluate after iOS app ships

### Phase 4 Execution Order

| Order | Item | Effort | Impact | Dependencies |
|-------|------|--------|--------|--------------|
| 1 | Apple Watch complications | 2–3 weeks | High | iOS companion (or standalone via WatchConnectivity) |
| 2 | iOS companion app | 6–8 weeks | High | iCloud sync setup |
| 3 | macOS widgets | 1–2 weeks | Medium | None |
| 4 | Mosque time sync | 3–4 weeks | High | API partner agreement |
| 5 | Congregation finder | 2–3 weeks | Low-Medium | Backend infra |

### Phase 4 Success Metrics
- iOS app: 500+ downloads in first month
- Watch complications: Mentioned in 3+ App Store reviews
- Mosque sync: 50+ mosques synced in first month
- Overall: 2,000+ total Waqtu users across all platforms

---

## Feature Prioritization Framework

| Priority | Signal |
|----------|--------|
| **Must** | Users actively complain about its absence |
| **Should** | Competitors have it, users mention wanting it |
| **Nice** | Differentiator that could attract new users |
| **Later** | No direct user demand yet, but strategic |

### Signals from Research (Reddit/Forums)
1. **Pre-prayer notifications** — mentioned by multiple users, offered by Minarah and Slack Prayer Reminder
2. **Mosque time sync** — "I can never get them to match my local mosques" (top complaint)
3. **No ads, no tracking** — Muslim Pro data scandal makes privacy a trust differentiator
4. **Apple Watch** — requested in nearly every "what app do you use" thread
5. **Prayer streaks** — Pillars users value this for consistency motivation
6. **Calendar integration** — Waqtu's killer feature; PrayerCal validates the need exists

---

## Competitive Landscape Quick Reference

| Competitor | Platform | Price | Key Differentiator |
|------------|----------|-------|--------------------|
| Sajda | macOS native | Free / $3.99 Pro | Open-source, modern, Adhan audio |
| Minarah | macOS 14+ | Free | Focus Mode (forced screen block) |
| Guidance | macOS + iOS | Free | Oldest, trusted, Apple Watch |
| PrayerCal | Web (ICS) | Free | Calendar-only, no native app |
| Athan Pro | macOS (Catalyst) | Free + IAP | Feature-bloated, mobile-first |
| Pillars | iOS only | Free / subscription | Clean, streaks, no Mac app |
| Muslim Pro | iOS/Android | Free + IAP | Privacy scandal, ad-heavy |

**Waqtu's moat**: Only native Mac app that combines menu bar presence + calendar busy blocks (Exchange/iCloud/Google) + prayer streak tracking + post-dismiss accountability. PrayerCal comes closest but has no native app, no reminders, no offline, no streaks.

---

## Features Built (Beyond Original Roadmap)

These were developed organically and not part of the initial plan:

- **Post-prayer activity detection**: After clicking "I am going to pray", polls system idle time for 5 min. If mouse/keyboard activity is detected, sends a gentle reminder notification. Uses `CGEventSource` API — no permissions needed.
- **Slack status integration**: Auto-sets user's Slack status to "Praying" during prayer times. Uses Slack's `users.profile.set` API with `status_expiration` for auto-clear. Keychain-backed User OAuth Token (users.profile:write scope). Configured via Settings → Slack tab with status text and emoji customization.
- **Slate blue secondary color palette**: `#6B8FAD` secondary accent used for snooze button and background glow. Dark variant `#5A7D9A`.
- **Refactored color system**: All inline `Color(red:green:blue:)` replaced with shared `Color.waqtu*` named constants.
