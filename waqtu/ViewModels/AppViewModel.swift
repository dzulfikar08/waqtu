import Foundation
import Combine
import AppKit
import CoreLocation

@Observable
final class AppViewModel {
    var settings: AppSettings
    let calculator: PrayerTimeCalculator
    let reminderScheduler: PrayerReminderScheduler
    let locationManager: LocationManager
    let calendarManager: CalendarManager
    let trialManager: TrialManager
    let licenseManager: LicenseManager

    private var timer: Timer?
    private var snoozeTimer: Timer?
    private var shownPrayers: Set<String> = []
    private var lastShownPrayerForSnooze: PrayerTime?

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: Int = 0
    var overlayWindow: NSWindow?

    /// Human-readable location used for prayer times (city, country or "Manual: Mecca").
    var locationDisplay: String = "Getting location..."

    /// True while a "Locate Me" refresh is in progress.
    var isRefreshingLocation: Bool = false

    /// True while calendar access is being refreshed.
    var isRefreshingCalendarAccess: Bool = false

    /// Full access: trial active, trial used (legacy), or valid license.
    var hasAccess: Bool {
        trialManager.hasAccess || licenseManager.isLicensed
    }

    private var cancellables = Set<AnyCancellable>()

    init(trialManager: TrialManager = TrialManager(), licenseManager: LicenseManager = LicenseManager()) {
        let settings = AppSettings()
        self.settings = settings
        self.trialManager = trialManager
        self.licenseManager = licenseManager
        self.calculator = PrayerTimeCalculator(settings: settings)
        self.reminderScheduler = PrayerReminderScheduler(settings: settings)
        self.locationManager = LocationManager()
        self.calendarManager = CalendarManager()
        setupLocationUpdates()
        calculatePrayers()
        setupTimer()
        // If calendar protection was already on, request access and regenerate today’s events (e.g. after relaunch)
        if settings.calendarProtectionEnabled {
            requestCalendarAccessAndRegenerate()
        }
        Task { @MainActor in
            await licenseManager.validate()
        }
    }

    private func setupLocationUpdates() {
        locationManager.requestPermission()
        locationManager.$coordinates
            .compactMap { $0 }
            .sink { [weak self] coordinates in
                self?.calculator.setCurrentCoordinates(coordinates)
                self?.calculatePrayers()
                self?.updateLocationDisplay()
            }
            .store(in: &cancellables)

        locationManager.$isRefreshing
            .receive(on: DispatchQueue.main)
            .sink { [weak self] refreshing in
                self?.isRefreshingLocation = refreshing
                if !refreshing {
                    self?.updateLocationDisplay()
                }
            }
            .store(in: &cancellables)

        // Listen for manual location changes from settings
        NotificationCenter.default.publisher(for: Notification.Name("locationChanged"))
            .sink { [weak self] _ in
                self?.calculatePrayers()
                self?.updateLocationDisplay()
            }
            .store(in: &cancellables)

        // Regenerate calendar events when user changes calendar protection settings
        NotificationCenter.default.publisher(for: Notification.Name("calendarProtectionSettingsChanged"))
            .sink { [weak self] _ in
                self?.regenerateCalendarEventsIfEnabled()
            }
            .store(in: &cancellables)

        // Recalculate prayers when user changes prayer time settings
        NotificationCenter.default.publisher(for: Notification.Name("prayerTimeSettingsChanged"))
            .sink { [weak self] _ in
                self?.calculatePrayers()
            }
            .store(in: &cancellables)

        // Initial location display
        updateLocationDisplay()
    }

    /// Forces a fresh location fix. Call when user taps "Locate Me".
    func refreshLocation() {
        guard settings.autoDetectLocation else { return }
        locationDisplay = "Updating..."
        locationManager.refreshLocation()
    }

    private func updateLocationDisplay() {
        let location: CLLocation
        if settings.autoDetectLocation {
            if let loc = locationManager.locationForGeocoding {
                location = loc
            } else {
                // Use manual fallback (same as prayer calculator) so we show something instead of stuck "Getting location..."
                location = CLLocation(
                    latitude: settings.manualLatitude,
                    longitude: settings.manualLongitude
                )
            }
        } else {
            location = CLLocation(
                latitude: settings.manualLatitude,
                longitude: settings.manualLongitude
            )
        }
        let geocoder = CLGeocoder()

        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            guard let self else { return }
            Task { @MainActor in
                let lat = location.coordinate.latitude
                let lon = location.coordinate.longitude
                if let place = placemarks?.first {
                    let city = place.locality ?? place.administrativeArea ?? place.subAdministrativeArea
                    let country = place.country
                    if let city, let country {
                        self.locationDisplay = "\(city), \(country)"
                    } else if let city {
                        self.locationDisplay = city
                    } else if let country {
                        self.locationDisplay = country
                    } else {
                        self.locationDisplay = self.formatCoordinates(lat: lat, lon: lon)
                    }
                } else {
                    self.locationDisplay = self.settings.autoDetectLocation
                        ? "Location unavailable"
                        : self.formatCoordinates(lat: lat, lon: lon)
                }
            }
        }
    }

    private func formatCoordinates(lat: Double, lon: Double) -> String {
        let latDir = lat >= 0 ? "N" : "S"
        let lonDir = lon >= 0 ? "E" : "W"
        return String(format: "%.2f°%@, %.2f°%@", abs(lat), latDir, abs(lon), lonDir)
    }

    func calculatePrayers() {
        todayPrayers = calculator.calculatePrayerTimes()
        nextPrayer = calculator.getNextPrayer()
        updateCountdown()
        // Schedule \"Asr in 5 minutes\"-style notifications
        reminderScheduler.scheduleReminders(for: todayPrayers)
    }

    private func setupTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateCountdown()
            self?.checkPrayerTime()
        }
        setupMidnightTimer()
    }

    private func setupMidnightTimer() {
        let calendar = Calendar.current
        let now = Date()

        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) else {
            return
        }
        let midnight = calendar.startOfDay(for: tomorrow)

        let timeUntilMidnight = midnight.timeIntervalSince(now)

        DispatchQueue.main.asyncAfter(deadline: .now() + timeUntilMidnight) { [weak self] in
            self?.resetShownPrayers()
            self?.calculatePrayers()
            self?.regenerateCalendarEventsIfEnabled()
            self?.setupMidnightTimer()
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
            calculatePrayers()
        }
    }

    private func checkPrayerTime() {
        guard settings.overlayEnabled,
              let next = nextPrayer else { return }
        let now = Date()
        let diff = abs(now.timeIntervalSince(next.time))
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
        // Close any existing overlay first
        if let existing = overlayWindow {
            overlayWindow = nil  // Clear reference BEFORE closing
            existing.close()      // Then close
        }

        lastShownPrayerForSnooze = prayer

        let newWindow = OverlayWindow(
            prayerName: prayer.name,
            durationMinutes: settings.overlayDuration,
            playAdhanSound: settings.overlayPlayAdhanSound,
            onDismiss: { [weak self] in
                self?.overlayWindow = nil
            },
            onSnooze: { [weak self] minutes in
                self?.scheduleOverlaySnooze(minutes: minutes)
            }
        )
        overlayWindow = newWindow
        newWindow.makeKeyAndOrderFront(nil)
    }

    private func scheduleOverlaySnooze(minutes: Int) {
        snoozeTimer?.invalidate()
        snoozeTimer = nil

        guard let prayer = lastShownPrayerForSnooze else { return }

        snoozeTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(minutes * 60), repeats: false) { [weak self] _ in
            self?.snoozeTimer = nil
            DispatchQueue.main.async {
                self?.showOverlay(for: prayer)
            }
        }
    }

    func resetShownPrayers() {
        shownPrayers.removeAll()
    }

    func rescheduleReminderNotifications() {
        reminderScheduler.scheduleReminders(for: todayPrayers)
    }

    // MARK: - Calendar Protection

    /// Request calendar access and regenerate today's prayer events. Call when user enables the feature or at midnight.
    /// - Parameter completion: Called on the main actor after the request finishes (granted or denied). Use to refresh the calendar list in the UI.
    func requestCalendarAccessAndRegenerate(completion: (() -> Void)? = nil) {
        guard settings.calendarProtectionEnabled else {
            completion?()
            return
        }
        Task { @MainActor in
            do {
                try await calendarManager.requestAccess()
                regenerateCalendarEventsIfEnabled()
            } catch {
                // Permission denied or error — keep setting as-is; user can retry from Settings
            }
            completion?()
        }
    }

    /// Request calendar access only (e.g. to populate the calendar list in settings). Does not require calendar protection to be enabled.
    func requestCalendarAccessForListing(completion: @escaping () -> Void) {
        Task { @MainActor in
            try? await calendarManager.requestAccess()
            completion()
        }
    }

    /// Regenerate prayer events for today if calendar protection is enabled and we have access.
    func regenerateCalendarEventsIfEnabled() {
        guard settings.calendarProtectionEnabled,
              calendarManager.hasAccess,
              let cal = calendarManager.targetCalendar(identifier: settings.calendarProtectionCalendarId.isEmpty ? nil : settings.calendarProtectionCalendarId)
        else { return }
        let prayers = calculator.calculatePrayerTimes(for: Date())
        let duration = settings.calendarBlockDuration
        let reminder = settings.calendarProtectionReminder
        do {
            try calendarManager.regeneratePrayerEvents(
                for: Date(),
                prayers: prayers,
                durationMinutes: duration,
                calendar: cal,
                addReminder: reminder
            )
        } catch {
            // Log or surface error if needed
        }
    }

    /// Re-requests full calendar access and refreshes the calendar list. Call when user taps "Refresh calendar access".
    /// Use when Outlook or other calendars don't appear — re-prompting can upgrade from "Add Only" to "Full Access".
    func refreshCalendarAccess(completion: @escaping () -> Void) {
        isRefreshingCalendarAccess = true
        Task { @MainActor in
            defer { isRefreshingCalendarAccess = false }
            do {
                try await calendarManager.requestAccess()
                regenerateCalendarEventsIfEnabled()
            } catch {
                // Permission denied — user can retry from Settings
            }
            completion()
        }
    }

    /// Remove all Waqtu-created events from the calendar. Call when user disables feature or taps "Remove all Waqtu events".
    func removeAllWaqtuEvents() {
        do {
            try calendarManager.deleteAllWaqtuEvents()
        } catch {
            // Surface if needed
        }
    }

    /// Resets all settings, removes calendar events, and quits. Use for "Reset Waqtu" — fixes stale config (e.g. calaccessd issues).
    /// License is preserved.
    func resetAllAndQuit() {
        settings.resetAll()
        AppDelegate.applyLaunchAtLogin(false)
        try? calendarManager.deleteAllWaqtuEvents()
        NSApplication.shared.terminate(nil)
    }

    func showTestOverlay() {
        // Close any existing overlay first and clear the reference
        if let existing = overlayWindow {
            overlayWindow = nil  // Clear reference BEFORE closing
            existing.close()      // Then close
        }

        let testPrayer = PrayerTime(name: .maghrib, time: Date())
        lastShownPrayerForSnooze = testPrayer

        let testWindow = OverlayWindow(
            prayerName: .maghrib,
            durationMinutes: settings.overlayDuration,
            playAdhanSound: settings.overlayPlayAdhanSound,
            onDismiss: { [weak self] in
                self?.overlayWindow = nil
            },
            onSnooze: { [weak self] minutes in
                self?.scheduleOverlaySnooze(minutes: minutes)
            }
        )
        overlayWindow = testWindow
        testWindow.makeKeyAndOrderFront(nil)
    }

    deinit {
        timer?.invalidate()
        snoozeTimer?.invalidate()
        cancellables.forEach { $0.cancel() }
    }
}
