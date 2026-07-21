import Foundation

/// Shared prayer time model used across macOS, iOS, and watchOS targets.
public struct PrayerTime: Identifiable, Comparable, Codable {
    public let id = UUID()
    public let name: PrayerName
    public let time: Date

    private enum CodingKeys: String, CodingKey {
        case name, time
    }

    public init(name: PrayerName, time: Date) {
        self.name = name
        self.time = time
    }

    public var hasPassed: Bool {
        time < Date()
    }

    /// Minutes until this prayer time from now. Negative if passed.
    public var minutesUntil: Int {
        let diff = time.timeIntervalSinceNow
        return Int(diff / 60)
    }

    /// Formatted countdown string (e.g., "2h 15m" or "45m" or "now").
    public var countdownText: String {
        let diff = time.timeIntervalSinceNow
        guard diff > 0 else { return "now" }
        let hours = Int(diff) / 3600
        let minutes = (Int(diff) % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    /// Short countdown for watch (e.g., "2:15" or "45m").
    public var shortCountdown: String {
        let diff = time.timeIntervalSinceNow
        guard diff > 0 else { return "now" }
        let hours = Int(diff) / 3600
        let minutes = (Int(diff) % 3600) / 60
        if hours > 0 {
            return "\(hours):\(String(format: "%02d", minutes))"
        }
        return "\(minutes)m"
    }

    public static func < (lhs: PrayerTime, rhs: PrayerTime) -> Bool {
        lhs.time < rhs.time
    }
}

/// Lightweight prayer times payload for WatchConnectivity transfer.
public struct PrayerTimesPayload: Codable {
    public let prayers: [PrayerTimeData]
    public let generatedAt: Date
    public let locationLabel: String
    public let calculationMethod: String

    public init(prayers: [PrayerTime], locationLabel: String, calculationMethod: String) {
        self.prayers = prayers.map { PrayerTimeData(name: $0.name, time: $0.time) }
        self.generatedAt = Date()
        self.locationLabel = locationLabel
        self.calculationMethod = calculationMethod
    }

    public func toPrayerTimes() -> [PrayerTime] {
        prayers.map { PrayerTime(name: $0.name, time: $0.time) }
    }

    /// Whether this payload is still valid for today.
    public var isStale: Bool {
        !Calendar.current.isDate(generatedAt, inSameDayAs: Date())
    }
}

/// Serializable prayer time for transfer.
public struct PrayerTimeData: Codable {
    public let name: PrayerName
    public let time: Date

    public init(name: PrayerName, time: Date) {
        self.name = name
        self.time = time
    }
}
