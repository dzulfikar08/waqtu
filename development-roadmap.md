# Waqtu Development Roadmap

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

## Phase 1: Strengthen Core (Now → 4 weeks)

### Critical
- [ ] Re-enable webhook signature verification (currently disabled in `src/app/api/payments/webhook/route.ts`)
- [ ] Add pre-prayer buffer notifications (10/15/20 min before) — top user request across Reddit
- [ ] Support multiple prayer calculation methods with per-madhab Asr settings (Hanafi vs Shafi'i)
- [ ] Add custom time offset per prayer to match local mosque times

### Polish
- [ ] Adhan audio notification option
- [ ] Improve onboarding flow — first-run location permission with clear explanation
- [ ] Add "next prayer" vs "current prayer" indicator in menu bar
- [ ] Hijri date display in menu bar dropdown

---

## Phase 2: Professional Features (4 → 10 weeks)

### Calendar & Work Integration
- [ ] Google Calendar integration (OAuth)
- [ ] Customizable calendar event titles and duration (e.g., "Prayer — Dhuhr" or just "Busy")
- [ ] Pre-prayer buffer in calendar (block 10 min before for preparation/wudu)
- [ ] Slack status integration — auto-set "Praying" during prayer times
- [ ] Teams status integration (if API allows)

### Workplace Advocacy
- [ ] Generate "prayer accommodation" email template for HR/managers (PrayerCal is building this)
- [ ] Add printable/forwardable "prayer times card" for sharing with colleagues

---

## Phase 3: Engagement & Retention (10 → 16 weeks)

### Prayer Habit Tracking
- [ ] Simple prayer log (prayed / missed per prayer)
- [ ] Weekly/monthly streak view
- [ ] Optional daily hadith or dua in the reminder overlay

### Notifications & Customization
- [ ] Custom notification sounds (calm alternatives to Adhan for office)
- [ ] Dark/light mode for the reminder overlay
- [ ] Multiple location profiles (office vs home vs traveling)

---

## Phase 4: Growth (16 → 24 weeks)

### Platform Expansion
- [ ] iOS companion app (share calendar events, view streaks)
- [ ] Apple Watch complications (prayer countdown on wrist) — frequently requested
- [ ] Widgets (macOS Notification Center, iOS home screen)

### Community
- [ ] Mosque time sync (partner with Mawaqit or similar for local mosque data)
- [ ] Congregation finder — see which colleagues also use Waqtu (opt-in)

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

**Waqtu's moat**: Only native Mac app that combines menu bar presence + calendar busy blocks + Teams integration. PrayerCal comes closest but has no native app, no reminders, no offline.
