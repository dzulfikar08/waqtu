import XCTest
@testable import WaqtuCore

/// Reference times fetched from the AlAdhan API (PrayTimes.org reference
/// implementation) on 2026-09-19, verified to ±1 minute by the Linux
/// verification harness before being embedded here.
final class PrayerTimesTests: XCTestCase {
    private struct Vector {
        let name: String
        let latitude: Double
        let longitude: Double
        let utcOffset: Double
        let year: Int
        let month: Int
        let day: Int
        let method: CalculationMethod
        let madhab: Madhab
        let reference: [Prayer: String]
    }

    private let vectors: [Vector] = [
        Vector(
            name: "Jakarta MWL Shafi (January)",
            latitude: -6.2088, longitude: 106.8456, utcOffset: 7,
            year: 2026, month: 1, day: 1,
            method: .muslimWorldLeague, madhab: .shafi,
            reference: [.fajr: "04:26", .sunrise: "05:42", .dhuhr: "11:56", .asr: "15:23", .maghrib: "18:10", .isha: "19:22"]
        ),
        Vector(
            name: "Jakarta MWL Shafi (September)",
            latitude: -6.2088, longitude: 106.8456, utcOffset: 7,
            year: 2026, month: 9, day: 19,
            method: .muslimWorldLeague, madhab: .shafi,
            reference: [.fajr: "04:35", .sunrise: "05:44", .dhuhr: "11:46", .asr: "14:58", .maghrib: "17:49", .isha: "18:54"]
        ),
        Vector(
            name: "New York ISNA Shafi (September, DST)",
            latitude: 40.7128, longitude: -74.006, utcOffset: -4,
            year: 2026, month: 9, day: 19,
            method: .isna, madhab: .shafi,
            reference: [.fajr: "05:25", .sunrise: "06:41", .dhuhr: "12:50", .asr: "16:18", .maghrib: "18:58", .isha: "20:14"]
        ),
        Vector(
            name: "New York ISNA Hanafi (January, standard time)",
            latitude: 40.7128, longitude: -74.006, utcOffset: -5,
            year: 2026, month: 1, day: 1,
            method: .isna, madhab: .hanafi,
            reference: [.fajr: "05:58", .sunrise: "07:20", .dhuhr: "12:00", .asr: "14:59", .maghrib: "16:39", .isha: "18:01"]
        ),
        Vector(
            name: "Makkah Umm al-Qura",
            latitude: 21.4225, longitude: 39.8262, utcOffset: 3,
            year: 2026, month: 9, day: 19,
            method: .ummAlQura, madhab: .shafi,
            reference: [.fajr: "04:52", .sunrise: "06:09", .dhuhr: "12:15", .asr: "15:40", .maghrib: "18:20", .isha: "19:50"]
        ),
        Vector(
            name: "Cairo Egyptian General Authority",
            latitude: 30.0444, longitude: 31.2357, utcOffset: 3,
            year: 2026, month: 9, day: 19,
            method: .egyptian, madhab: .shafi,
            reference: [.fajr: "05:14", .sunrise: "06:42", .dhuhr: "12:49", .asr: "16:18", .maghrib: "18:56", .isha: "20:13"]
        ),
        Vector(
            name: "Sydney MWL Hanafi (January, DST, southern summer)",
            latitude: -33.8688, longitude: 151.2093, utcOffset: 11,
            year: 2026, month: 1, day: 1,
            method: .muslimWorldLeague, madhab: .hanafi,
            reference: [.fajr: "04:04", .sunrise: "05:48", .dhuhr: "12:59", .asr: "17:59", .maghrib: "20:09", .isha: "21:46"]
        ),
    ]

    private func times(for v: Vector) -> PrayerTimes {
        PrayerTimes(
            year: v.year, month: v.month, day: v.day,
            coordinates: Coordinates(latitude: v.latitude, longitude: v.longitude),
            utcOffset: v.utcOffset,
            method: v.method,
            madhab: v.madhab
        )
    }

    private func minutes(_ hhmm: String) -> Int {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        return parts[0] * 60 + parts[1]
    }

    func testTimesMatchReferenceWithinOneMinute() {
        for v in vectors {
            let t = times(for: v)
            for prayer in Prayer.allCases {
                let expected = minutes(v.reference[prayer]!)
                let got = t.minutes(for: prayer)
                XCTAssertTrue(abs(got - expected) <= 1, "\(v.name) \(prayer.displayName): got \(got), expected \(expected) ±1")
            }
        }
    }

    func testTimesAreOrderedWithinEachDay() {
        for v in vectors {
            let t = times(for: v)
            let ordered = Prayer.allCases.map { t.minutes(for: $0) }
            XCTAssertEqual(ordered, ordered.sorted(), "\(v.name): expected fajr < sunrise < dhuhr < asr < maghrib < isha")
        }
    }

    func testUmmAlQuraIshaIsNinetyMinutesAfterMaghrib() {
        let t = times(for: vectors[4])
        XCTAssertEqual(t.minutes(for: .isha) - t.minutes(for: .maghrib), 90)
    }

    func testHanafiAsrIsLaterThanShafiAsr() {
        let v = vectors[1]
        let shafi = PrayerTimes(year: v.year, month: v.month, day: v.day,
                                coordinates: Coordinates(latitude: v.latitude, longitude: v.longitude),
                                utcOffset: v.utcOffset, method: v.method, madhab: .shafi)
        let hanafi = PrayerTimes(year: v.year, month: v.month, day: v.day,
                                 coordinates: Coordinates(latitude: v.latitude, longitude: v.longitude),
                                 utcOffset: v.utcOffset, method: v.method, madhab: .hanafi)
        XCTAssertGreaterThan(hanafi.minutes(for: .asr), shafi.minutes(for: .asr))
        // Only Asr may differ between madhabs.
        for prayer in Prayer.allCases where prayer != .asr {
            XCTAssertEqual(hanafi.minutes(for: prayer), shafi.minutes(for: prayer))
        }
    }

    func testComputationIsDeterministic() {
        let a = times(for: vectors[3])
        let b = times(for: vectors[3])
        XCTAssertEqual(a, b)
    }

    func testNextPrayerMidMorningIsDhuhr() {
        let t = times(for: vectors[0])
        let next = t.nextPrayer(currentMinutes: 8 * 60)
        XCTAssertEqual(next.prayer, .dhuhr)
        XCTAssertEqual(next.minutesUntil, t.minutes(for: .dhuhr) - 8 * 60)
    }

    func testNextPrayerBeforeFajrIsFajr() {
        let t = times(for: vectors[0])
        let next = t.nextPrayer(currentMinutes: 0)
        XCTAssertEqual(next.prayer, .fajr)
        XCTAssertEqual(next.minutesUntil, t.minutes(for: .fajr))
    }

    func testNextPrayerAfterIshaWrapsToTomorrowFajr() {
        let t = times(for: vectors[0])
        let isha = t.minutes(for: .isha)
        let current = isha + 30
        let tomorrowFajr = t.minutes(for: .fajr) + 1
        let next = t.nextPrayer(currentMinutes: current, nextDayFajrMinutes: tomorrowFajr)
        XCTAssertEqual(next.prayer, .fajr)
        XCTAssertEqual(next.minutesUntil, 1440 - current + tomorrowFajr)
    }

    func testClockTextIsZeroPaddedTwentyFourHour() {
        let t = times(for: vectors[4])
        XCTAssertEqual(t.clockText(for: .fajr), "04:52")
        XCTAssertEqual(t.clockText(for: .dhuhr), "12:15")
    }
}
