import Foundation
import Combine
import AppKit

@Observable
final class AppViewModel {
    var settings: AppSettings
    let calculator: PrayerTimeCalculator
    let locationManager: LocationManager
    let calendarManager: CalendarManager
    let trialManager: TrialManager
    let licenseManager: LicenseManager

    private var timer: Timer?
    private var shownPrayers: Set<String> = []

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: Int = 0
    var overlayWindow: NSWindow?

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
        self.locationManager = LocationManager()
        self.calendarManager = CalendarManager()
        setupLocationUpdates()
        calculatePrayers()
        setupTimer()
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
            }
            .store(in: &cancellables)

        // Listen for manual location changes from settings
        NotificationCenter.default.publisher(for: Notification.Name("locationChanged"))
            .sink { [weak self] _ in
                self?.calculatePrayers()
            }
            .store(in: &cancellables)

        // Regenerate calendar events when user changes calendar protection settings
        NotificationCenter.default.publisher(for: Notification.Name("calendarProtectionSettingsChanged"))
            .sink { [weak self] _ in
                self?.regenerateCalendarEventsIfEnabled()
            }
            .store(in: &cancellables)
    }

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

        let newWindow = OverlayWindow(
            prayerName: prayer.name,
            durationMinutes: settings.overlayDuration
        ) { [weak self] in
            self?.overlayWindow = nil
        }
        overlayWindow = newWindow
        newWindow.makeKeyAndOrderFront(nil)
    }

    func resetShownPrayers() {
        shownPrayers.removeAll()
    }

    // MARK: - Calendar Protection

    /// Request calendar access and regenerate today's prayer events. Call when user enables the feature or at midnight.
    func requestCalendarAccessAndRegenerate() {
        guard settings.calendarProtectionEnabled else { return }
        Task { @MainActor in
            do {
                try await calendarManager.requestAccess()
                regenerateCalendarEventsIfEnabled()
            } catch {
                // Permission denied or error — keep setting as-is; user can retry from Settings
            }
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

    /// Remove all Waqtu-created events from the calendar. Call when user disables feature or taps "Remove all Waqtu events".
    func removeAllWaqtuEvents() {
        do {
            try calendarManager.deleteAllWaqtuEvents()
        } catch {
            // Surface if needed
        }
    }

    func showTestOverlay() {
        // Close any existing overlay first and clear the reference
        if let existing = overlayWindow {
            overlayWindow = nil  // Clear reference BEFORE closing
            existing.close()      // Then close
        }

        let testWindow = OverlayWindow(
            prayerName: .maghrib,
            durationMinutes: settings.overlayDuration
        ) { [weak self] in
            self?.overlayWindow = nil
        }
        overlayWindow = testWindow
        testWindow.makeKeyAndOrderFront(nil)
    }

    deinit {
        timer?.invalidate()
        cancellables.forEach { $0.cancel() }
    }
}
