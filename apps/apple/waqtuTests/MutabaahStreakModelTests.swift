//
//  MutabaahStreakModelTests.swift
//  waqtuTests
//
//  The Mac's streak from synced data equals the phone's. The scenario below was run through
//  apps/mobile (loadModel's inputs: entries > 0 of the last 730 days, parseItems, countedDays,
//  computeStreak) with bun; the expected results and JSON strings are its output. The rules
//  themselves are covered case by case in MutabaahStreakTests (ported from streak.test.ts).
//

import Foundation
import Testing

@MainActor
struct MutabaahStreakModelTests {
    private let today = "2027-03-20"

    /// DEFAULT_ITEMS − sedekah + custom counter "Istighfar" (c.istg2026), as the phone stores it.
    private let phoneItems = #"[{"id":"fajr","kind":"fardh"},{"id":"dhuhr","kind":"fardh"},{"id":"asr","kind":"fardh"},{"id":"maghrib","kind":"fardh"},{"id":"isha","kind":"fardh"},{"id":"rawatib","kind":"check"},{"id":"dhuha","kind":"check"},{"id":"tahajjud","kind":"check"},{"id":"tilawah","kind":"count"},{"id":"dzikir_pagi","kind":"check"},{"id":"dzikir_petang","kind":"check"},{"id":"puasa","kind":"check"},{"id":"c.istg2026","kind":"count","label":"Istighfar"}]"#
    private let phoneStreak = #"{"graceDays":1,"minDone":2,"pauses":[{"from":"2027-03-05","to":"2027-03-07"}]}"#
    private let phonePaused = #"{"graceDays":1,"minDone":2,"pauses":[{"from":"2027-03-05","to":"2027-03-07"},{"from":"2027-03-20","to":null}]}"#

    /// What the phone recorded and synced.
    private func phoneEntries() -> [SyncEntry] {
        var out: [SyncEntry] = []
        func put(_ date: String, _ id: String, _ value: Int) {
            out.append(SyncEntry(date: date, itemId: id, value: value, updatedAt: 1_000))
        }
        for d in ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04"] { put(d, "fajr", 3); put(d, "dhuha", 1) }
        for d in ["2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-12"] { put(d, "isha", 7); put(d, "tilawah", 4) }
        for d in ["2027-03-14", "2027-03-15", "2027-03-16", "2027-03-17"] { put(d, "maghrib", 1); put(d, "c.istg2026", 10) }
        put("2027-03-18", "asr", 3); put("2027-03-18", "dhuha", 0); put("2027-03-18", "sedekah", 1)
        put("2027-03-19", "dhuhr", 13); put("2027-03-19", "c.istg2026", 3)
        put("2027-03-20", "sedekah", 1); put("2027-03-20", "fajr", 0)
        // A 40-day run more than 730 days back: outside the phone's window, so not the best streak.
        for i in 0..<40 {
            let d = DayKeys.addDays("2024-01-01", i)
            put(d, "fajr", 3); put(d, "isha", 3)
        }
        return out
    }

    private func pulledReplica() async throws -> (MutabaahReplica, FakeServer) {
        let server = FakeServer()
        server.pullPageSize = 50
        for e in phoneEntries() { server.seed(e) }
        server.seed(SyncSetting(key: MutabaahSettingKey.items, value: phoneItems, updatedAt: 1_000))
        server.seed(SyncSetting(key: MutabaahSettingKey.streak, value: phoneStreak, updatedAt: 1_000))
        let replica = MutabaahReplica(fileURL: nil)
        _ = try await runSync(store: replica, transport: server)
        return (replica, server)
    }

    @Test func macShowsThePhonesStreakFromSyncedData() async throws {
        let (replica, _) = try await pulledReplica()
        #expect(MutabaahStreakModel.config(in: replica) == StreakConfig(
            graceDays: 1, minDone: 2, pauses: [PauseRange(from: "2027-03-05", to: "2027-03-07")]))
        #expect(MutabaahStreakModel.streak(today: today, in: replica) == StreakResult(
            current: 1, best: 13, forgiven: 0, graceLeft: 1, paused: false, countedToday: false))
    }

    @Test func onlyTheLast730DaysCount() async throws {
        let (replica, _) = try await pulledReplica()
        let recorded = MutabaahStreakModel.recorded(since: DayKeys.addDays(today, -730), in: replica)
        #expect(!recorded.contains { $0.date < "2025-03-20" })
        #expect(!recorded.contains { $0.value == 0 })
        let counted = MutabaahStreak.countedDays(recorded, items: MutabaahChecklist.items(in: replica), minDone: 2)
        #expect(counted.sorted() == [
            "2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-08", "2027-03-09",
            "2027-03-10", "2027-03-11", "2027-03-12", "2027-03-14", "2027-03-15", "2027-03-16",
            "2027-03-17", "2027-03-19",
        ])
    }

    @Test func pauseFromTheMacReachesThePhoneInItsFormat() async throws {
        let (replica, server) = try await pulledReplica()
        let paused = MutabaahStreak.startPause(MutabaahStreakModel.config(in: replica), today: today)
        #expect(MutabaahStreakModel.setConfig(paused, in: replica, at: 2_000))
        _ = try await runSync(store: replica, transport: server)

        #expect(server.setting(MutabaahSettingKey.streak)?.value == phonePaused)
        #expect(MutabaahStreakModel.streak(today: today, in: replica) == StreakResult(
            current: 1, best: 13, forgiven: 0, graceLeft: 1, paused: true, countedToday: false))

        let ended = MutabaahStreak.endPause(MutabaahStreakModel.config(in: replica), today: today)
        #expect(MutabaahStreakModel.setConfig(ended, in: replica, at: 3_000))
        _ = try await runSync(store: replica, transport: server)
        #expect(server.setting(MutabaahSettingKey.streak)?.value == phoneStreak)
    }

    @Test func noStreakSettingMeansThePhonesDefaults() {
        let replica = MutabaahReplica(fileURL: nil)
        #expect(MutabaahStreakModel.config(in: replica) == MutabaahStreak.defaultConfig)
        #expect(MutabaahStreakModel.streak(today: today, in: replica) == StreakResult(
            current: 0, best: 0, forgiven: 0, graceLeft: 1, paused: false, countedToday: false))
    }

    @Test func weekStripOfTheLastSevenDays() async throws {
        let (replica, _) = try await pulledReplica()
        let week = MutabaahStreakModel.week(today: today, in: replica)
        #expect(week.map(\.date) == ["2027-03-14", "2027-03-15", "2027-03-16", "2027-03-17", "2027-03-18", "2027-03-19", "2027-03-20"])
        #expect(week.map(\.counted) == [true, true, true, true, false, true, false])
        // sedekah is not on the list; dhuha 0 is not done.
        #expect(week.map(\.done) == [2, 2, 2, 2, 1, 2, 0])
        #expect(week.map(\.fardhDone) == [1, 1, 1, 1, 1, 1, 0])
        #expect(week.map(\.isToday) == [false, false, false, false, false, false, true])
        #expect(!week.contains { $0.paused })
    }

    @Test func englishWeekdayLabels() {
        #expect(MutabaahStreakModel.englishWeekday("2027-03-20") == "Sat")
        #expect(MutabaahStreakModel.englishWeekday("2027-03-14") == "Sun")
        #expect(MutabaahStreakModel.englishWeekday("1970-01-01") == "Thu")
        #expect(MutabaahStreakModel.englishWeekday("1969-12-31") == "Wed")
        #expect(MutabaahStreakModel.englishWeekday("2026-10-25") == "Sun")
    }
}
