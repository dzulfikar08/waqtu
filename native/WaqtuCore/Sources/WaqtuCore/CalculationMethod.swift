import Foundation

/// Prayer-time calculation methods. Matches the four methods the macOS app offers.
public enum CalculationMethod: String, CaseIterable, Codable, Identifiable, Sendable {
    case muslimWorldLeague
    case isna
    case egyptian
    case ummAlQura

    public var id: String { rawValue }

    var fajrAngle: Double {
        switch self {
        case .muslimWorldLeague: return 18.0
        case .isna: return 15.0
        case .egyptian: return 19.5
        case .ummAlQura: return 18.5
        }
    }

    /// Twilight angle for Isha; `nil` when the method uses a fixed interval after Maghrib.
    var ishaAngle: Double? {
        switch self {
        case .muslimWorldLeague: return 17.0
        case .isna: return 15.0
        case .egyptian: return 17.5
        case .ummAlQura: return nil
        }
    }

    /// Fixed interval after Maghrib for Isha; `nil` when the method uses a twilight angle.
    var ishaIntervalMinutes: Int? {
        switch self {
        case .ummAlQura: return 90
        default: return nil
        }
    }

    public var displayName: String {
        switch self {
        case .muslimWorldLeague: return "Muslim World League"
        case .isna: return "ISNA"
        case .egyptian: return "Egyptian General Authority"
        case .ummAlQura: return "Umm al-Qura"
        }
    }
}

/// Asr school. Shafi'i (and the other three) use a shadow factor of 1, Hanafi uses 2.
public enum Madhab: String, CaseIterable, Codable, Identifiable, Sendable {
    case shafi
    case hanafi

    public var id: String { rawValue }

    var shadowFactor: Double {
        switch self {
        case .shafi: return 1.0
        case .hanafi: return 2.0
        }
    }

    public var displayName: String {
        switch self {
        case .shafi: return "Shafi'i (standard)"
        case .hanafi: return "Hanafi"
        }
    }
}
