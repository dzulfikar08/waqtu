import Foundation

/// Shared settings synced via iCloud NSUbiquitousKeyValueStore.
/// These are the subset of AppSettings relevant to iOS/watchOS.
@Observable
public final class SharedSettings {
    private let store = NSUbiquitousKeyValueStore.default
    private let defaults = UserDefaults(suiteName: AppGroup.id) ?? UserDefaults.standard

    // MARK: - Calculation Settings

    public var calculationMethod: String {
        get { defaults.string(forKey: "calculationMethod") ?? "muslimWorldLeague" }
        set {
            defaults.set(newValue, forKey: "calculationMethod")
            store.set(newValue, forKey: "calculationMethod")
            store.synchronize()
        }
    }

    public var madhab: String {
        get { defaults.string(forKey: "madhab") ?? "shafi" }
        set {
            defaults.set(newValue, forKey: "madhab")
            store.set(newValue, forKey: "madhab")
            store.synchronize()
        }
    }

    public var highLatitudeRule: String {
        get { defaults.string(forKey: "highLatitudeRule") ?? "auto" }
        set {
            defaults.set(newValue, forKey: "highLatitudeRule")
            store.set(newValue, forKey: "highLatitudeRule")
            store.synchronize()
        }
    }

    // MARK: - Location

    public var autoDetectLocation: Bool {
        get { defaults.bool(forKey: "autoDetectLocation") }
        set {
            defaults.set(newValue, forKey: "autoDetectLocation")
            store.set(newValue, forKey: "autoDetectLocation")
            store.synchronize()
        }
    }

    public var manualLatitude: Double {
        get { defaults.double(forKey: "manualLatitude") }
        set {
            defaults.set(newValue, forKey: "manualLatitude")
            store.set(newValue, forKey: "manualLatitude")
            store.synchronize()
        }
    }

    public var manualLongitude: Double {
        get { defaults.double(forKey: "manualLongitude") }
        set {
            defaults.set(newValue, forKey: "manualLongitude")
            store.set(newValue, forKey: "manualLongitude")
            store.synchronize()
        }
    }

    /// Location display label (e.g., "London, UK").
    public var locationLabel: String {
        get { store.string(forKey: "locationLabel") ?? "Unknown" }
        set {
            store.set(newValue, forKey: "locationLabel")
            store.synchronize()
        }
    }

    // MARK: - Prayer Adjustments

    public var adjustmentFajr: Int {
        get { defaults.integer(forKey: "adjustmentFajr") }
        set {
            defaults.set(newValue, forKey: "adjustmentFajr")
            store.set(newValue, forKey: "adjustmentFajr")
            store.synchronize()
        }
    }

    public var adjustmentDhuhr: Int {
        get { defaults.integer(forKey: "adjustmentDhuhr") }
        set {
            defaults.set(newValue, forKey: "adjustmentDhuhr")
            store.set(newValue, forKey: "adjustmentDhuhr")
            store.synchronize()
        }
    }

    public var adjustmentAsr: Int {
        get { defaults.integer(forKey: "adjustmentAsr") }
        set {
            defaults.set(newValue, forKey: "adjustmentAsr")
            store.set(newValue, forKey: "adjustmentAsr")
            store.synchronize()
        }
    }

    public var adjustmentMaghrib: Int {
        get { defaults.integer(forKey: "adjustmentMaghrib") }
        set {
            defaults.set(newValue, forKey: "adjustmentMaghrib")
            store.set(newValue, forKey: "adjustmentMaghrib")
            store.synchronize()
        }
    }

    public var adjustmentIsha: Int {
        get { defaults.integer(forKey: "adjustmentIsha") }
        set {
            defaults.set(newValue, forKey: "adjustmentIsha")
            store.set(newValue, forKey: "adjustmentIsha")
            store.synchronize()
        }
    }

    public init() {
        // Ensure defaults are synced from iCloud
        store.synchronize()

        // Pull values from iCloud into local defaults
        for key in [
            "calculationMethod", "madhab", "highLatitudeRule",
            "adjustmentFajr", "adjustmentDhuhr", "adjustmentAsr",
            "adjustmentMaghrib", "adjustmentIsha"
        ] {
            if let value = store.object(forKey: key) {
                defaults.set(value, forKey: key)
            }
        }
        if let lat = store.object(forKey: "manualLatitude") as? Double {
            defaults.set(lat, forKey: "manualLatitude")
        }
        if let lon = store.object(forKey: "manualLongitude") as? Double {
            defaults.set(lon, forKey: "manualLongitude")
        }
        if let auto = store.object(forKey: "autoDetectLocation") as? Bool {
            defaults.set(auto, forKey: "autoDetectLocation")
        }
    }
}
