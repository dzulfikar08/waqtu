import Foundation

/// Shared prayer name enum used across macOS, iOS, and watchOS targets.
public enum PrayerName: String, CaseIterable, Identifiable, Codable {
    case fajr = "Fajr"
    case dhuhr = "Dhuhr"
    case asr = "Asr"
    case maghrib = "Maghrib"
    case isha = "Isha"

    public var id: String { rawValue }
    /// Name shown to the user, from the app's string catalog (Indonesian: Subuh, Dzuhur, ...).
    public var displayName: String {
        switch self {
        case .fajr: return String(localized: "Fajr")
        case .dhuhr: return String(localized: "Dhuhr")
        case .asr: return String(localized: "Asr")
        case .maghrib: return String(localized: "Maghrib")
        case .isha: return String(localized: "Isha")
        }
    }

    public var iconName: String {
        switch self {
        case .fajr: return "sunrise.fill"
        case .dhuhr: return "sun.max.fill"
        case .asr: return "sun.min.fill"
        case .maghrib: return "sunset.fill"
        case .isha: return "moon.fill"
        }
    }

    /// Short label for watch complications (max 3 chars).
    public var shortName: String {
        switch self {
        case .fajr: return "FJR"
        case .dhuhr: return "DHR"
        case .asr: return "ASR"
        case .maghrib: return "MGR"
        case .isha: return "ISH"
        }
    }

    /// SF Symbol for watch complications.
    public var symbolName: String {
        switch self {
        case .fajr: return "sun.and.horizon.fill"
        case .dhuhr: return "sun.max.fill"
        case .asr: return "sun.min.fill"
        case .maghrib: return "sunset.fill"
        case .isha: return "moon.stars.fill"
        }
    }
}
