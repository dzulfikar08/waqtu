import Foundation

/// Geographic coordinates in decimal degrees.
public struct Coordinates: Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// The next prayer and how many minutes remain until it.
public struct NextPrayer: Equatable, Sendable {
    public let prayer: Prayer
    /// Minutes from the queried moment until the prayer begins.
    public let minutesUntil: Int
}

/// Prayer times for one local calendar day, expressed as minutes since local midnight.
///
/// Pure Foundation: no location or clock access. Callers supply coordinates and the
/// UTC offset so the result is deterministic and testable (and identical on iPhone,
/// Apple Watch, and the verification harness).
public struct PrayerTimes: Equatable, Sendable {
    /// Minutes since local midnight for each of the six daily times.
    public private(set) var minutesByPrayer: [Prayer: Int]

    public init(
        year: Int,
        month: Int,
        day: Int,
        coordinates: Coordinates,
        utcOffset: Double,
        method: CalculationMethod,
        madhab: Madhab
    ) {
        // Julian date shifted to local apparent solar time (PrayTimes convention).
        let jDate = Solar.julianDate(year: year, month: month, day: day) - coordinates.longitude / (15.0 * 24.0)

        func position(at portion: Double) -> SolarPosition {
            Solar.position(julianDay: jDate + portion)
        }

        func midDay(_ portion: Double) -> Double {
            Trig.fixHour(12.0 - position(at: portion).equationOfTime)
        }

        func sunAngleTime(_ angle: Double, portion: Double, beforeNoon: Bool) -> Double {
            let declination = position(at: portion).declination
            let noon = midDay(portion)
            // acos argument can leave [-1, 1] at extreme latitudes/seasons; clamping
            // keeps the result finite (noon) instead of trapping on NaN conversion.
            let raw = (-Trig.sin(angle) - Trig.sin(declination) * Trig.sin(coordinates.latitude))
                / (Trig.cos(declination) * Trig.cos(coordinates.latitude))
            let clamped = min(1.0, max(-1.0, raw))
            let h = Trig.arccosDeg(clamped) / 15.0
            return beforeNoon ? noon - h : noon + h
        }

        func asrTime(shadowFactor: Double, portion: Double) -> Double {
            let declination = position(at: portion).declination
            let angle = -Trig.arccotDeg(shadowFactor + Trig.tan(abs(coordinates.latitude - declination)))
            return sunAngleTime(angle, portion: portion, beforeNoon: false)
        }

        let fajr = sunAngleTime(method.fajrAngle, portion: 5.0 / 24.0, beforeNoon: true)
        let sunrise = sunAngleTime(0.833, portion: 6.0 / 24.0, beforeNoon: true)
        let dhuhr = midDay(12.0 / 24.0)
        let asr = asrTime(shadowFactor: madhab.shadowFactor, portion: 13.0 / 24.0)
        let maghrib = sunAngleTime(0.833, portion: 18.0 / 24.0, beforeNoon: false)
        let isha: Double
        if let interval = method.ishaIntervalMinutes {
            isha = maghrib + Double(interval) / 60.0
        } else {
            isha = sunAngleTime(method.ishaAngle ?? 17.0, portion: 18.0 / 24.0, beforeNoon: false)
        }

        // Convert solar hours to local clock time, rounded to the nearest minute.
        func localMinutes(_ hours: Double) -> Int {
            let total = Int(((hours + utcOffset - coordinates.longitude / 15.0) * 60.0).rounded())
            let minute = ((total % 60) + 60) % 60
            let hour = ((total / 60) % 24 + 24) % 24
            return hour * 60 + minute
        }

        minutesByPrayer = [
            .fajr: localMinutes(fajr),
            .sunrise: localMinutes(sunrise),
            .dhuhr: localMinutes(dhuhr),
            .asr: localMinutes(asr),
            .maghrib: localMinutes(maghrib),
            .isha: localMinutes(isha),
        ]
    }

    public func minutes(for prayer: Prayer) -> Int {
        minutesByPrayer[prayer] ?? 0
    }

    /// "HH:MM" clock text for a prayer time.
    public func clockText(for prayer: Prayer) -> String {
        let m = minutes(for: prayer)
        return String(format: "%02d:%02d", m / 60, m % 60)
    }

    /// The next prayer at or after `currentMinutes`. Past Isha this wraps to
    /// tomorrow's Fajr; pass `nextDayFajrMinutes` for exact wrap timing
    /// (omit to fall back to today's Fajr).
    public func nextPrayer(currentMinutes: Int, nextDayFajrMinutes: Int? = nil) -> NextPrayer {
        for prayer in Prayer.allCases {
            let start = minutes(for: prayer)
            if start >= currentMinutes {
                return NextPrayer(prayer: prayer, minutesUntil: start - currentMinutes)
            }
        }
        let tomorrowFajr = nextDayFajrMinutes ?? minutes(for: .fajr)
        return NextPrayer(prayer: .fajr, minutesUntil: 1440 - currentMinutes + tomorrowFajr)
    }
}
