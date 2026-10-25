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
        let prayerTimes = adhanTimes(
            latitude: latitude,
            longitude: longitude,
            date: date,
            method: method,
            madhab: madhab,
            highLatitudeRule: highLatitudeRule,
            adjustments: adjustments
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

    #if canImport(Adhan)
    /// Raw Adhan times (incl. sunrise) for the civil day of `date` in `calendar`'s zone.
    /// `method` is `"kemenag"` or an `Adhan.CalculationMethod` raw value.
    public static func adhanTimes(
        latitude: Double,
        longitude: Double,
        date: Date,
        calendar: Calendar = Calendar(identifier: .gregorian),
        method: String,
        madhab: String = "shafi",
        highLatitudeRule: String = "auto",
        adjustments: PrayerAdjustmentsData = .zero
    ) -> Adhan.PrayerTimes? {
        Adhan.PrayerTimes(
            coordinates: Adhan.Coordinates(latitude: latitude, longitude: longitude),
            date: calendar.dateComponents([.year, .month, .day], from: date),
            calculationParameters: PrayerMethodParameters.make(
                method: method,
                madhab: madhab,
                highLatitudeRule: highLatitudeRule,
                adjustments: adjustments
            )
        )
    }
    #endif

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
