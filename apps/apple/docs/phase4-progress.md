# Phase 4 Implementation Progress

> **Last updated**: 21 July 2026  
> **Status**: ✅ Phase 4.1–4.3 complete + App Store submission work done (iOS/watch/macOS). 4.4–4.5 deferred.

---

## Completed: Shared Framework (`shared/`)

New cross-platform framework used by macOS, iOS, watchOS targets:

| File | Purpose |
|------|---------|
| `shared/Models/PrayerName.swift` | Shared prayer enum (Codable, short names for watch) |
| `shared/Models/PrayerTime.swift` | Shared prayer time model + `PrayerTimesPayload` for transfer |
| `shared/Core/SharedPrayerCalculator.swift` | Prayer calculation wrapper (Adhan on iOS/macOS, nil on watchOS) |
| `shared/Core/SharedSettings.swift` | iCloud-synced settings subset |
| `shared/Core/StreakSyncManager.swift` | Streak data sync via `NSUbiquitousKeyValueStore` |
| `shared/Core/SharedDataBridge.swift` | Mac → app group data push for widgets/iOS/watch |
| `shared/Resources/WaqtuColors.swift` | Shared color palette |

---

## ✅ Phase 4.1: Apple Watch Complications

| File | Purpose |
|------|---------|
| `watch/App/WaqtuWatchApp.swift` | Watch app entry point |
| `watch/ViewModels/WatchViewModel.swift` | Loads cached times, refreshes daily, pushes to complications |
| `watch/Views/WatchContentView.swift` | Next prayer countdown + prayer list |
| `watch/Complications/WaqtuComplications.swift` | 5 complication families |

**Complication families supported:**
- **Graphic Corner**: Prayer name + icon
- **Graphic Circular**: Icon + countdown minutes
- **Graphic Rectangular**: Full detail (icon, name, countdown)
- **Modular Large**: Next prayer + countdown + time + location
- **Modular Small**: Icon + minutes

**Data flow**: Mac app → SharedDataBridge → app group UserDefaults → watch reads cached payload. Watch recalculates locally once daily.

---

## ✅ Phase 4.2: iOS Companion App

| File | Purpose |
|------|---------|
| `ios/App/WaqtuIOSApp.swift` | iOS app entry point |
| `ios/ViewModels/IOSAppViewModel.swift` | Prayer times, streaks, settings from iCloud |
| `ios/Views/ContentView.swift` | Tab-based navigation (Today / Streaks / Settings) |
| `ios/Views/TodayView.swift` | Prayer times list + next prayer countdown card |
| `ios/Views/StreakView.swift` | Streak stats + weekly heatmap + today progress |
| `ios/Views/SettingsView.swift` | Calculation method, adjustments, sync status |

**Scope**: Read-only companion. No location, no calendar blocking, no overlay.

---

## ✅ Phase 4.3: macOS Widgets

| File | Purpose |
|------|---------|
| `macos-widget/MacPrayerWidget.swift` | Notification Center widgets for macOS 14+ |

**Widget sizes:**
- **Small**: Next prayer countdown
- **Medium**: Next prayer countdown + today's prayer timeline
- **Large**: Weekly streak + prayer timeline + next prayer

**Data flow**: SharedDataBridge → app group UserDefaults → WidgetKit timeline provider

---

## ⏳ Pending: Phase 4.4 — Mosque Time Sync (3–4 weeks)

### What needs to be built:
1. **API Integration** — Partner with Mawaqit API or similar mosque time service
   - Search mosques by name/location
   - Fetch official jama'ah times
   - Offline cache as JSON
2. **Mosque Profile Model** — New `MosqueProfile` struct with:
   - Mosque name, address, coordinates
   - Jama'ah time offsets per prayer
   - Last sync timestamp
   - Auto-apply to prayer calculations
3. **UI** — Settings tab for mosque search and selection
4. **Sync Manager** — `MosqueSyncManager` that fetches and caches

### Key risks:
- API availability and reliability (need partnership or fallback)
- Fallback: Manual mosque profile with user-entered offsets

---

## ⏳ Pending: Phase 4.5 — Congregation Finder (2–3 weeks)

### What needs to be built:
1. **Backend Infrastructure** — Cloudflare Worker or similar
   - Anonymous opt-in registration
   - Count-only queries (never reveal names)
   - Privacy-first design
2. **Mac App Integration** — Optional opt-in toggle
3. **UI** — "X colleagues also use Waqtu" in menu bar
4. **Slack Workspace Detection** — Optional integration

### Key risks:
- Requires backend infrastructure
- Privacy concerns require careful design
- Low-medium impact — evaluate after iOS app ships

---

## Integration Steps for Mac App

The main `AppViewModel` needs these additions to push data to shared container:

```swift
// In AppViewModel, add:
let sharedBridge = SharedDataBridge()

// After calculatePrayers():
func calculatePrayers() {
    todayPrayers = calculator.calculatePrayerTimes()
    nextPrayer = calculator.getNextPrayer()
    updateCountdown()
    reminderScheduler.scheduleReminders(for: todayPrayers)
    
    // Push to shared container for widgets/iOS/watch
    sharedBridge.pushPrayerTimes(
        prayers: todayPrayers,
        locationLabel: locationDisplay,
        calculationMethod: settings.calculationMethod
    )
    sharedBridge.pushWatchComplicationData(
        nextPrayer: nextPrayer,
        locationLabel: locationDisplay
    )
}

// After streak changes:
func pushStreaksToShared() {
    sharedBridge.pushStreakData(
        currentStreak: streakManager.currentStreak,
        bestStreak: streakManager.bestStreak,
        todayPrayed: streakManager.todayPrayedCount,
        weeklyGrid: streakManager.weeklyGrid.map { 
            StreakData.DayDot(
                date: "",
                label: $0.label,
                status: dotStatus($0.status),
                isToday: $0.isToday
            )
        }
    )
}
```

---

## App Store Submission — Status (21 July 2026)

All 7 targets compile (Debug). Foundation blockers resolved.

### ✅ Done (code + project)
- **App icons** — iOS (`ios/Assets.xcassets`), watchOS (`watch/Assets.xcassets`), macOS (cleaned `AppIcon.appiconset`, single 1024). Widgets get AccentColor.
- **Entitlements** — created missing `ios-widget/ios-widget.entitlements`; standardized iCloud KV-store id to `$(TeamIdentifierPrefix)dat.waqtu` across iOS/watch/widgets (fixes Mac↔iOS sync).
- **Widget entry points** — `@main` added to `WaqtuWidgets` (iOS) and `MacWaqtuWidgets` (macOS).
- **Shared schemes** — `waqtu`, `waqtu-ios`, `waqtu-watch`, `waqtu-widget`, `waqtu-mac-widget`, `waqtu-mas`.
- **SharedDataBridge wired** — `pushToSharedContainer()` called from `calculatePrayers`, `showOverlay`, `startPostDismissActivityMonitor`.
- **Mac App Store variant** (`waqtu-mas` target, bundle `dat.waqtu`):
  - Sparkle excluded via `#if canImport(Sparkle)` (waqtuApp.swift, AppDelegate.swift).
  - StoreKit 2 IAP replaces Polar (`LicenseManager.swift`, `#if MAS`); purchase/restore UI in `MenuBarView.swift` (`UpgradeSettingsTab`, `UpgradeFullScreenView`). No `getwaqtu.com` links in MAS build.
  - Sandbox + network.client + calendar + app-group + ubiquity entitlements (`waqtu-mas/waqtu-mas.entitlements`); `LSUIElement=YES`; `SWIFT_ACTIVE_COMPILATION_CONDITIONS=MAS`.
- **Privacy policy** — `docs/PRIVACY.md`.

### ⏳ External (you — App Store Connect / signing)
- **iOS/watch**: ASC record `dat.waqtu.ios`; host privacy policy (e.g. getwaqtu.com/privacy); screenshots; archive `waqtu-ios` → TestFlight → submit.
- **MAS**: ASC MAS record (`dat.waqtu`); In-App Purchase non-consumable **`dat.waqtu.lifetime`** (must match code exactly); App Group + iCloud capability registered; Apple Distribution cert; local `.storekit` for Sandbox testing; archive `waqtu-mas` → TestFlight → submit.
- **Note**: direct-distribution `waqtu` build is unchanged (Sparkle + Polar). Known flaky Sparkle-framework embed step in CLI builds resolves in Xcode IDE; app ships fine.

### Known limitations / deferred
- Phase 4.4 Mosque Sync, 4.5 Congregation Finder — deferred, not blocking launch.
- Google Calendar (clientId empty) left dormant on MAS — needs `CFBundleURLTypes` for `dat.waqtu` scheme when enabled.

## Next Actions

1. Create ASC records + IAP product `dat.waqtu.lifetime`
2. Host privacy policy; add screenshots
3. Archive + upload each scheme with distribution signing
4. (Later) Phase 4.4 Mosque Time Sync
