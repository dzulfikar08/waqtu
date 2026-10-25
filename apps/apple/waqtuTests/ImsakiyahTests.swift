//
//  ImsakiyahTests.swift
//  waqtuTests
//
//  Hijri month boundaries, current-or-next Ramadhan and the imsakiyah table against
//  @waqtu/core (fixtures from apps/apple/scripts/imsakiyah-fixtures.ts), so the Mac month table
//  shows the same dates and times as the phone.
//

import Foundation
import Testing

struct ImsakiyahTests {
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .gmt
        return c
    }

    private func civil(_ ymd: String) -> CivilDate {
        CivilDate(ymd)!
    }

    // MARK: Civil dates

    @Test func civilDateArithmetic() {
        #expect(CivilDate(daysSinceEpoch: 0) == CivilDate(year: 1970, month: 1, day: 1))
        #expect(civil("2024-02-29").adding(days: 1) == civil("2024-03-01"))
        #expect(civil("2026-03-01").days(to: civil("2026-02-18")) == -11)
        #expect(civil("2026-12-31").adding(days: 1).description == "2027-01-01")
        #expect(civil("2026-02-18") < civil("2026-03-01"))
        #expect(CivilDate("2026-02-30") == nil)
        #expect(CivilDate("2026-13-01") == nil)
        #expect(CivilDate("2026-02") == nil)
    }

    @Test func civilDateMatchesFoundationGregorian() {
        // 1600...2243 (Foundation's Gregorian switches to Julian before 1582).
        for n in stride(from: -135_000, through: 100_000, by: 97) {
            let c = utc.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: TimeInterval(n) * 86_400))
            let d = CivilDate(daysSinceEpoch: n)
            #expect(d == CivilDate(year: c.year!, month: c.month!, day: c.day!), "day \(n)")
            #expect(d.daysSinceEpoch == n)
        }
    }

    @Test func civilDayOfAnInstantDependsOnTheZone() {
        let instant = Date(timeIntervalSince1970: 1_771_340_400)  // 2026-02-17 15:00 UTC
        #expect(CivilDate(instant, in: .gmt) == civil("2026-02-17"))
        #expect(CivilDate(instant, in: TimeZone(identifier: "Asia/Jakarta")!) == civil("2026-02-17"))
        #expect(CivilDate(instant, in: TimeZone(identifier: "Pacific/Kiritimati")!) == civil("2026-02-18"))
    }

    // MARK: Hijri months

    @Test func monthStartAndLengthMatchCore() {
        for f in ImsakiyahFixtures.months {
            let label = "\(f.year)-\(f.month) offset \(f.offset)"
            #expect(Hijri.monthStart(year: f.year, month: f.month, offset: f.offset)?.description == f.start, "\(label)")
            #expect(Hijri.monthLength(year: f.year, month: f.month, offset: f.offset) == f.length, "\(label)")
        }
    }

    @Test func invalidMonthHasNoStart() {
        #expect(Hijri.monthStart(year: 1447, month: 0) == nil)
        #expect(Hijri.monthStart(year: 1447, month: 13) == nil)
        let table = Imsakiyah.table(hijriYear: 1447, hijriMonth: 13, timeZone: .gmt) { _ in nil }
        #expect(table == nil)
    }

    @Test func currentOrNextRamadhanMatchesCore() {
        for f in ImsakiyahFixtures.ramadhanSpans {
            let span = Ramadhan.currentOrNext(from: civil(f.date), hijriOffset: f.offset)
            let label = "\(f.date) offset \(f.offset)"
            #expect(span?.hijriYear == f.hijriYear, "\(label)")
            #expect(span?.start.description == f.start, "\(label)")
            #expect(span?.end.description == f.end, "\(label)")
            #expect(span?.eid.description == f.eid, "\(label)")
        }
    }

    @Test func currentOrNextFromAnInstantUsesTheCalendarZone() {
        var jakarta = Calendar(identifier: .gregorian)
        jakarta.timeZone = TimeZone(identifier: "Asia/Jakarta")!
        // 2026-02-17 18:00 UTC is already 18 Feb (1 Ramadhan 1447) in Jakarta.
        let span = Ramadhan.currentOrNext(on: Date(timeIntervalSince1970: 1_771_351_200), calendar: jakarta)
        #expect(span?.hijriYear == 1447)
        #expect(span?.start == civil("2026-02-18"))
        #expect(span?.length == 30)
    }

    @Test func spansAgreeWithIsRamadhan() {
        for offset in -1...1 {
            for year in 1446...1449 {
                guard let start = Hijri.monthStart(year: year, month: Ramadhan.month, offset: offset),
                      let span = Ramadhan.currentOrNext(from: start, hijriOffset: offset) else {
                    Issue.record("no Ramadhan \(year) offset \(offset)")
                    continue
                }
                let label = "\(year) offset \(offset)"
                #expect(span.hijriYear == year, "\(label)")
                #expect(Hijri.date(of: start, offset: offset) == Hijri.Day(year: year, month: Ramadhan.month, day: 1), "\(label)")
                #expect(!Ramadhan.isRamadhan(on: start.adding(days: -1).noonUTC, hijriOffset: offset, calendar: utc), "\(label)")
                #expect(Ramadhan.isRamadhan(on: span.start.noonUTC, hijriOffset: offset, calendar: utc), "\(label)")
                #expect(Ramadhan.isRamadhan(on: span.end.noonUTC, hijriOffset: offset, calendar: utc), "\(label)")
                #expect(!Ramadhan.isRamadhan(on: span.eid.noonUTC, hijriOffset: offset, calendar: utc), "\(label)")
            }
        }
    }

    // MARK: Imsakiyah table vs core

    private func appTable(_ c: ImsakiyahFixtureCase) -> Imsakiyah.Table? {
        Imsakiyah.table(
            hijriYear: c.hijriYear,
            hijriOffset: c.hijriOffset,
            imsakMinutes: c.imsakMinutes,
            latitude: c.latitude,
            longitude: c.longitude,
            timeZone: TimeZone(identifier: c.timeZone)!,
            method: c.method
        )
    }

    /// Minutes after midnight of a "HH:mm" string.
    private func minutes(_ hhmm: String) -> Int? {
        guard hhmm.count == 5, let h = Int(hhmm.prefix(2)), let m = Int(hhmm.suffix(2)) else { return nil }
        return h * 60 + m
    }

    /// Every row of every case (Kemenag Jakarta/Malang with offsets -1/0/+1 and imsak 15, MWL London,
    /// and MWL Kiritimati, which only matches with core's dayShift) equals core to the minute, with one
    /// documented library difference:
    ///
    /// Kemenag rounds up (`Rounding.up`). When a raw time lands exactly on :00 seconds, adhan-js's
    /// `roundedMinute` still adds `60 - seconds` (a full minute), while Adhan-Swift's `ceil(second / 60)`
    /// keeps the minute. Example: Jakarta 2026-03-16 fajr is 21:42:00 UTC unrounded, so core says 04:43
    /// and Swift says 04:42 (imsak follows fajr). The rounded value no longer shows which side of the
    /// boundary the raw time was on, so the Mac can't reproduce it without abandoning the app's own
    /// calculator. The prayer-parity CI job allows ±1 min for the same reason. Here the only allowance
    /// is "Swift exactly one minute earlier" on rounding-up methods. Being exactly on :00 seconds is
    /// rare (about 1 in 60 times), and the test checks that too.
    @Test func tablesMatchCore() {
        let prayers = ImsakiyahFixtures.prayers.map { Imsakiyah.Prayer(rawValue: $0)! }
        #expect(prayers == Imsakiyah.Prayer.allCases)
        var compared = 0
        var roundingUpAllowances = 0
        for c in ImsakiyahFixtures.cases {
            guard let table = appTable(c) else {
                Issue.record("\(c.id): no table")
                continue
            }
            // Kemenag is the only rounding-up method (`PrayerMethodParameters.kemenag`).
            let roundsUp = c.method == "kemenag"
            #expect(table.start.description == c.start, "\(c.id)")
            #expect(table.length == c.length, "\(c.id)")
            #expect(table.rows.count == c.rows.count, "\(c.id)")
            for (row, expected) in zip(table.rows, c.rows) {
                let label = "\(c.id) day \(expected.hijriDay)"
                #expect(row.hijriDay == expected.hijriDay, "\(label)")
                #expect(row.date.description == expected.date, "\(label)")
                #expect(table.row(for: row.date) == row, "\(label)")
                for (prayer, local) in zip(prayers, expected.local) {
                    compared += 1
                    let actual = row.local[prayer]
                    if roundsUp, let actual, let local, actual != local,
                       let a = minutes(actual), let e = minutes(local), (e - a + 1440) % 1440 == 1 {
                        roundingUpAllowances += 1
                        continue
                    }
                    #expect(actual == local, "\(label) \(prayer.rawValue)")
                }
            }
        }
        let fixtureValues = ImsakiyahFixtures.cases.reduce(0) { $0 + $1.rows.count } * prayers.count
        #expect(compared == fixtureValues)
        #expect(roundingUpAllowances * 30 < compared, "\(roundingUpAllowances) of \(compared) off by the rounding-up minute")
    }

    @Test func imsakIsFajrMinusImsakMinutes() {
        for c in ImsakiyahFixtures.cases {
            guard let table = appTable(c) else {
                Issue.record("\(c.id): no table")
                continue
            }
            for row in table.rows {
                guard let fajr = row.times[.fajr] else {
                    Issue.record("\(c.id) day \(row.hijriDay): no fajr")
                    continue
                }
                #expect(row.times[.imsak] == fajr.addingTimeInterval(TimeInterval(-c.imsakMinutes * 60)), "\(c.id) day \(row.hijriDay)")
            }
        }
    }

    @Test func imsakMinutesOverrideMovesOnlyImsak() {
        let jakarta = TimeZone(identifier: "Asia/Jakarta")!
        let base = Imsakiyah.table(hijriYear: 1447, latitude: -6.2088, longitude: 106.8456, timeZone: jakarta, method: "kemenag")
        let early = Imsakiyah.table(
            hijriYear: 1447, imsakMinutes: 15, latitude: -6.2088, longitude: 106.8456, timeZone: jakarta, method: "kemenag"
        )
        #expect(base?.rows.first?.local[.imsak] == "04:31")
        #expect(early?.rows.first?.local[.imsak] == "04:26")
        for (a, b) in zip(base?.rows ?? [], early?.rows ?? []) {
            #expect(b.times[.imsak] == a.times[.imsak]?.addingTimeInterval(-300))
            #expect(b.times[.fajr] == a.times[.fajr])
            #expect(b.times[.maghrib] == a.times[.maghrib])
        }
    }

    // MARK: Pure builder

    @Test func builderSnapsToTheMinuteAndFormats24h() {
        let jakarta = TimeZone(identifier: "Asia/Jakarta")!
        var asked: [CivilDate] = []
        let table = Imsakiyah.table(hijriYear: 1447, imsakMinutes: 12, timeZone: jakarta) { date in
            asked.append(date)
            let midnightUTC = date.noonUTC.addingTimeInterval(-43_200)  // 07:00 WIB
            return Imsakiyah.SolarTimes(
                fajr: midnightUTC.addingTimeInterval(-(2 * 3600 + 19 * 60) + 29.6),  // 04:41:29.6 WIB -> 04:41
                dhuhr: midnightUTC.addingTimeInterval(6 * 3600 + 5 * 60 + 31),       // 13:05:31 WIB -> 13:06
                maghrib: nil
            )
        }
        #expect(asked.count == 30)
        #expect(asked.first == civil("2026-02-18"))
        #expect(asked.last == civil("2026-03-19"))
        let first = table?.rows.first
        #expect(first?.local[.fajr] == "04:41")
        #expect(first?.local[.imsak] == "04:29")
        #expect(first?.local[.dhuhr] == "13:06")
        #expect(first?.local[.maghrib] == nil)
        #expect(first?.times[.sunrise] == nil)
        if let fajr = first?.times[.fajr] {
            #expect(fajr.timeIntervalSince1970.truncatingRemainder(dividingBy: 60) == 0)
        }
    }

    @Test func dayWithoutTimesStillHasARow() {
        let table = Imsakiyah.table(hijriYear: 1448, hijriOffset: -1, timeZone: .gmt) { _ in nil }
        #expect(table?.length == 29)
        #expect(table?.start == civil("2027-02-09"))
        #expect(table?.rows.map(\.hijriDay) == Array(1...29))
        #expect(table?.rows.allSatisfy { $0.times.isEmpty && $0.local.isEmpty } == true)
    }

    @Test func clockIgnoresTheUserLocale() {
        let formatter = Imsakiyah.clockFormatter(timeZone: TimeZone(identifier: "Europe/London")!)
        #expect(formatter.string(from: Date(timeIntervalSince1970: 1_771_340_400)) == "15:00")
        #expect(formatter.string(from: Date(timeIntervalSince1970: 1_771_290_060)) == "01:01")
    }
}
