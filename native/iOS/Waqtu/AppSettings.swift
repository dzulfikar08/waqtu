import Foundation
import Observation
import WaqtuCore

/// User settings persisted to UserDefaults. Prayer times are always computed
/// on device — the app never sends location anywhere (same privacy stance as
/// the macOS app).
@Observable
@MainActor
final class AppSettings {
    private static let methodKey = "calculationMethod"
    private static let madhabKey = "madhab"
    private static let latitudeKey = "latitude"
    private static let longitudeKey = "longitude"

    var method: CalculationMethod {
        didSet { defaults.set(method.rawValue, forKey: Self.methodKey) }
    }

    var madhab: Madhab {
        didSet { defaults.set(madhab.rawValue, forKey: Self.madhabKey) }
    }

    /// Last confirmed location. `nil` until the user grants location access.
    var coordinates: Coordinates? {
        didSet {
            defaults.set(coordinates?.latitude, forKey: Self.latitudeKey)
            defaults.set(coordinates?.longitude, forKey: Self.longitudeKey)
        }
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        method = CalculationMethod(rawValue: defaults.string(forKey: Self.methodKey) ?? "") ?? .muslimWorldLeague
        madhab = Madhab(rawValue: defaults.string(forKey: Self.madhabKey) ?? "") ?? .shafi
        if let lat = defaults.object(forKey: Self.latitudeKey) as? Double,
           let lng = defaults.object(forKey: Self.longitudeKey) as? Double {
            coordinates = Coordinates(latitude: lat, longitude: lng)
        } else {
            coordinates = nil
        }
    }

    /// The device's current UTC offset in hours, e.g. 7 for UTC+7.
    var utcOffset: Double {
        Double(TimeZone.current.secondsFromGMT(for: Date())) / 3600.0
    }

    /// Prayer times for the calendar day containing `date`, or nil before a
    /// location is known.
    func prayerTimes(on date: Date, calendar: Calendar = .current) -> PrayerTimes? {
        guard let coordinates else { return nil }
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = components.year, let month = components.month, let day = components.day else { return nil }
        return PrayerTimes(
            year: year, month: month, day: day,
            coordinates: coordinates,
            utcOffset: utcOffset,
            method: method,
            madhab: madhab
        )
    }

    /// Minutes since local midnight for `date`.
    func minutesSinceMidnight(of date: Date, calendar: Calendar = .current) -> Int {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }

    /// A concrete Date for a prayer's minutes-since-midnight value on the same day as `reference`.
    func date(minutes: Int, sameDayAs reference: Date, calendar: Calendar = .current) -> Date? {
        calendar.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: reference)
    }
}
