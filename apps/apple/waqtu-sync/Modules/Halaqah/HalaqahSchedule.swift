//
//  HalaqahSchedule.swift
//  waqtu
//
//  Where today sits relative to the program's Ramadhan (apps/mobile/src/halaqah/schedule.ts), with
//  the same Umm al-Qura calendar and moon-sighting offset as `Ramadhan.isRamadhan`.
//

import Foundation

/// A civil (Gregorian) day.
struct CivilDay: Equatable, Comparable {
    let year: Int
    let month: Int
    let day: Int

    static func < (a: CivilDay, b: CivilDay) -> Bool {
        (a.year, a.month, a.day) < (b.year, b.month, b.day)
    }

    private static var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC") ?? .current
        return c
    }

    /// Today's civil day in `calendar`'s time zone (a non-Gregorian system calendar does not matter).
    init(_ date: Date, calendar: Calendar = .current) {
        let parts = FardhMapping.gregorian(in: calendar).dateComponents([.year, .month, .day], from: date)
        self.init(year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1)
    }

    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    /// Noon UTC of the day: only the civil Y-M-D matters.
    var noonUTC: Date {
        Self.utc.date(from: DateComponents(year: year, month: month, day: day, hour: 12)) ?? Date(timeIntervalSince1970: 0)
    }

    func adding(days: Int) -> CivilDay {
        let d = Self.utc.date(byAdding: .day, value: days, to: noonUTC) ?? noonUTC
        let p = Self.utc.dateComponents([.year, .month, .day], from: d)
        return CivilDay(year: p.year ?? year, month: p.month ?? month, day: p.day ?? day)
    }

    /// `YYYY-MM-DD`, the key mutabaah entries use.
    var key: String { String(format: "%04d-%02d-%02d", year, month, day) }
}

struct HijriDay: Equatable {
    let year: Int
    let month: Int
    let day: Int

    /// Umm al-Qura date of a civil day shifted by `offset` days (packages/core hijriDate).
    init(_ civil: CivilDay, offset: Int) {
        var hijri = Calendar(identifier: .islamicUmmAlQura)
        hijri.timeZone = TimeZone(identifier: "UTC") ?? .current
        let p = hijri.dateComponents([.year, .month, .day], from: civil.adding(days: offset).noonUTC)
        self.init(year: p.year ?? 0, month: p.month ?? 0, day: p.day ?? 0)
    }

    init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }
}

enum HalaqahPosition: Equatable {
    /// The program's Ramadhan has not come yet. `daysUntil` counts down only when it is the next one
    /// (this Hijri year is the program's year); earlier years carry nil.
    case before(daysUntil: Int?)
    /// Inside the program's Ramadhan; `day` is the program day for today (at most `totalDays`).
    case during(day: Int)
    /// The program's Ramadhan is over, including any later Ramadhan.
    case after

    static func of(today: CivilDay, hijriOffset: Int, hijriYear: Int, totalDays: Int) -> HalaqahPosition {
        let h = HijriDay(today, offset: hijriOffset)
        if h.year > hijriYear || (h.year == hijriYear && h.month > Ramadhan.month) { return .after }
        if h.year == hijriYear && h.month == Ramadhan.month { return .during(day: min(h.day, totalDays)) }
        if h.year < hijriYear { return .before(daysUntil: nil) }
        // Same Hijri year, an earlier month: walk to 1 Ramadhan (at most ~240 days away).
        var days = 1
        while days <= 400 {
            let next = HijriDay(today.adding(days: days), offset: hijriOffset)
            if next.year == hijriYear && next.month == Ramadhan.month { return .before(daysUntil: days) }
            if next.year > hijriYear { break }
            days += 1
        }
        return .before(daysUntil: nil)
    }

    /// Program day matching today, when inside Ramadhan.
    var todayDay: Int? {
        if case .during(let day) = self { return day }
        return nil
    }
}
