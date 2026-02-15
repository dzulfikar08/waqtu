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
