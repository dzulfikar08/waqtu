import Foundation
import SwiftUI

@Observable
final class AppSettings {
    /// Shared app-group container for widget/watch/iOS sync.
    private let sharedDefaults = UserDefaults(suiteName: AppGroup.id) ?? UserDefaults.standard
    private let cloudStore = NSUbiquitousKeyValueStore.default
    // Overlay settings
    var overlayEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "overlayEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "overlayEnabled") }
    }

    var overlayDuration: Int {
        get { UserDefaults.standard.integer(forKey: "overlayDuration") }
        set { UserDefaults.standard.set(newValue, forKey: "overlayDuration") }
    }

    /// Overlay theme: "dark" (default) or "light" for a brighter reminder.
    var overlayTheme: String {
        get { UserDefaults.standard.string(forKey: "overlayTheme") ?? "dark" }
        set { UserDefaults.standard.set(newValue, forKey: "overlayTheme") }
    }

    /// Play Adhan sound when the prayer overlay appears.
    var overlayPlayAdhanSound: Bool {
        get { UserDefaults.standard.bool(forKey: "overlayPlayAdhanSound") }
        set { UserDefaults.standard.set(newValue, forKey: "overlayPlayAdhanSound") }
    }

    // Prayer reminder notifications ("Asr in 5 minutes")
    var reminderNotificationEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "reminderNotificationEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "reminderNotificationEnabled") }
    }

    /// Minutes before prayer to show notification (5, 10, 15, or 30).
    var reminderMinutesBefore: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "reminderMinutesBefore")
            return [5, 10, 15, 30].contains(v) ? v : 5
        }
        set { UserDefaults.standard.set(newValue, forKey: "reminderMinutesBefore") }
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

    // Calendar Protection (prayer blocks in calendar)
    var calendarProtectionEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "calendarProtectionEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "calendarProtectionEnabled") }
    }

    /// Duration of each prayer block (10–20 minutes).
    var calendarBlockDuration: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "calendarBlockDuration")
            return v >= 10 && v <= 20 ? v : 10
        }
        set { UserDefaults.standard.set(newValue, forKey: "calendarBlockDuration") }
    }

    /// Minutes to start the calendar block before the actual prayer time (0–10). For wudu/preparation.
    var calendarPreBufferMinutes: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "calendarPreBufferMinutes")
            return v >= 0 && v <= 10 ? v : 0
        }
        set { UserDefaults.standard.set(newValue, forKey: "calendarPreBufferMinutes") }
    }

    /// Add 5-minute-before reminder to prayer events.
    var calendarProtectionReminder: Bool {
        get { UserDefaults.standard.bool(forKey: "calendarProtectionReminder") }
        set { UserDefaults.standard.set(newValue, forKey: "calendarProtectionReminder") }
    }

    /// Calendar identifier for prayer events. Empty = default calendar.
    var calendarProtectionCalendarId: String {
        get { UserDefaults.standard.string(forKey: "calendarProtectionCalendarId") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "calendarProtectionCalendarId") }
    }

    // MARK: - Slack Integration

    /// Enable auto-setting Slack status during prayer times.
    var slackEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "slackEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "slackEnabled") }
    }

    /// Status text shown during prayer (e.g., "Praying — Dhuhr").
    var slackStatusText: String {
        get { UserDefaults.standard.string(forKey: "slackStatusText") ?? "Praying" }
        set { UserDefaults.standard.set(newValue, forKey: "slackStatusText") }
    }

    /// Status emoji shown during prayer (e.g., "🙏").
    var slackStatusEmoji: String {
        get { UserDefaults.standard.string(forKey: "slackStatusEmoji") ?? ":pray:" }
        set { UserDefaults.standard.set(newValue, forKey: "slackStatusEmoji") }
    }

    /// Show the iftar/imsak countdown in the menu bar title during Ramadhan. On unless turned off.
    var showFastingCountdown: Bool {
        get { (UserDefaults.standard.object(forKey: "showFastingCountdown") as? Bool) ?? true }
        set { UserDefaults.standard.set(newValue, forKey: "showFastingCountdown") }
    }

    /// Whether the first-run onboarding has been completed.
    var hasCompletedOnboarding: Bool {
        get { UserDefaults.standard.bool(forKey: "hasCompletedOnboarding") }
        set { UserDefaults.standard.set(newValue, forKey: "hasCompletedOnboarding") }
    }

    /// Whether we've shown the "Waqtu will create daily prayer blocks" explanation once.
    var hasSeenCalendarProtectionExplanation: Bool {
        get { UserDefaults.standard.bool(forKey: "hasSeenCalendarProtectionExplanation") }
        set { UserDefaults.standard.set(newValue, forKey: "hasSeenCalendarProtectionExplanation") }
    }

    var calculationMethod: String {
        get { UserDefaults.standard.string(forKey: "calculationMethod") ?? "muslimWorldLeague" }
        set {
            UserDefaults.standard.set(newValue, forKey: "calculationMethod")
            sharedDefaults.set(newValue, forKey: "calculationMethod")
            cloudStore.set(newValue, forKey: "calculationMethod")
            cloudStore.synchronize()
        }
    }

    var madhab: String {
        get { UserDefaults.standard.string(forKey: "madhab") ?? "shafi" }
        set {
            UserDefaults.standard.set(newValue, forKey: "madhab")
            sharedDefaults.set(newValue, forKey: "madhab")
            cloudStore.set(newValue, forKey: "madhab")
            cloudStore.synchronize()
        }
    }

    var highLatitudeRule: String {
        get { UserDefaults.standard.string(forKey: "highLatitudeRule") ?? "auto" }
        set {
            UserDefaults.standard.set(newValue, forKey: "highLatitudeRule")
            sharedDefaults.set(newValue, forKey: "highLatitudeRule")
            cloudStore.set(newValue, forKey: "highLatitudeRule")
            cloudStore.synchronize()
        }
    }

    var adjustmentFajr: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentFajr")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentFajr")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentFajr")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentFajr")
        }
    }
    var adjustmentSunrise: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentSunrise")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentSunrise")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentSunrise")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentSunrise")
        }
    }
    var adjustmentDhuhr: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentDhuhr")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentDhuhr")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentDhuhr")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentDhuhr")
        }
    }
    var adjustmentAsr: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentAsr")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentAsr")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentAsr")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentAsr")
        }
    }
    var adjustmentMaghrib: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentMaghrib")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentMaghrib")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentMaghrib")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentMaghrib")
        }
    }
    var adjustmentIsha: Int {
        get { clampedAdjustment(UserDefaults.standard.integer(forKey: "adjustmentIsha")) }
        set {
            UserDefaults.standard.set(clampedAdjustment(newValue), forKey: "adjustmentIsha")
            sharedDefaults.set(clampedAdjustment(newValue), forKey: "adjustmentIsha")
            cloudStore.set(clampedAdjustment(newValue), forKey: "adjustmentIsha")
        }
    }

    private func clampedAdjustment(_ value: Int) -> Int {
        min(60, max(-60, value))
    }

    // Quranic quote
    static let quranicQuote = "Indeed, prayer is obligatory on the believers at the specified time."
    static let quranicReference = "— Quran 4:103"

    // MARK: - Islamic Pomodoro

    var dhikrBreaks: Bool {
        get { UserDefaults.standard.bool(forKey: "dhikrBreaks") }
        set { UserDefaults.standard.set(newValue, forKey: "dhikrBreaks") }
    }

    var intentionDua: Bool {
        get { UserDefaults.standard.bool(forKey: "intentionDua") }
        set { UserDefaults.standard.set(newValue, forKey: "intentionDua") }
    }

    var salahAligned: Bool {
        get { UserDefaults.standard.bool(forKey: "salahAligned") }
        set { UserDefaults.standard.set(newValue, forKey: "salahAligned") }
    }

    var verseBreak: Bool {
        get { UserDefaults.standard.bool(forKey: "verseBreak") }
        set { UserDefaults.standard.set(newValue, forKey: "verseBreak") }
    }

    var focusMinutes: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "focusMinutes")
            return v >= 1 && v <= 90 ? v : 25
        }
        set { UserDefaults.standard.set(newValue, forKey: "focusMinutes") }
    }

    var breakMinutes: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "breakMinutes")
            return v >= 1 && v <= 30 ? v : 5
        }
        set { UserDefaults.standard.set(newValue, forKey: "breakMinutes") }
    }

    var longBreakMinutes: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "longBreakMinutes")
            return v >= 1 && v <= 60 ? v : 15
        }
        set { UserDefaults.standard.set(newValue, forKey: "longBreakMinutes") }
    }

    var cyclesBeforeLongBreak: Int {
        get {
            let v = UserDefaults.standard.integer(forKey: "cyclesBeforeLongBreak")
            return v >= 1 && v <= 8 ? v : 4
        }
        set { UserDefaults.standard.set(newValue, forKey: "cyclesBeforeLongBreak") }
    }

    var breakAudio: String {
        get {
            UserDefaults.standard.string(forKey: "breakAudio") ?? "none"
        }
        set { UserDefaults.standard.set(newValue, forKey: "breakAudio") }
    }

    var downloadedAudioId: String? {
        get { UserDefaults.standard.string(forKey: "downloadedAudioId") }
        set { UserDefaults.standard.set(newValue, forKey: "downloadedAudioId") }
    }

    init() {
        // Set default values if not set
        if !UserDefaults.standard.bool(forKey: "settingsInitialized") {
            applyDefaults()
        }
    }

    /// Clears all settings and resets to defaults. Use for "Reset Waqtu".
    func resetAll() {
        if let bundleId = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleId)
        }
        UserDefaults.standard.synchronize()
        applyDefaults()
    }

    private func applyDefaults() {
        UserDefaults.standard.set(true, forKey: "settingsInitialized")
        UserDefaults.standard.set(true, forKey: "overlayEnabled")
        UserDefaults.standard.set(10, forKey: "overlayDuration")
        UserDefaults.standard.set(false, forKey: "overlayPlayAdhanSound")
        UserDefaults.standard.set(true, forKey: "reminderNotificationEnabled")
        UserDefaults.standard.set(5, forKey: "reminderMinutesBefore")
        UserDefaults.standard.set(true, forKey: "autoDetectLocation")
        UserDefaults.standard.set(21.4225, forKey: "manualLatitude")
        UserDefaults.standard.set(39.8262, forKey: "manualLongitude")
        UserDefaults.standard.set("muslimWorldLeague", forKey: "calculationMethod")
        UserDefaults.standard.set("shafi", forKey: "madhab")
        UserDefaults.standard.set("auto", forKey: "highLatitudeRule")
        UserDefaults.standard.set(25, forKey: "focusMinutes")
        UserDefaults.standard.set(5, forKey: "breakMinutes")
        UserDefaults.standard.set(15, forKey: "longBreakMinutes")
        UserDefaults.standard.set(4, forKey: "cyclesBeforeLongBreak")
    }
}
