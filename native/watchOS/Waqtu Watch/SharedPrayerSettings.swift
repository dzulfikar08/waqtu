import Foundation
import WaqtuCore

/// Settings access shared by the watch app and its complications. Values live
/// in an app-group defaults suite so the widget extension reads the same
/// method, madhab, and location the app uses.
enum SharedPrayerSettings {
    static let appGroupID = "group.com.waqtu.prayer"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    static var method: CalculationMethod {
        CalculationMethod(rawValue: defaults.string(forKey: "calculationMethod") ?? "") ?? .muslimWorldLeague
    }

    static var madhab: Madhab {
        Madhab(rawValue: defaults.string(forKey: "madhab") ?? "") ?? .shafi
    }

    static var coordinates: Coordinates? {
        guard let lat = defaults.object(forKey: "latitude") as? Double,
              let lng = defaults.object(forKey: "longitude") as? Double else { return nil }
        return Coordinates(latitude: lat, longitude: lng)
    }

    static func store(method: CalculationMethod, madhab: Madhab) {
        defaults.set(method.rawValue, forKey: "calculationMethod")
        defaults.set(madhab.rawValue, forKey: "madhab")
    }

    static func store(coordinates: Coordinates) {
        defaults.set(coordinates.latitude, forKey: "latitude")
        defaults.set(coordinates.longitude, forKey: "longitude")
    }

    static func prayerTimes(on date: Date, calendar: Calendar = .current) -> PrayerTimes? {
        guard let coordinates else { return nil }
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = components.year, let month = components.month, let day = components.day else { return nil }
        return PrayerTimes(
            year: year, month: month, day: day,
            coordinates: coordinates,
            utcOffset: Double(TimeZone.current.secondsFromGMT(for: date)) / 3600.0,
            method: method,
            madhab: madhab
        )
    }

    static func minutesSinceMidnight(of date: Date, calendar: Calendar = .current) -> Int {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }
}
