//
//  MutabaahStreakTests.swift
//  waqtuTests
//
//  Parity with apps/mobile/test/streak.test.ts, plus byte-for-byte round trips of JSON the
//  phone's `serializeStreakConfig` wrote (strings generated with bun from apps/mobile/src/mutabaah/streak.ts).
//

import Foundation
import Testing

private let d0 = "2026-03-01"
private func day(_ n: Int) -> String { DayKeys.addDays(d0, n) }
private func days(_ ns: Int...) -> Set<String> { Set(ns.map(day)) }
private func cfg(graceDays: Int? = nil, minDone: Int? = nil, pauses: [PauseRange]? = nil) -> StreakConfig {
    let base = MutabaahStreak.defaultConfig
    return StreakConfig(graceDays: graceDays ?? base.graceDays, minDone: minDone ?? base.minDone, pauses: pauses ?? base.pauses)
}

struct MutabaahStreakTests {
    // MARK: computeStreak

    @Test func noHistory() {
        let r = MutabaahStreak.computeStreak([], today: day(5), config: cfg())
        #expect(r.current == 0)
        #expect(r.best == 0)
        #expect(r.forgiven == 0)
        #expect(r.graceLeft == 1)
        #expect(r.countedToday == false)
    }

    @Test func consecutiveDaysIncludingToday() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 2, 3), today: day(3), config: cfg())
        #expect(r.current == 4)
        #expect(r.best == 4)
        #expect(r.countedToday)
    }

    @Test func todayStillOpenDoesNotBreakOrResetTheStreak() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 2), today: day(3), config: cfg())
        #expect(r.current == 3)
        #expect(r.countedToday == false)
    }

    @Test func oneMissIsForgivenWithTheDefaultGraceAndAddsNothing() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 3, 4), today: day(4), config: cfg())
        #expect(r.current == 4)
        #expect(r.forgiven == 1)
        #expect(r.graceLeft == 0)
    }

    @Test func twoMissesInAWeekBreakTheStreakWhenGraceIs1() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 2, 5), today: day(5), config: cfg(graceDays: 1))
        #expect(r.current == 1)
        #expect(r.best == 3)
    }

    @Test func twoConsecutiveMissesAreFineWithGrace2() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 4), today: day(4), config: cfg(graceDays: 2))
        #expect(r.current == 3)
        #expect(r.forgiven == 2)
    }

    @Test func grace0IsStrict() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 3), today: day(3), config: cfg(graceDays: 0))
        #expect(r.current == 1)
        #expect(r.best == 2)
    }

    @Test func graceRefillsAfterThe7DayWindow() {
        // miss day 2, counted 3..9, miss day 10 (8 days after the first forgiven miss), counted 11
        let r = MutabaahStreak.computeStreak(days(0, 1, 3, 4, 5, 6, 7, 8, 9, 11), today: day(11), config: cfg(graceDays: 1))
        #expect(r.current == 10)
        #expect(r.forgiven == 2)
    }

    @Test func missesBeforeTheFirstCountedDayAreNotHeldAgainstTheUser() {
        let r = MutabaahStreak.computeStreak(days(10, 11), today: day(11), config: cfg())
        #expect(r.current == 2)
        #expect(r.forgiven == 0)
    }

    @Test func aLongGapResetsThenANewStreakStartsAtOne() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 2, 3, 20), today: day(20), config: cfg())
        #expect(r.current == 1)
        #expect(r.best == 4)
    }

    @Test func pausedDaysNeitherCountNorBreak() {
        let config = cfg(graceDays: 0, pauses: [PauseRange(from: day(2), to: day(6))])
        let r = MutabaahStreak.computeStreak(days(0, 1, 7), today: day(7), config: config)
        #expect(r.current == 3)
    }

    @Test func anOpenPauseCoversTodayAndKeepsTheStreak() {
        let config = cfg(graceDays: 0, pauses: [PauseRange(from: day(3), to: nil)])
        let r = MutabaahStreak.computeStreak(days(0, 1, 2), today: day(9), config: config)
        #expect(r.current == 3)
        #expect(r.paused)
    }

    @Test func futureEntriesAreIgnored() {
        let r = MutabaahStreak.computeStreak(days(0, 1, 9), today: day(1), config: cfg())
        #expect(r.current == 2)
    }

    // MARK: pauses

    @Test func startThenResumeTheSameDayLeavesNothingBehind() {
        let started = MutabaahStreak.startPause(cfg(), today: day(4))
        #expect(started.pauses == [PauseRange(from: day(4), to: nil)])
        #expect(MutabaahStreak.endPause(started, today: day(4)).pauses == [])
    }

    @Test func resumeClosesTheRangeAtYesterday() {
        let started = MutabaahStreak.startPause(cfg(), today: day(4))
        #expect(MutabaahStreak.endPause(started, today: day(7)).pauses == [PauseRange(from: day(4), to: day(6))])
    }

    @Test func startingTwiceIsANoOp() {
        let started = MutabaahStreak.startPause(cfg(), today: day(4))
        #expect(MutabaahStreak.startPause(started, today: day(5)) == started)
    }

    @Test func resumeKeepsOlderFinishedPauses() {
        let config = cfg(pauses: [PauseRange(from: day(0), to: day(1)), PauseRange(from: day(4), to: nil)])
        #expect(MutabaahStreak.endPause(config, today: day(6)).pauses == [
            PauseRange(from: day(0), to: day(1)),
            PauseRange(from: day(4), to: day(5)),
        ])
    }

    @Test func startPauseKeepsTheLast50() {
        let many = (0..<50).map { PauseRange(from: day($0 * 2), to: day($0 * 2)) }
        let started = MutabaahStreak.startPause(cfg(pauses: many), today: day(200))
        #expect(started.pauses.count == 50)
        #expect(started.pauses.first == many[1])
        #expect(started.pauses.last == PauseRange(from: day(200), to: nil))
    }

    // MARK: countedDays

    private let entries = [
        MutabaahEntryValue(date: day(0), itemId: "fajr", value: 3),
        MutabaahEntryValue(date: day(0), itemId: "dhuhr", value: 3),
        MutabaahEntryValue(date: day(0), itemId: "asr", value: 1),
        MutabaahEntryValue(date: day(1), itemId: "fajr", value: 3),
        MutabaahEntryValue(date: day(1), itemId: "dhuha", value: 1),
        MutabaahEntryValue(date: day(2), itemId: "fajr", value: 4), // jamaah flag without DONE is not done
        MutabaahEntryValue(date: day(2), itemId: "tilawah", value: 0),
        MutabaahEntryValue(date: day(3), itemId: "removed-item", value: 1),
    ]

    @Test func needsMinDoneDoneItemsFromTheEnabledList() {
        #expect(MutabaahStreak.countedDays(entries, items: MutabaahItems.builtinItems, minDone: 3) == [day(0)])
        #expect(MutabaahStreak.countedDays(entries, items: MutabaahItems.builtinItems, minDone: 2) == [day(0), day(1)])
    }

    @Test func itemsNoLongerOnTheListDoNotCount() {
        #expect(!MutabaahStreak.countedDays(entries, items: MutabaahItems.builtinItems, minDone: 1).contains(day(3)))
    }

    @Test func thresholdIsCappedByTheNumberOfEnabledItems() {
        let only = MutabaahItems.builtinItems.filter { $0.id == "fajr" }
        #expect(MutabaahStreak.countedDays(entries, items: only, minDone: 5) == [day(0), day(1)])
    }

    @Test func countValuesCountWhenPositive() {
        let tilawah = [MutabaahEntryValue(date: day(0), itemId: "tilawah", value: 12)]
        #expect(MutabaahStreak.countedDays(tilawah, items: MutabaahItems.builtinItems, minDone: 1) == [day(0)])
    }

    // MARK: streak config storage

    @Test func roundTrips() {
        let config = cfg(graceDays: 2, minDone: 5, pauses: [PauseRange(from: day(1), to: nil)])
        #expect(MutabaahStreak.parseStreakConfig(MutabaahStreak.serializeStreakConfig(config)) == config)
    }

    @Test func badInputFallsBackToDefaults() {
        #expect(MutabaahStreak.parseStreakConfig("not json") == MutabaahStreak.defaultConfig)
        #expect(MutabaahStreak.parseStreakConfig(nil) == MutabaahStreak.defaultConfig)
        #expect(MutabaahStreak.parseStreakConfig(#"{"graceDays":99,"minDone":0,"pauses":[{"from":"nope"}]}"#) == MutabaahStreak.defaultConfig)
    }

    @Test func serializationMatchesThePhoneByteForByte() {
        // bun: serializeStreakConfig(DEFAULT_STREAK_CONFIG) and a config with a closed and an open pause.
        let tsDefault = #"{"graceDays":1,"minDone":3,"pauses":[]}"#
        let tsPauses = #"{"graceDays":2,"minDone":5,"pauses":[{"from":"2026-01-01","to":"2026-01-03"},{"from":"2026-02-10","to":null}]}"#
        #expect(MutabaahStreak.serializeStreakConfig(MutabaahStreak.defaultConfig) == tsDefault)
        let parsed = MutabaahStreak.parseStreakConfig(tsPauses)
        #expect(parsed == StreakConfig(graceDays: 2, minDone: 5, pauses: [
            PauseRange(from: "2026-01-01", to: "2026-01-03"),
            PauseRange(from: "2026-02-10", to: nil),
        ]))
        #expect(MutabaahStreak.serializeStreakConfig(parsed) == tsPauses)
    }

    @Test func parseValidatesLikeThePhone() {
        // bun: JSON.stringify(parseStreakConfig(raw)) gave the expected string below.
        let raw = #"{"graceDays":2.0,"minDone":true,"pauses":[{"from":"2026-02-30","to":null},{"from":"2026-03-05","to":"2026-03-01"},{"from":"2026-03-05"},{"from":"2026-03-05","to":"2026-03-05"}]}"#
        let expected = #"{"graceDays":2,"minDone":3,"pauses":[{"from":"2026-03-05","to":"2026-03-05"}]}"#
        #expect(MutabaahStreak.serializeStreakConfig(MutabaahStreak.parseStreakConfig(raw)) == expected)
    }

    // MARK: day keys

    @Test func dayKeyArithmeticIsPureGregorian() {
        #expect(DayKeys.addDays("2024-02-28", 1) == "2024-02-29")
        #expect(DayKeys.addDays("2023-02-28", 1) == "2023-03-01")
        #expect(DayKeys.addDays("2026-01-01", -1) == "2025-12-31")
        #expect(DayKeys.addDays("2026-03-29", 1) == "2026-03-30")
        #expect(DayKeys.diffDays("2026-03-01", "2025-03-01") == 365)
        #expect(DayKeys.diffDays("2000-03-01", "2000-02-28") == 2)
        #expect(DayKeys.isDayKey("2024-02-29"))
        #expect(!DayKeys.isDayKey("2023-02-29"))
        #expect(!DayKeys.isDayKey("2026-13-01"))
        #expect(!DayKeys.isDayKey("2026-1-01"))
        #expect(!DayKeys.isDayKey("+026-01-01"))
    }
}
