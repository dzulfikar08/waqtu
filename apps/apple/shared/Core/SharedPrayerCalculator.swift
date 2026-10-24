import Foundation
#if canImport(Adhan)
import Adhan
#endif

/// Shared prayer time calculator used by macOS, iOS, and watchOS targets.
/// On watchOS, falls back to a lightweight calculation or cached data.
public final class SharedPrayerCalculator {

    /// Calculate prayer times for a given location and date.
    /// Returns nil on watchOS if Adhan is unavailable (use cached times instead).
    public static func calculate(
        latitude: Double,
        longitude: Double,
        date: Date = Date(),
        method: String = "muslimWorldLeague",
        madhab: String = "shafi",
        highLatitudeRule: String = "auto",
        adjustments: PrayerAdjustmentsData = .zero
    ) -> [PrayerTime] {
        #if canImport(Adhan)
        let coordinates = Adhan.Coordinates(latitude: latitude, longitude: longitude)
        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.year, .month, .day], from: date)

        let calcMethod = Adhan.CalculationMethod(rawValue: method) ?? .muslimWorldLeague
        var params = calcMethod.params
        params.madhab = Madhab(rawValue: madhab == "hanafi" ? 2 : 1) ?? .shafi

        if highLatitudeRule != "auto",
           let rule = HighLatitudeRule(rawValue: highLatitudeRule) {
            params.highLatitudeRule = rule
        } else {
            params.highLatitudeRule = nil
        }

        params.adjustments = PrayerAdjustments(
            fajr: adjustments.fajr,
            sunrise: adjustments.sunrise,
            dhuhr: adjustments.dhuhr,
            asr: adjustments.asr,
            maghrib: adjustments.maghrib,
            isha: adjustments.isha
        )

        let prayerTimes = Adhan.PrayerTimes(
            coordinates: coordinates,
            date: components,
            calculationParameters: params
        )

        var times: [PrayerTime] = []
        if let t = prayerTimes?.fajr { times.append(PrayerTime(name: .fajr, time: t)) }
        if let t = prayerTimes?.dhuhr { times.append(PrayerTime(name: .dhuhr, time: t)) }
        if let t = prayerTimes?.asr { times.append(PrayerTime(name: .asr, time: t)) }
        if let t = prayerTimes?.maghrib { times.append(PrayerTime(name: .maghrib, time: t)) }
        if let t = prayerTimes?.isha { times.append(PrayerTime(name: .isha, time: t)) }
        return times
        #else
        // watchOS fallback: return empty, consumer should use cached data
        return []
        #endif
    }

    /// Get the next upcoming prayer from a list.
    public static func nextPrayer(from prayers: [PrayerTime]) -> PrayerTime? {
        prayers.first { !$0.hasPassed }
    }
}

/// Serializable prayer adjustments for iCloud sync.
public struct PrayerAdjustmentsData: Codable, Equatable {
    public var fajr: Int = 0
    public var sunrise: Int = 0
    public var dhuhr: Int = 0
    public var asr: Int = 0
    public var maghrib: Int = 0
    public var isha: Int = 0

    public static let zero = PrayerAdjustmentsData()
}
