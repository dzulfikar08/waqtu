import Foundation
import Combine
import AppKit
import CoreLocation
import UserNotifications

@Observable
final class AppViewModel {
    var settings: AppSettings
    let calculator: PrayerTimeCalculator
    let reminderScheduler: PrayerReminderScheduler
    let locationManager: LocationManager
    let calendarManager: CalendarManager
    let trialManager: TrialManager
    #if MAS
    /// Waqtu Premium bought in the Mac App Store (auto-renewing subscription).
    let storeSubscription: MacStoreSubscription
    #endif
    let streakManager: PrayerStreakManager
    let slackManager: SlackManager
    let pomodoroManager: PomodoroManager
    let account: WaqtuAccount
    let syncController: MutabaahSyncController
    let audioLibrary = AudioLibraryManager()
    let sharedBridge = SharedDataBridge()

    private var timer: Timer?
    private var snoozeTimer: Timer?
    private var activityMonitorTimer: Timer?
    private var shownPrayers: Set<String> = []
    private var lastShownPrayerForSnooze: PrayerTime?

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: Int = 0
    var overlayWindow: NSWindow?

    /// Menu bar title during Ramadhan ("Iftar 2h 14m"); nil outside Ramadhan or when turned off.
    var fastingTitle: String?
    @ObservationIgnored private var fastingInputs: FastingInputs?

    /// Human-readable location used for prayer times (city, country or "Manual: Mecca").
    var locationDisplay: String = String(localized: "Getting location...")

    /// True while a "Locate Me" refresh is in progress.
    var isRefreshingLocation: Bool = false

    /// True while calendar access is being refreshed.
    var isRefreshingCalendarAccess: Bool = false

    /// Full access: trial active, trial used (legacy), or paid premium.
    var hasAccess: Bool {
        trialManager.hasAccess || isPremium
    }

    /// Paid premium, as opposed to the trial: an active Mac App Store subscription (MAS build) or
    /// premium on the signed-in Waqtu account (one subscription unlocks mobile and the Mac).
    var isPremium: Bool {
        hasStoreSubscription || account.serverPremium
    }

    /// An active Mac App Store subscription on this Mac; always false in the direct-download build.
    var hasStoreSubscription: Bool {
        #if MAS
        return storeSubscription.isActive
        #else
        return false
        #endif
    }

    private var cancellables = Set<AnyCancellable>()

    init(trialManager: TrialManager = TrialManager()) {
        let settings = AppSettings()
        self.settings = settings
        self.trialManager = trialManager
        self.calculator = PrayerTimeCalculator(settings: settings)
        self.reminderScheduler = PrayerReminderScheduler(settings: settings)
        self.locationManager = LocationManager()
        self.calendarManager = CalendarManager()
        self.streakManager = PrayerStreakManager()
        self.slackManager = SlackManager()
        self.pomodoroManager = PomodoroManager(settings: settings, audioLibrary: audioLibrary)
        let account = WaqtuAccount()
        self.account = account
        self.syncController = MutabaahSyncController(
            account: account, streakManager: streakManager, settings: settings
        )
        #if MAS
        let storeSubscription = MacStoreSubscription()
        self.storeSubscription = storeSubscription
        // Every active subscription transaction also goes to the account, so the phone unlocks too.
        storeSubscription.onSignedTransaction = { [weak account] signed in
            Task { @MainActor in await account?.submitAppStoreTransaction(signed) }
        }
        #endif
        syncController.onRemoteChanges = { [weak self] changes in
            guard let self else { return }
            if changes.prayerSettings {
                // Also pushes the log to the shared container.
                self.calculatePrayers()
            } else if changes.prayerLog {
                self.pushToSharedContainer()
            }
        }
        // Checklist edits move the streak shown by the widgets.
        syncController.onLocalChecklistChange = { [weak self] in self?.pushToSharedContainer() }
        setupLocationUpdates()
        calculatePrayers()
        setupTimer()
        // If calendar protection was already on, request access and regenerate today’s events (e.g. after relaunch)
        if settings.calendarProtectionEnabled {
            requestCalendarAccessAndRegenerate()
        }
        #if MAS
        Task { @MainActor in await storeSubscription.refresh() }
        #endif
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
        locationDisplay = String(localized: "Updating...")
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
                        ? String(localized: "Location unavailable")
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
        refreshFastingInputs()
        updateCountdown()
        // Schedule \"Asr in 5 minutes\"-style notifications
        reminderScheduler.scheduleReminders(for: todayPrayers)
        // Push data to shared container for iOS/watch/widgets
        pushToSharedContainer()
    }

    private func setupTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateCountdown()
            self?.checkPrayerTime()
            self?.pomodoroManager.tick(now: Date(), nextPrayer: self?.nextPrayer)
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

    /// Prayer times and Ramadhan membership of today and tomorrow, for the menu bar countdown.
    private struct FastingInputs {
        let todayFajr: Date?
        let todayMaghrib: Date?
        let tomorrowFajr: Date?
        let isRamadhanToday: Bool
        let isRamadhanTomorrow: Bool
    }

    private func refreshFastingInputs() {
        let calendar = Calendar.current
        let now = Date()
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) else {
            fastingInputs = nil
            return
        }
        let hijriOffset = syncController.hijriOffset
        let isRamadhanToday = Ramadhan.isRamadhan(on: now, hijriOffset: hijriOffset)
        let isRamadhanTomorrow = Ramadhan.isRamadhan(on: tomorrow, hijriOffset: hijriOffset)
        guard isRamadhanToday || isRamadhanTomorrow else {
            fastingInputs = nil
            return
        }
        let tomorrowPrayers = calculator.calculatePrayerTimes(for: tomorrow)
        fastingInputs = FastingInputs(
            todayFajr: todayPrayers.first { $0.name == .fajr }?.time,
            todayMaghrib: todayPrayers.first { $0.name == .maghrib }?.time,
            tomorrowFajr: tomorrowPrayers.first { $0.name == .fajr }?.time,
            isRamadhanToday: isRamadhanToday,
            isRamadhanTomorrow: isRamadhanTomorrow
        )
    }

    private func updateFastingTitle(now: Date) {
        var title: String?
        if settings.showFastingCountdown, let inputs = fastingInputs,
           let countdown = FastingCountdown.compute(
               now: now,
               todayFajr: inputs.todayFajr,
               todayMaghrib: inputs.todayMaghrib,
               tomorrowFajr: inputs.tomorrowFajr,
               isRamadhanToday: inputs.isRamadhanToday,
               isRamadhanTomorrow: inputs.isRamadhanTomorrow
           ) {
            title = countdown.title(at: now)
        }
        if fastingTitle != title { fastingTitle = title }
    }

    private func updateCountdown() {
        updateFastingTitle(now: Date())
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
        "\(FardhMapping.dayKey(for: prayer.time))-\(prayer.name.rawValue)"
    }

    /// Push latest prayer times and streaks to shared app group for iOS/watch/widgets.
    func pushToSharedContainer() {
        sharedBridge.pushPrayerTimes(
            prayers: todayPrayers,
            locationLabel: locationDisplay,
            calculationMethod: settings.calculationMethod
        )
        sharedBridge.pushWatchComplicationData(
            nextPrayer: nextPrayer,
            locationLabel: locationDisplay
        )
        sharedBridge.pushStreakData(
            currentStreak: streakManager.currentStreak,
            bestStreak: streakManager.bestStreak,
            todayPrayed: streakManager.todayPrayedCount,
            weeklyGrid: mapWeeklyGrid()
        )
    }

    private func mapWeeklyGrid() -> [StreakData.DayDot] {
        streakManager.weeklyGrid.map { item in
            StreakData.DayDot(
                date: "",
                label: item.label,
                status: mapDotStatus(item.status),
                isToday: item.isToday
            )
        }
    }

    private func mapDotStatus(_ status: String) -> StreakData.DayDot.DotStatus {
        switch status {
        case "●": return .complete
        case "◐": return .partial
        case "○": return .missed
        default: return .empty
        }
    }

    private func showOverlay(for prayer: PrayerTime) {
        // Close any existing overlay first
        if let existing = overlayWindow {
            overlayWindow = nil  // Clear reference BEFORE closing
            existing.close()      // Then close
        }

        stopActivityMonitor()
        lastShownPrayerForSnooze = prayer

        let newWindow = OverlayWindow(
            prayerName: prayer.name,
            durationMinutes: settings.overlayDuration,
            playAdhanSound: settings.overlayPlayAdhanSound,
            theme: settings.overlayTheme,
            onDismiss: { [weak self] in
                self?.overlayWindow = nil
            },
            onSnooze: { [weak self] minutes in
                self?.scheduleOverlaySnooze(minutes: minutes)
            },
            onPrayerCommit: { [weak self] in
                self?.streakManager.markPrayed(prayer: prayer.name.rawValue)
                self?.pushToSharedContainer()
                self?.startPostDismissActivityMonitor(for: prayer.name)
            }
        )
        overlayWindow = newWindow
        newWindow.makeKeyAndOrderFront(nil)

        // Set Slack status if enabled
        updateSlackPrayingStatus(for: prayer.name)
    }

    private func scheduleOverlaySnooze(minutes: Int) {
        snoozeTimer?.invalidate()
        snoozeTimer = nil
        stopActivityMonitor()

        guard let prayer = lastShownPrayerForSnooze else { return }

        snoozeTimer = Timer.scheduledTimer(withTimeInterval: TimeInterval(minutes * 60), repeats: false) { [weak self] _ in
            self?.snoozeTimer = nil
            DispatchQueue.main.async {
                self?.showOverlay(for: prayer)
            }
        }
    }

    // MARK: - Slack Status

    private func updateSlackPrayingStatus(for prayer: PrayerName) {
        guard settings.slackEnabled,
              let token = slackManager.loadToken() else { return }

        let text = "\(settings.slackStatusText) — \(prayer.displayName)"
        let emoji = settings.slackStatusEmoji
        let expiration = settings.overlayDuration + settings.calendarPreBufferMinutes

        Task {
            try? await slackManager.setStatus(
                token: token,
                text: text,
                emoji: emoji,
                expirationMinutes: expiration
            )
        }
    }

    /// Manually clear Slack status (e.g., when user disables feature).
    func clearSlackStatus() {
        guard let token = slackManager.loadToken() else { return }
        Task {
            try? await slackManager.clearStatus(token: token)
        }
    }

    // MARK: - Post-Dismiss Activity Monitor

    /// After the user commits to pray, poll system idle time for a few minutes.
    /// If they keep using the Mac (mouse/keyboard activity), send a gentle reminder.
    private func startPostDismissActivityMonitor(for prayer: PrayerName) {
        stopActivityMonitor()

        let monitorWindowSeconds: TimeInterval = 5 * 60  // 5 minutes
        let pollInterval: TimeInterval = 10               // check every 10s
        let deadline = Date().addingTimeInterval(monitorWindowSeconds)

        // Record the current idle baseline — if it ever *drops* sharply, user is active
        var lastIdle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .keyDown)

        activityMonitorTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] timer in
            guard let self else {
                timer.invalidate()
                return
            }

            // Stop if we've passed the window
            guard Date() < deadline else {
                self.stopActivityMonitor()
                return
            }

            let currentIdle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .keyDown)

            // Idle reset: user was idle, now they're active
            if lastIdle > pollInterval && currentIdle < pollInterval {
                self.streakManager.markMissed(prayer: prayer.rawValue)
                self.pushToSharedContainer()
                self.deliverStillWorkingNotification(for: prayer)
                self.stopActivityMonitor()
                return
            }

            lastIdle = currentIdle
        }
    }

    private func stopActivityMonitor() {
        activityMonitorTimer?.invalidate()
        activityMonitorTimer = nil
    }

    /// Show a gentle local notification reminding the user they committed to pray.
    private func deliverStillWorkingNotification(for prayer: PrayerName) {
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Still at your Mac?")
        content.body = String(localized: "You tapped \"I am going to pray\" for \(prayer.displayName) but your Mac is still active. Don't forget your commitment.")
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "post-dismiss-activity-\(prayer.rawValue)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        UNUserNotificationCenter.current().add(request)
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
        let preBuffer = settings.calendarPreBufferMinutes
        do {
            try calendarManager.regeneratePrayerEvents(
                for: Date(),
                prayers: prayers,
                durationMinutes: duration,
                calendar: cal,
                addReminder: reminder,
                preBufferMinutes: preBuffer
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
            theme: settings.overlayTheme,
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
        activityMonitorTimer?.invalidate()
        cancellables.forEach { $0.cancel() }
    }
}
