# Waqt Prayer Reminder App - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal but production-ready macOS menu bar prayer reminder app with SwiftUI

**Architecture:** MVVM with modular components (PrayerTimeCalculator, LocationManager, OverlayWindow, AppViewModel)

**Tech Stack:** Swift 5.9+, SwiftUI, Combine, Adhan library (SPM), CoreLocation

---

## Task 1: Add Adhan Package Dependency

**Files:**

- Modify: `waqt.xcodeproj/project.pbxproj` (via Xcode or manually)

**Step 1: Add Adhan Swift Package**

In Xcode:

1. File → Add Package Dependencies
2. URL: `https://github.com/azan/azan`
3. Or use: `https://github.com/batoulapps/Adhan-Swift`

For this implementation, we'll add the package URL to the project.

**Step 2: Verify package resolves**

Build: `Cmd+B` in Xcode
Expected: No errors, package resolves successfully

**Step 3: Commit**

```bash
git add waqt.xcodeproj
git commit -m "deps: add Adhan Swift package for prayer time calculations"
```

---

## Task 2: Create Data Models

**Files:**

- Create: `waqt/Models/PrayerTime.swift`
- Create: `waqt/Models/PrayerName.swift`

**Step 1: Create PrayerName enum**

```swift
import Foundation

enum PrayerName: String, CaseIterable, Identifiable {
    case fajr = "Fajr"
    case dhuhr = "Dhuhr"
    case asr = "Asr"
    case maghrib = "Maghrib"
    case isha = "Isha"

    var id: String { rawValue }

    var displayName: String { rawValue }

    var iconName: String {
        switch self {
        case .fajr: return "sunrise.fill"
        case .dhuhr: return "sun.max.fill"
        case .asr: return "sun.min.fill"
        case .maghrib: return "sunset.fill"
        case .isha: return "moon.fill"
        }
    }
}
```

**Step 2: Create PrayerTime model**

```swift
import Foundation

struct PrayerTime: Identifiable, Comparable {
    let id = UUID()
    let name: PrayerName
    let time: Date

    var hasPassed: Bool {
        time < Date()
    }

    static func < (lhs: PrayerTime, rhs: PrayerTime) -> Bool {
        lhs.time < rhs.time
    }
}
```

**Step 3: Create Models directory structure**

```bash
mkdir -p waqt/Models
```

**Step 4: Commit**

```bash
git add waqt/Models/
git commit -m "feat: add PrayerTime and PrayerName models"
```

---

## Task 3: Create AppSettings

**Files:**

- Create: `waqt/Core/AppSettings.swift`

**Step 1: Create AppSettings class**

```swift
import Foundation
import SwiftUI

@Observable
final class AppSettings {
    // Overlay settings
    var overlayEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "overlayEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "overlayEnabled") }
    }

    var overlayDuration: Int {
        get { UserDefaults.standard.integer(forKey: "overlayDuration") }
        set { UserDefaults.standard.set(newValue, forKey: "overlayDuration") }
    }

    // Location settings
    var autoDetectLocation: Bool {
        get { UserDefaults.standard.bool(forKey: "autoDetectLocation") }
        set { UserDefaults.standard.set(newValue, forKey: "autoDetectLocation") }
    }

    var manualLatitude: Double {
        get { UserDefaults.standard.double(forKey: "manualLatitude") }
        set { UserDefaults.standard.set(newValue, forKey: "manualLatitude") }
    }

    var manualLongitude: Double {
        get { UserDefaults.standard.double(forKey: "manualLongitude") }
        set { UserDefaults.standard.set(newValue, forKey: "manualLongitude") }
    }

    // Launch at login
    var launchAtLogin: Bool {
        get { UserDefaults.standard.bool(forKey: "launchAtLogin") }
        set { UserDefaults.standard.set(newValue, forKey: "launchAtLogin") }
    }

    // Quranic quote
    static let quranicQuote = "Indeed, prayer is obligatory on the believers at the specified time."
    static let quranicReference = "— Quran 4:103"

    init() {
        // Set default values if not set
        if !UserDefaults.standard.bool(forKey: "settingsInitialized") {
            UserDefaults.standard.set(true, forKey: "settingsInitialized")
            UserDefaults.standard.set(true, forKey: "overlayEnabled")
            UserDefaults.standard.set(10, forKey: "overlayDuration") // 10 minutes
            UserDefaults.standard.set(true, forKey: "autoDetectLocation")
            // Default: Mecca coordinates
            UserDefaults.standard.set(21.4225, forKey: "manualLatitude")
            UserDefaults.standard.set(39.8262, forKey: "manualLongitude")
        }
    }
}
```

**Step 2: Create Core directory**

```bash
mkdir -p waqt/Core
```

**Step 3: Commit**

```bash
git add waqt/Core/AppSettings.swift
git commit -m "feat: add AppSettings with UserDefaults persistence"
```

---

## Task 4: Create PrayerTimeCalculator

**Files:**

- Create: `waqt/Core/PrayerTimeCalculator.swift`

**Step 1: Create PrayerTimeCalculator**

```swift
import Foundation
import Adhan

final class PrayerTimeCalculator {
    private let settings: AppSettings

    init(settings: AppSettings) {
        self.settings = settings
    }

    func calculatePrayerTimes(for date: Date = Date()) -> [PrayerTime] {
        let coordinates = getCoordinates()
        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.year, .month, .day], from: date)

        let params = PrayerCalculationMethod.muslimWorldLeague.params
        let madhab = Madhab.shafi

        let prayerTimes = PrayerTimes(
            coordinates: coordinates,
            date: components,
            calculationParameters: params
        )

        var times: [PrayerTime] = []

        if let fajr = prayerTimes?.fajr {
            times.append(PrayerTime(name: .fajr, time: fajr))
        }
        if let dhuhr = prayerTimes?.dhuhr {
            times.append(PrayerTime(name: .dhuhr, time: dhuhr))
        }
        if let asr = prayerTimes?.asr {
            times.append(PrayerTime(name: .asr, time: asr))
        }
        if let maghrib = prayerTimes?.maghrib {
            times.append(PrayerTime(name: .maghrib, time: maghrib))
        }
        if let isha = prayerTimes?.isha {
            times.append(PrayerTime(name: .isha, time: isha))
        }

        return times
    }

    func getNextPrayer() -> PrayerTime? {
        let prayers = calculatePrayerTimes()
        return prayers.first { !$0.hasPassed }
    }

    private func getCoordinates() -> Coordinates {
        if settings.autoDetectLocation {
            // Will be provided by LocationManager
            return Coordinates(latitude: 21.4225, longitude: 39.8262)
        } else {
            return Coordinates(
                latitude: settings.manualLatitude,
                longitude: settings.manualLongitude
            )
        }
    }

    func updateCoordinates(_ coordinates: Coordinates) {
        // This will be called by LocationManager
        // Store temporarily for calculation
    }
}
```

**Step 2: Commit**

```bash
git add waqt/Core/PrayerTimeCalculator.swift
git commit -m "feat: add PrayerTimeCalculator using Adhan library"
```

---

## Task 5: Create LocationManager

**Files:**

- Create: `waqt/Core/LocationManager.swift`

**Step 1: Create LocationManager**

```swift
import Foundation
import CoreLocation
import Combine

final class LocationManager: NSObject, ObservableObject {
    private let locationManager = CLLocationManager()

    @Published var coordinates: Coordinates?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    override init() {
        super.init()
        setupLocationManager()
    }

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        locationManager.startUpdatingLocation()
    }

    func stopUpdating() {
        locationManager.stopUpdatingLocation()
    }
}

extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.first else { return }
        let coords = Coordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )
        coordinates = coords
        stopUpdating() // Got location, stop updating
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        authorizationStatus = status

        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdating()
        case .denied, .restricted:
            stopUpdating()
        default:
            break
        }
    }
}
```

**Step 2: Update PrayerTimeCalculator to work with LocationManager**

```swift
// Add to PrayerTimeCalculator class:
private var currentCoordinates: Coordinates?

func setCurrentCoordinates(_ coordinates: Coordinates?) {
    currentCoordinates = coordinates
}

// Modify getCoordinates():
private func getCoordinates() -> Coordinates {
    if settings.autoDetectLocation {
        return currentCoordinates ?? Coordinates(
            latitude: settings.manualLatitude,
            longitude: settings.manualLongitude
        )
    } else {
        return Coordinates(
            latitude: settings.manualLatitude,
            longitude: settings.manualLongitude
        )
    }
}
```

**Step 3: Commit**

```bash
git add waqt/Core/LocationManager.swift
git commit -m "feat: add LocationManager with CoreLocation"
```

---

## Task 6: Create OverlayWindow

**Files:**

- Create: `waqt/UI/OverlayWindow.swift`
- Create: `waqt/UI/OverlayView.swift`

**Step 1: Create OverlayWindow**

```swift
import AppKit
import SwiftUI

final class OverlayWindow: NSWindow {
    private var overlayTimer: Timer?

    init(durationMinutes: Int, onDismiss: @escaping () -> Void) {
        super.init(
            contentRect: NSScreen.main?.frame ?? .zero,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        setupWindow(durationMinutes: durationMinutes, onDismiss: onDismiss)
    }

    private func setupWindow(durationMinutes: Int, onDismiss: @escaping () -> Void) {
        // Window level - screenSaver ensures it's on top of everything
        level = .screenSaver

        // Make it cover all screens
        if let screen = NSScreen.main {
            setFrame(screen.visibleFrame, display: true)
        }

        // Make it non-resizable, non-movable
        isMovable = false
        isResizable = false

        // Don't show in dock
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        // Content view
        contentView = NSHostingView(rootView: OverlayView(
            durationMinutes: durationMinutes,
            onDismiss: { [weak self] in
                self?.close()
                onDismiss()
            }
        ))

        // Auto-dismiss timer
        overlayTimer = Timer.scheduledTimer(
            withTimeInterval: TimeInterval(durationMinutes * 60),
            repeats: false
        ) { [weak self] _ in
            self?.close()
            onDismiss()
        }
    }

    func show() {
        // Show on all screens
        for screen in NSScreen.screens {
            let window = OverlayWindow(
                durationMinutes: 10,
                onDismiss: { [weak self] in
                    self?.close()
                }
            )
            window.setFrame(screen.visibleFrame, display: true)
            window.makeKeyAndOrderFront(nil)
        }
        makeKeyAndOrderFront(nil)
    }

    override var canBecomeKey: Bool {
        return true
    }

    override var acceptsFirstResponder: Bool {
        return true
    }

    deinit {
        overlayTimer?.invalidate()
    }
}
```

**Step 2: Create OverlayView**

```swift
import SwiftUI

struct OverlayView: View {
    let durationMinutes: Int
    let onDismiss: () -> Void

    @State private var countdown: Int
    @State private var currentTime: String = ""
    @State private var currentPrayer: PrayerName = .maghrib

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(durationMinutes: Int, onDismiss: @escaping () -> Void) {
        self.durationMinutes = durationMinutes
        self.onDismiss = onDismiss
        self._countdown = State(initialValue: durationMinutes * 60)
    }

    var body: some View {
        ZStack {
            // Background
            Color(red: 0.1, green: 0.1, blue: 0.1)
                .ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // Prayer name
                Text(currentPrayer.displayName)
                    .font(.system(size: 72, weight: .bold))
                    .foregroundStyle(.white)

                // Current time
                Text(currentTime)
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(.secondary)

                // Countdown
                VStack(spacing: 8) {
                    Text("Overlay auto-dismisses in:")
                        .font(.title3)
                        .foregroundStyle(.secondary)

                    Text(countdownText)
                        .font(.system(size: 48, weight: .bold, design: .monospaced))
                        .foregroundStyle(.red)
                }

                Spacer()

                // Quranic quote
                VStack(spacing: 12) {
                    Text(AppSettings.quranicQuote)
                        .font(.title2)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    Text(AppSettings.quranicReference)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 40)

                // Dismiss button
                Button(action: onDismiss) {
                    Text("I am going to pray")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 40)
                        .padding(.vertical, 16)
                        .background(Color.green)
                        .cornerRadius(12)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 60)
            }
        }
        .onReceive(timer) { _ in
            updateCurrentTime()
            updateCountdown()
        }
        .onAppear {
            updateCurrentTime()
        }
    }

    private var countdownText: String {
        let minutes = countdown / 60
        let seconds = countdown % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func updateCurrentTime() {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        currentTime = formatter.string(from: Date())
    }

    private func updateCountdown() {
        if countdown > 0 {
            countdown -= 1
        }
    }
}
```

**Step 3: Create UI directory**

```bash
mkdir -p waqt/UI
```

**Step 4: Commit**

```bash
git add waqt/UI/OverlayWindow.swift waqt/UI/OverlayView.swift
git commit -m "feat: add full-screen overlay window and view"
```

---

## Task 7: Create MenuBarView

**Files:**

- Create: `waqt/UI/MenuBarView.swift`

**Step 1: Create MenuBarView**

```swift
import SwiftUI

struct MenuBarView: View {
    @State private var viewModel: AppViewModel
    @State private var showingSettings = false

    init(viewModel: AppViewModel) {
        self._viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Next prayer info
            if let nextPrayer = viewModel.nextPrayer {
                HStack {
                    Image(systemName: nextPrayer.name.iconName)
                    Text("\(nextPrayer.name.displayName): \(nextPrayer.time, style: .time)")
                    Spacer()
                    Text(countdownText)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
                .padding()
            } else {
                Text("Loading...")
                    .padding()
            }

            Divider()

            // Today's prayer times
            if !viewModel.todayPrayers.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(viewModel.todayPrayers) { prayer in
                        HStack {
                            Image(systemName: prayer.name.iconName)
                            Text(prayer.name.displayName)
                            Spacer()
                            Text(prayer.time, style: .time)
                                .foregroundStyle(prayer.hasPassed ? .secondary : .primary)
                        }
                    }
                }
                .padding()
            }

            Divider()

            // Overlay toggle
            Toggle("Enable Overlay", isOn: $viewModel.settings.overlayEnabled)
                .padding()

            Divider()

            // Settings button
            Button("Settings...") {
                showingSettings = true
            }
            .buttonStyle(.plain)
            .padding()

            // Quit
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.plain)
            .padding()
        }
        .frame(width: 250)
        .sheet(isPresented: $showingSettings) {
            SettingsView(settings: viewModel.settings)
        }
    }

    private var countdownText: String {
        guard let nextPrayer = viewModel.nextPrayer else { return "--:--" }
        let minutes = viewModel.countdown / 60
        let seconds = viewModel.countdown % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}
```

**Step 2: Commit**

```bash
git add waqt/UI/MenuBarView.swift
git commit -m "feat: add MenuBarView with prayer times and controls"
```

---

## Task 8: Create SettingsView

**Files:**

- Create: `waqt/UI/SettingsView.swift`

**Step 1: Create SettingsView**

```swift
import SwiftUI

struct SettingsView: View {
    @ObservedObject var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Header
            Text("Settings")
                .font(.title)
                .fontWeight(.bold)

            // Overlay settings
            Group {
                Toggle("Enable Overlay Enforcement", isOn: $settings.overlayEnabled)

                VStack(alignment: .leading) {
                    Text("Overlay Duration: \(settings.overlayDuration) minutes")
                        .font(.subheadline)

                    Slider(value: Binding(
                        get: { Double(settings.overlayDuration) },
                        set: { settings.overlayDuration = Int($0) }
                    ), in: 5...15, step: 1)
                }
                .padding(.leading, 16)
            }

            Divider()

            // Location settings
            Group {
                Toggle("Auto-detect Location", isOn: $settings.autoDetectLocation)

                if !settings.autoDetectLocation {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Latitude:")
                            TextField("Latitude", value: $settings.manualLatitude, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 120)
                        }

                        HStack {
                            Text("Longitude:")
                            TextField("Longitude", value: $settings.manualLongitude, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 120)
                        }
                    }
                    .padding(.leading, 16)
                }
            }

            Divider()

            // Launch at login
            Toggle("Launch at Login", isOn: $settings.launchAtLogin)

            Divider()

            // Quranic quote
            VStack(alignment: .leading, spacing: 8) {
                Text("Daily Quote")
                    .font(.headline)

                Text(AppSettings.quranicQuote)
                    .font(.body)
                    .foregroundStyle(.secondary)

                Text(AppSettings.quranicReference)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            // Close button
            HStack {
                Spacer()
                Button("Done") {
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 400, height: 500)
    }
}
```

**Step 2: Commit**

```bash
git add waqt/UI/SettingsView.swift
git commit -m "feat: add SettingsView with overlay and location options"
```

---

## Task 9: Create AppViewModel

**Files:**

- Create: `waqt/ViewModels/AppViewModel.swift`

**Step 1: Create ViewModels directory**

```bash
mkdir -p waqt/ViewModels
```

**Step 2: Create AppViewModel**

```swift
import Foundation
import Combine
import AppKit

@Observable
final class AppViewModel {
    let settings = AppSettings()
    let calculator: PrayerTimeCalculator
    let locationManager: LocationManager

    private var timer: Timer?
    private var shownPrayers: Set<String> = []

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: Int = 0
    var overlayWindow: NSWindow?

    init() {
        self.calculator = PrayerTimeCalculator(settings: settings)
        self.locationManager = LocationManager()

        setupLocationUpdates()
        calculatePrayers()
        setupTimer()
    }

    private func setupLocationUpdates() {
        locationManager.requestPermission()

        // Subscribe to location updates
        // Note: In real implementation, use Combine
        locationManager.$coordinates
            .compactMap { $0 }
            .sink { [weak self] coordinates in
                self?.calculator.setCurrentCoordinates(coordinates)
                self?.calculatePrayers()
            }
            .store(in: &cancellables)
    }

    private var cancellables = Set<AnyCancellable>()

    func calculatePrayers() {
        todayPrayers = calculator.calculatePrayerTimes()
        nextPrayer = calculator.getNextPrayer()
        updateCountdown()
    }

    private func setupTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateCountdown()
            self?.checkPrayerTime()
        }
    }

    private func updateCountdown() {
        guard let next = nextPrayer else {
            countdown = 0
            return
        }

        let now = Date()
        let diff = next.time.timeIntervalSince(now)

        if diff > 0 {
            countdown = Int(diff)
        } else {
            // Prayer time passed, find next
            calculatePrayers()
        }
    }

    private func checkPrayerTime() {
        guard settings.overlayEnabled,
              let next = nextPrayer else { return }

        let now = Date()
        let diff = abs(now.timeIntervalSince(next.time))

        // Trigger overlay if we're within 10 seconds of prayer time
        // and haven't shown this prayer yet
        if diff < 10 && !hasShownPrayer(next) {
            showOverlay(for: next)
            markPrayerAsShown(next)
        }
    }

    private func hasShownPrayer(_ prayer: PrayerTime) -> Bool {
        let key = prayerKey(for: prayer)
        return shownPrayers.contains(key)
    }

    private func markPrayerAsShown(_ prayer: PrayerTime) {
        let key = prayerKey(for: prayer)
        shownPrayers.insert(key)
    }

    private func prayerKey(for prayer: PrayerTime) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "\(formatter.string(from: prayer.time))-\(prayer.name.rawValue)"
    }

    private func showOverlay(for prayer: PrayerTime) {
        overlayWindow = OverlayWindow(durationMinutes: settings.overlayDuration) { [weak self] in
            self?.overlayWindow = nil
        }
        overlayWindow?.makeKeyAndOrderFront(nil)
    }

    func resetShownPrayers() {
        shownPrayers.removeAll()
    }
}
```

**Step 3: Commit**

```bash
git add waqt/ViewModels/AppViewModel.swift
git commit -m "feat: add AppViewModel with prayer tracking and overlay logic"
```

---

## Task 10: Update WaqtApp

**Files:**

- Modify: `waqt/waqtApp.swift`

**Step 1: Replace waqtApp.swift content**

```swift
import SwiftUI

@main
struct WaqtApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        // Empty - we use MenuBarExtra instead
    }
}
```

**Step 2: Create AppDelegate**

```swift
import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide dock icon
        NSApp.setActivationPolicy(.accessory)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}
```

**Step 3: Create AppDelegate file**

Create: `waqt/App/AppDelegate.swift`

```swift
import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide dock icon
        NSApp.setActivationPolicy(.accessory)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}
```

**Step 4: Update waqtApp.swift to use MenuBarExtra**

```swift
import SwiftUI

@main
struct WaqtApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var viewModel = AppViewModel()

    var body: some Scene {
        MenuBarExtra("Waqt", systemImage: "moon.fill") {
            MenuBarView(viewModel: viewModel)
        }
    }
}
```

**Step 5: Create App directory**

```bash
mkdir -p waqt/App
```

**Step 6: Commit**

```bash
git add waqt/waqtApp.swift waqt/App/AppDelegate.swift
git commit -m "feat: convert to MenuBarExtra app with dock icon hidden"
```

---

## Task 11: Delete unused files

**Files:**

- Delete: `waqt/ContentView.swift`

**Step 1: Remove ContentView**

```bash
rm waqt/ContentView.swift
```

**Step 2: Commit**

```bash
git add waqt/ContentView.swift
git commit -m "chore: remove unused ContentView"
```

---

## Task 12: Update Info.plist for Location Permissions

**Files:**

- Modify: `waqt/Info.plist` (via Xcode target settings)

**Step 1: Add location usage descriptions**

In Xcode:

1. Select waqt target
2. Info tab
3. Add:
   - Key: `NSLocationWhenInUseUsageDescription`
   - Value: "Waqt needs your location to calculate accurate prayer times."

**Step 2: Commit**

```bash
git add waqt/Info.plist
git commit -m "feat: add location permission description"
```

---

## Task 13: Build and Test

**Files:**

- None (testing)

**Step 1: Build the project**

Run: `Cmd+B` in Xcode
Expected: Build succeeds with no errors

**Step 2: Run the app**

Run: `Cmd+R` in Xcode
Expected:

- Menu bar icon appears
- Dropdown shows prayer times
- Settings can be opened

**Step 3: Test overlay manually**

Add a test button or modify next prayer time to trigger overlay
Expected:

- Full screen overlay appears
- Cannot be dismissed with standard shortcuts
- Button dismisses overlay
- Auto-dismisses after timeout

**Step 4: Commit final working version**

```bash
git add .
git commit -m "feat: complete Waqt prayer reminder app implementation"
```

---

## Task 14: Code Review and Cleanup

**Files:**

- All files

**Step 1: Review for issues**

Check:

- Memory leaks (weak self usage)
- Proper error handling
- Edge cases (midnight recalculation, etc.)
- Code consistency

**Step 2: Add midnight recalculation**

```swift
// In AppViewModel, add:
private func setupMidnightTimer() {
    let calendar = Calendar.current
    let now = Date()

    guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: now),
          let midnight = calendar.startOfDay(for: tomorrow) else {
        return
    }

    let timeUntilMidnight = midnight.timeIntervalSince(now)

    DispatchQueue.main.asyncAfter(deadline: .now() + timeUntilMidnight) { [weak self] in
        self?.resetShownPrayers()
        self?.calculatePrayers()
        self?.setupMidnightTimer()
    }
}
```

**Step 3: Final commit**

```bash
git add .
git commit -m "refactor: code cleanup and midnight recalculation"
```

---

## Testing Checklist

- [ ] Menu bar icon appears
- [ ] Prayer times display correctly
- [ ] Countdown updates every second
- [ ] Settings open and save
- [ ] Location permission requested
- [ ] Manual location works
- [ ] Overlay shows at prayer time
- [ ] Overlay covers all screens
- [ ] Overlay dismisses with button
- [ ] Overlay auto-dismisses after timeout
- [ ] Midnight recalculation works
- [ ] App launches at login (if enabled)

---

**Estimated Total Time:** 3-4 hours for implementation

**Next Step:** Use `superpowers:executing-plans` to implement this plan task-by-task.
