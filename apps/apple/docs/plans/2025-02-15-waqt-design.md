# Waqt Prayer Reminder App - Design Document

**Date:** 2025-02-15
**Status:** Approved

## Overview

A minimal macOS menu bar application that displays Islamic prayer times and shows a full-screen overlay at prayer time to encourage mindful pause.

## Requirements

### Core Features
1. **Menu Bar App** - MenuBarExtra with next prayer countdown
2. **Prayer Time Calculation** - Local calculation using Adhan library (MWL method)
3. **Full-Screen Overlay** - Blocking overlay at prayer time
4. **Settings** - Simple configuration panel

### Design Decisions
- **Calculation Method:** Muslim World League (MWL) only
- **Asr Method:** Shafi (standard)
- **Overlay Dismissal:** User button OR auto-dismiss after timeout (5-15 min)
- **Wake Behavior:** Skip missed prayers (don't trigger on wake)
- **Quranic Quote:** Single static quote

## Architecture

### Module Structure

```
waqt/
├── App/
│   ├── WaqtApp.swift              (MenuBarExtra entry point)
│   └── AppDelegate.swift          (for launch-at-login)
├── Core/
│   ├── PrayerTimeCalculator.swift (wraps Adhan library)
│   ├── LocationManager.swift      (CoreLocation delegate)
│   └── AppSettings.swift          (@AppStorage wrapper)
├── UI/
│   ├── MenuBarView.swift          (MenuBarExtra content)
│   ├── OverlayWindow.swift        (full-screen NSWindow)
│   ├── OverlayView.swift          (SwiftUI overlay content)
│   └── SettingsView.swift         (settings panel)
├── ViewModels/
│   └── AppViewModel.swift         (coordinates everything)
├── Models/
│   └── PrayerTime.swift           (data models)
└── Resources/
    └── Adhan (SPM package)
```

### Component Responsibilities

**PrayerTimeCalculator**
- Wraps Adhan library's `PrayerTimes`
- Input: coordinates, date
- Output: array of PrayerTime objects

**LocationManager**
- CoreLocation delegate
- Publishes: coordinates, permission status
- Manual location fallback

**AppViewModel**
- ObservableObject, central coordinator
- Calculates next prayer time
- Triggers overlay at prayer time
- Tracks shown prayers (once per prayer)
- Manages menu bar countdown timer

**OverlayWindow**
- NSWindow subclass
- Window level: .screenSaver
- Borderless, not closable via standard shortcuts
- Covers all screens

**AppSettings**
- @AppStorage wrapper
- Toggle: overlay enabled
- Slider: overlay duration (5-15 min)
- Toggle: auto-detect location
- Fields: manual lat/long
- Toggle: launch at login

## Data Models

```swift
struct PrayerTime: Identifiable, Comparable {
    let id: UUID
    let name: PrayerName
    let time: Date
    let hasPassed: Bool
}

enum PrayerName: String, CaseIterable {
    case fajr, dhuhr, asr, maghrib, isha
    var displayName: String { ... }
}
```

## Data Flow

```
App Launch
    ↓
LocationManager → coordinates
    ↓
PrayerTimeCalculator → today's prayer times
    ↓
AppViewModel → schedule next prayer timer
    ↓
Menu bar countdown updates
    ↓
Prayer time reached → OverlayWindow shows
    ↓
User dismisses OR timeout → overlay closes
    ↓
Schedule next prayer
```

## UI Design

### Menu Bar
- Icon: simple crescent moon (SF Symbol)
- Title: "Maghrib 12:34" (next prayer + time)
- Dropdown:
  - Today's prayer times list
  - Overlay toggle
  - Settings...
  - Quit

### Overlay
- Full screen, dark background (#1a1a1a)
- Large prayer name (60pt)
- Current time
- Countdown timer (large, red)
- Quranic quote: "Indeed, prayer is obligatory on the believers at the specified time." — Quran 4:103
- Button: "I am going to pray" (prominent, green)

### Settings
- Toggle: Enable overlay enforcement
- Slider: Overlay duration (5-15 minutes)
- Toggle: Auto-detect location
- Text fields: Latitude / Longitude (shown when auto-detect off)
- Toggle: Launch at login
- Static quote display

## Technical Specifications

### Dependencies
- **Adhan** (Swift Package Manager) - Prayer time calculations
- No other third-party dependencies

### macOS API Usage
- **MenuBarExtra** - Menu bar presence
- **CoreLocation** - Geolocation
- **NSWindow** - Overlay window
- **NSScreen** - Multi-monitor support
- **@AppStorage** - Settings persistence
- **Combine** - Reactive updates

### Deployment
- **Target:** macOS 14.0+
- **Architecture:** MVVM
- **Language:** Swift 5.9+
- **UI:** SwiftUI

## Error Handling

| Scenario | Handling |
|----------|----------|
| Location permission denied | Show settings, manual location fields highlighted |
| Calculation fails | Fallback to hardcoded reference times |
| Timer drift | Recalculate every minute |
| No internet | No impact - local calculation only |

## Security & Privacy

- Location data never leaves device
- No network calls
- No analytics
- Settings stored in UserDefaults (standard)

## Future Enhancements (Out of Scope)

- Multiple calculation methods
- Custom calculation parameters
- Adhan audio playback
- Prayer streak tracking
- Cloud sync
- Notification support
