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

    /// Whether we've shown the "Waqtu will create daily prayer blocks" explanation once.
    var hasSeenCalendarProtectionExplanation: Bool {
        get { UserDefaults.standard.bool(forKey: "hasSeenCalendarProtectionExplanation") }
        set { UserDefaults.standard.set(newValue, forKey: "hasSeenCalendarProtectionExplanation") }
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
            UserDefaults.standard.set(false, forKey: "overlayPlayAdhanSound")
            UserDefaults.standard.set(true, forKey: "reminderNotificationEnabled")
            UserDefaults.standard.set(5, forKey: "reminderMinutesBefore")
            UserDefaults.standard.set(true, forKey: "autoDetectLocation")
            // Default: Mecca coordinates
            UserDefaults.standard.set(21.4225, forKey: "manualLatitude")
            UserDefaults.standard.set(39.8262, forKey: "manualLongitude")
        }
    }
}
