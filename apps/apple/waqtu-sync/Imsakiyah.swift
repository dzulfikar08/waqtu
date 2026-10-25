//
//  Imsakiyah.swift
//  waqtu
//
//  Hijri month boundaries, the current-or-next Ramadhan, and the month prayer table
//  (packages/core/src/ramadhan.ts: hijriMonthStart, hijriMonthLength, currentOrNextRamadhan,
//  imsakiyahTable). The table builder is pure and takes the day's prayer times from a closure;
//  the Adhan-backed convenience at the bottom compiles only where Adhan and apps/apple/shared are.
//

import Foundation
#if canImport(Adhan)
import Adhan
#endif

/// A zone-free day on the proleptic Gregorian calendar (core's `CivilDate`).
struct CivilDate: Hashable, Comparable, CustomStringConvertible {
    let year: Int
    /// 1-12
    let month: Int
    let day: Int
}

extension CivilDate {
    /// Parses "YYYY-MM-DD"; nil when malformed or not a real day.
    init?(_ string: String) {
        let parts = string.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        let parsed = CivilDate(year: y, month: m, day: d)
        guard (1...12).contains(m), CivilDate(daysSinceEpoch: parsed.daysSinceEpoch) == parsed else { return nil }
        self = parsed
    }

    /// The civil day `date` falls on in `timeZone`.
    init(_ date: Date, in timeZone: TimeZone) {
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = timeZone
        let c = gregorian.dateComponents([.year, .month, .day], from: date)
        self.init(year: c.year ?? 1970, month: c.month ?? 1, day: c.day ?? 1)
    }

    /// Day number with 1970-01-01 = 0 (days_from_civil, H. Hinnant).
    var daysSinceEpoch: Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yearOfEra = y - era * 400
        let dayOfYear = (153 * ((month + 9) % 12) + 2) / 5 + day - 1  // March-based
        let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
        return era * 146_097 + dayOfEra - 719_468
    }

    /// Inverse of `daysSinceEpoch` (civil_from_days, H. Hinnant).
    init(daysSinceEpoch: Int) {
        let z = daysSinceEpoch + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let dayOfEra = z - era * 146_097
        let yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36_524 - dayOfEra / 146_096) / 365
        let dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
        let mp = (5 * dayOfYear + 2) / 153
        let month = mp < 10 ? mp + 3 : mp - 9
        self.init(
            year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
            month: month,
            day: dayOfYear - (153 * mp + 2) / 5 + 1
        )
    }

    /// This day shifted by `days` (may be negative).
    func adding(days: Int) -> CivilDate {
        CivilDate(daysSinceEpoch: daysSinceEpoch + days)
    }

    /// Whole days from `self` to `other` (`other - self`).
    func days(to other: CivilDate) -> Int {
        other.daysSinceEpoch - daysSinceEpoch
    }

    /// Noon UTC of this day. Hijri lookups use it so only the civil Y-M-D matters, never a zone edge.
    var noonUTC: Date {
        Date(timeIntervalSince1970: TimeInterval(daysSinceEpoch) * 86_400 + 43_200)
    }

    /// "YYYY-MM-DD"
    var description: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    static func < (lhs: CivilDate, rhs: CivilDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

/// Umm al-Qura Hijri calendar with a moon-sighting day offset, matching `hijriDate` in
/// packages/core/src/hijri.ts and `Ramadhan.isRamadhan`.
enum Hijri {
    struct Day: Equatable {
        let year: Int
        /// 1-12
        let month: Int
        let day: Int
    }

    // Days from 1970-01-01 to the Islamic civil epoch (JDN 1948440 minus JDN 2440588).
    private static let islamicEpochDays = 1_948_440 - 2_440_588

    /// Hijri date of `civil`, shifted by `offset` days (e.g. -1 where local sighting lags Umm al-Qura).
    static func date(of civil: CivilDate, offset: Int = 0) -> Day {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = .gmt
        let c = calendar.dateComponents([.year, .month, .day], from: civil.adding(days: offset).noonUTC)
        return Day(year: c.year ?? 0, month: c.month ?? 0, day: c.day ?? 0)
    }

    /// Civil date of 1 `month`/`year` under `offset`; nil for an invalid month or outside the calendar.
    static func monthStart(year: Int, month: Int, offset: Int = 0) -> CivilDate? {
        guard (1...12).contains(month) else { return nil }
        // The tabular calendar is within ~2 days of any observational one: start there and walk.
        let tabular = (Double(year - 1) * 354.367 + Double(month - 1) * 29.5306).rounded(.down)
        var candidate = CivilDate(daysSinceEpoch: Int(tabular) + islamicEpochDays)
        for _ in 0..<12 {
            let h = date(of: candidate, offset: offset)
            let cmp = h.year != year ? h.year - year : h.month != month ? h.month - month : h.day - 1
            if cmp == 0 { return candidate }
            candidate = candidate.adding(days: cmp < 0 ? 1 : -1)
        }
        return nil
    }

    /// Number of days (29 or 30) in Hijri `month`/`year` under `offset`.
    static func monthLength(year: Int, month: Int, offset: Int = 0) -> Int? {
        guard let start = monthStart(year: year, month: month, offset: offset) else { return nil }
        let next = month == 12 ? (year: year + 1, month: 1) : (year: year, month: month + 1)
        guard let end = monthStart(year: next.year, month: next.month, offset: offset) else { return nil }
        return start.days(to: end)
    }
}

extension Ramadhan {
    /// One Ramadhan in civil dates.
    struct Span: Equatable {
        let hijriYear: Int
        /// First day of fasting.
        let start: CivilDate
        /// Last day of fasting (29th or 30th Ramadhan).
        let end: CivilDate
        /// 1 Shawwal.
        let eid: CivilDate

        var length: Int { start.days(to: eid) }
    }

    /// The Ramadhan containing `civil`, or else the next one to start (core `currentOrNextRamadhan`).
    static func currentOrNext(from civil: CivilDate, hijriOffset: Int = 0) -> Span? {
        let h = Hijri.date(of: civil, offset: hijriOffset)
        let hijriYear = h.month <= Ramadhan.month ? h.year : h.year + 1
        guard let start = Hijri.monthStart(year: hijriYear, month: Ramadhan.month, offset: hijriOffset),
              let eid = Hijri.monthStart(year: hijriYear, month: Ramadhan.month + 1, offset: hijriOffset)
        else { return nil }
        return Span(hijriYear: hijriYear, start: start, end: eid.adding(days: -1), eid: eid)
    }

    /// `currentOrNext(from:)` for the civil day of `date` in `calendar`'s time zone.
    static func currentOrNext(on date: Date, hijriOffset: Int = 0, calendar: Calendar = .current) -> Span? {
        currentOrNext(from: CivilDate(date, in: calendar.timeZone), hijriOffset: hijriOffset)
    }
}

/// Prayer-time table for every day of a Hijri month at a location (core `imsakiyahTable`).
enum Imsakiyah {
    /// Table columns, in display order.
    enum Prayer: String, CaseIterable, Identifiable {
        case imsak, fajr, sunrise, dhuhr, asr, maghrib, isha

        var id: String { rawValue }
    }

    /// A calculator's times for one civil day; nil where the prayer does not occur.
    struct SolarTimes: Equatable {
        var fajr: Date?
        var sunrise: Date?
        var dhuhr: Date?
        var asr: Date?
        var maghrib: Date?
        var isha: Date?
    }

    struct Row: Identifiable, Equatable {
        /// 1-based day of the Hijri month.
        let hijriDay: Int
        let date: CivilDate
        /// Whole-minute instants; a missing key means the prayer does not occur that day.
        let times: [Prayer: Date]
        /// 24h "HH:mm" in the table's time zone, same keys as `times`.
        let local: [Prayer: String]

        var id: Int { hijriDay }
    }

    struct Table: Equatable {
        let hijriYear: Int
        let hijriMonth: Int
        let hijriOffset: Int
        let timeZone: TimeZone
        /// 1 `hijriMonth` in civil dates.
        let start: CivilDate
        /// One row per day of the month, in order.
        let rows: [Row]

        /// 29 or 30.
        var length: Int { rows.count }

        func row(for date: CivilDate) -> Row? {
            let index = start.days(to: date)
            return rows.indices.contains(index) ? rows[index] : nil
        }
    }

    /// Builds the table for Hijri `hijriMonth`/`hijriYear` (Ramadhan by default) under `hijriOffset`.
    /// `times` supplies each civil day's prayer times in `timeZone` (nil when none occur). Times are
    /// snapped to the minute and imsak is fajr minus `imsakMinutes`, as in core. Nil when the month
    /// cannot be located.
    static func table(
        hijriYear: Int,
        hijriMonth: Int = Ramadhan.month,
        hijriOffset: Int = 0,
        imsakMinutes: Int = Ramadhan.defaultImsakMinutes,
        timeZone: TimeZone,
        times: (CivilDate) -> SolarTimes?
    ) -> Table? {
        guard let start = Hijri.monthStart(year: hijriYear, month: hijriMonth, offset: hijriOffset),
              let length = Hijri.monthLength(year: hijriYear, month: hijriMonth, offset: hijriOffset)
        else { return nil }
        let clock = clockFormatter(timeZone: timeZone)
        var rows: [Row] = []
        rows.reserveCapacity(length)
        for index in 0..<length {
            let date = start.adding(days: index)
            rows.append(row(hijriDay: index + 1, date: date, solar: times(date), imsakMinutes: imsakMinutes, clock: clock))
        }
        return Table(
            hijriYear: hijriYear,
            hijriMonth: hijriMonth,
            hijriOffset: hijriOffset,
            timeZone: timeZone,
            start: start,
            rows: rows
        )
    }

    /// 24h "HH:mm" formatter in `timeZone`, independent of the user's locale and 12/24h setting.
    static func clockFormatter(timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.dateFormat = "HH:mm"
        return formatter
    }

    private static func row(hijriDay: Int, date: CivilDate, solar: SolarTimes?, imsakMinutes: Int, clock: DateFormatter) -> Row {
        let computed: [(Prayer, Date?)] = [
            (.fajr, solar?.fajr),
            (.sunrise, solar?.sunrise),
            (.dhuhr, solar?.dhuhr),
            (.asr, solar?.asr),
            (.maghrib, solar?.maghrib),
            (.isha, solar?.isha),
        ]
        var times: [Prayer: Date] = [:]
        for (prayer, instant) in computed {
            guard let instant else { continue }
            // Snap to the exact minute like core (Adhan rounding can leave sub-minute residue).
            times[prayer] = Date(timeIntervalSince1970: (instant.timeIntervalSince1970 / 60).rounded() * 60)
        }
        if let fajr = times[.fajr] {
            times[.imsak] = fajr.addingTimeInterval(TimeInterval(-imsakMinutes * 60))
        }
        return Row(hijriDay: hijriDay, date: date, times: times, local: times.mapValues { clock.string(from: $0) })
    }
}

#if canImport(Adhan)
extension Imsakiyah {
    /// The app calculator's times (`SharedPrayerCalculator.adhanTimes`) for civil day `date` in
    /// `timeZone`. Mirrors core's dayShift: Adhan computes the solar day of the date it is given,
    /// which in zones far from their longitude (e.g. Pacific/Kiritimati) is another civil day, so it
    /// re-runs for the shifted date. Nil when Adhan cannot compute the day (it returns all prayers
    /// or none, unlike core which drops only the missing ones).
    static func solarTimes(
        latitude: Double,
        longitude: Double,
        date: CivilDate,
        timeZone: TimeZone,
        method: String,
        madhab: String = "shafi",
        highLatitudeRule: String = "auto",
        adjustments: PrayerAdjustmentsData = .zero
    ) -> SolarTimes? {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = .gmt
        func run(_ day: CivilDate) -> Adhan.PrayerTimes? {
            SharedPrayerCalculator.adhanTimes(
                latitude: latitude,
                longitude: longitude,
                date: day.noonUTC,
                calendar: utc,
                method: method,
                madhab: madhab,
                highLatitudeRule: highLatitudeRule,
                adjustments: adjustments
            )
        }
        guard var prayerTimes = run(date) else { return nil }
        let dayShift = CivilDate(prayerTimes.dhuhr, in: timeZone).days(to: date)
        if dayShift != 0 {
            guard let shifted = run(date.adding(days: dayShift)) else { return nil }
            prayerTimes = shifted
        }
        return SolarTimes(
            fajr: prayerTimes.fajr,
            sunrise: prayerTimes.sunrise,
            dhuhr: prayerTimes.dhuhr,
            asr: prayerTimes.asr,
            maghrib: prayerTimes.maghrib,
            isha: prayerTimes.isha
        )
    }

    /// The month table at a location with the app's calculator. `method`/`madhab`/`highLatitudeRule`
    /// take the stored AppSettings ids (`"kemenag"` or an `Adhan.CalculationMethod` raw value).
    static func table(
        hijriYear: Int,
        hijriMonth: Int = Ramadhan.month,
        hijriOffset: Int = 0,
        imsakMinutes: Int = Ramadhan.defaultImsakMinutes,
        latitude: Double,
        longitude: Double,
        timeZone: TimeZone,
        method: String,
        madhab: String = "shafi",
        highLatitudeRule: String = "auto",
        adjustments: PrayerAdjustmentsData = .zero
    ) -> Table? {
        table(
            hijriYear: hijriYear,
            hijriMonth: hijriMonth,
            hijriOffset: hijriOffset,
            imsakMinutes: imsakMinutes,
            timeZone: timeZone
        ) { date in
            solarTimes(
                latitude: latitude,
                longitude: longitude,
                date: date,
                timeZone: timeZone,
                method: method,
                madhab: madhab,
                highLatitudeRule: highLatitudeRule,
                adjustments: adjustments
            )
        }
    }
}
#endif
