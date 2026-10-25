//
//  HalaqahTests.swift
//  waqtuTests
//
//  The bundled halaqah program decodes and validates like apps/mobile/src/halaqah/program.ts,
//  the embed matches embed.ts, the schedule matches schedule.ts and completing a day writes the
//  `halaqah` mutabaah entry like db.ts completeDay.
//

import Foundation
import Testing

/// Files of the repository checkout the tests run from (content/ is bundled into the app as-is).
enum RepoFiles {
    static let root = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()  // waqtuTests
        .deletingLastPathComponent()  // apple
        .deletingLastPathComponent()  // apps
        .deletingLastPathComponent()

    static func data(_ path: String) throws -> Data {
        try Data(contentsOf: root.appendingPathComponent(path))
    }
}

struct HalaqahProgramTests {
    static func bundled() throws -> HalaqahProgram {
        try HalaqahProgram.parse(try RepoFiles.data("content/halaqah/ramadhan-1448/program.json"))
    }

    @Test func bundledProgramDecodes() throws {
        let program = try Self.bundled()
        #expect(program.id == "ramadhan-1448")
        #expect(program.hijriYear == 1448)
        #expect(program.totalDays == 30)
        #expect(program.days.count == 30)
        #expect(program.days.map(\.day) == Array(1...30))
        #expect(program.phases.first?.from == 1)
        #expect(program.phases.last?.to == 30)
        let first = try #require(program.day(1))
        #expect(first.video.youtubeId == "m97SDRxy8GM")
        #expect(first.title.en == "Why We Fast: Taqwa as the Goal")
        #expect(!first.summary.isEmpty && !first.reflectionPrompt.isEmpty)
        #expect(program.phase(of: first)?.id == "niat-fiqh-puasa")
        #expect(program.day(0) == nil && program.day(31) == nil)
    }

    @Test func draftOnlyInDevBuilds() throws {
        let program = try Self.bundled()
        // The shipped program is still a draft (content/halaqah/ramadhan-1448/README.md).
        #expect(program.status != HalaqahProgram.approvedStatus
                || HalaqahProgram.isReleasable(status: program.status, dev: false))
        #expect(!HalaqahProgram.isReleasable(status: "draft-pending-owner-approval", dev: false))
        #expect(HalaqahProgram.isReleasable(status: "draft-pending-owner-approval", dev: true))
        #expect(HalaqahProgram.isReleasable(status: "approved", dev: false))
    }

    private func minimalJSON(days: [[String: Any]], phases: [[String: Any]]? = nil) -> [String: Any] {
        [
            "program": [
                "id": "test-1",
                "title_id": "Uji",
                "title_en": "Test",
                "hijri_year": 1448,
                "total_days": days.count,
                "status": "approved",
                "phases": phases ?? [["id": "p", "title_id": "P", "title_en": "P", "days": [1, days.count]]],
            ] as [String: Any],
            "days": days,
        ]
    }

    private func day(_ n: Int, video: String, amalan: Any? = nil) -> [String: Any] {
        var d: [String: Any] = [
            "day": n, "phase": "p", "theme_id": "t", "title_id": "T\(n)", "title_en": "T\(n)", "topic": "quran",
            "video": [
                "youtube_id": video, "verified_title": "V", "channel_name": "C",
                "channel_url": "https://www.youtube.com/@chan", "speaker": "S", "duration_min": 10, "language": "id",
            ] as [String: Any],
            "summary_id": "Ringkas", "reflection_prompt_id": "Tanya", "sources": ["QS 2:183"],
            "madhhab_note_id": NSNull(),
        ]
        if let amalan { d["amalan_id"] = amalan }
        return d
    }

    @Test func optionalFieldsDecode() throws {
        let json = minimalJSON(days: [day(1, video: "AAAAAAAAAAA", amalan: "Sedekah"), day(2, video: "BBBBBBBBBBB", amalan: NSNull())])
        let program = try HalaqahProgram.parse(json: json)
        #expect(program.day(1)?.amalan == "Sedekah")
        #expect(program.day(2)?.amalan == nil)
        #expect(program.day(1)?.madhhabNote == nil)
    }

    @Test func reportsEveryProblem() {
        let json = minimalJSON(
            days: [day(1, video: "short"), day(3, video: "short"), ["day": true]],
            phases: [["id": "p", "title_id": "P", "title_en": "P", "days": [2, 3]]]
        )
        do {
            _ = try HalaqahProgram.parse(json: json)
            Issue.record("expected a validation error")
        } catch let error as HalaqahProgramError {
            let all = error.problems.joined(separator: "\n")
            #expect(all.contains("is not an 11-character YouTube id"))
            #expect(all.contains("expected to start at day 1, got 2"))
            #expect(all.contains("duplicate video short"))
            #expect(all.contains("days[2].day: expected an integer"))
            #expect(all.contains("expected day 2, found day 1"))
            #expect(all.contains("days[0].day: 1 is outside phase"))
        } catch {
            Issue.record("unexpected error \(error)")
        }
    }

    @Test func nextUncompletedDay() {
        #expect(HalaqahProgram.nextUncompletedDay(done: [], totalDays: 30) == 1)
        #expect(HalaqahProgram.nextUncompletedDay(done: [1, 2, 4], totalDays: 30) == 3)
        #expect(HalaqahProgram.nextUncompletedDay(done: Set(1...30), totalDays: 30) == nil)
    }
}

struct HalaqahEmbedTests {
    @Test func embedMatchesMobile() {
        #expect(HalaqahEmbed.embedURL("m97SDRxy8GM")
                == "https://www.youtube-nocookie.com/embed/m97SDRxy8GM?autoplay=0&rel=0&playsinline=1&modestbranding=1&origin=https%3A%2F%2Fwww.youtube-nocookie.com")
        #expect(HalaqahEmbed.embedURL("bad id") == nil)
        #expect(HalaqahEmbed.watchURL("m97SDRxy8GM")?.absoluteString == "https://www.youtube.com/watch?v=m97SDRxy8GM")
        #expect(HalaqahEmbed.embedHTML("m97SDRxy8GM")?.contains("referrerpolicy=\"strict-origin-when-cross-origin\"") == true)
    }

    @Test func onlyTheEmbedLoadsInTheTopFrame() {
        #expect(HalaqahEmbed.isEmbedNavigation("about:blank"))
        #expect(HalaqahEmbed.isEmbedNavigation("https://www.youtube-nocookie.com/"))
        #expect(HalaqahEmbed.isEmbedNavigation("https://www.youtube-nocookie.com/embed/m97SDRxy8GM?x=1"))
        #expect(!HalaqahEmbed.isEmbedNavigation("https://www.youtube.com/watch?v=m97SDRxy8GM"))
        #expect(HalaqahEmbed.isEmbedNavigation("https://accounts.google.com/x", isTopFrame: false))
    }
}

struct HalaqahScheduleTests {
    @Test func beforeDuringAfter() throws {
        // 1 Ramadhan 1448 is around 8 February 2027 (Umm al-Qura).
        let before = HalaqahPosition.of(today: CivilDay(year: 2026, month: 10, day: 25), hijriOffset: 0, hijriYear: 1448, totalDays: 30)
        guard case .before(let daysUntil?) = before else {
            Issue.record("expected a countdown, got \(before)")
            return
        }
        let start = CivilDay(year: 2026, month: 10, day: 25).adding(days: daysUntil)
        #expect(HijriDay(start, offset: 0) == HijriDay(year: 1448, month: 9, day: 1))
        #expect(HijriDay(start.adding(days: -1), offset: 0).month == 8)
        #expect((100...112).contains(daysUntil))

        let during = HalaqahPosition.of(today: start.adding(days: 4), hijriOffset: 0, hijriYear: 1448, totalDays: 30)
        #expect(during == .during(day: 5))
        #expect(during.todayDay == 5)

        // A one-day moon-sighting lag moves the program day back by one.
        let lagged = HalaqahPosition.of(today: start.adding(days: 4), hijriOffset: -1, hijriYear: 1448, totalDays: 30)
        #expect(lagged == .during(day: 4))

        #expect(HalaqahPosition.of(today: start.adding(days: 40), hijriOffset: 0, hijriYear: 1448, totalDays: 30) == .after)
        // Ramadhan 1446 (March 2025) is an earlier year's: no countdown, never "during".
        #expect(HalaqahPosition.of(today: CivilDay(year: 2025, month: 3, day: 10), hijriOffset: 0, hijriYear: 1448, totalDays: 30)
                == .before(daysUntil: nil))
        // A later year's Ramadhan counts as "after".
        #expect(HalaqahPosition.of(today: CivilDay(year: 2028, month: 2, day: 5), hijriOffset: 0, hijriYear: 1448, totalDays: 30) == .after)
    }

    @Test func civilDayKey() {
        #expect(CivilDay(year: 2027, month: 2, day: 8).key == "2027-02-08")
        #expect(CivilDay(year: 2027, month: 2, day: 28).adding(days: 1).key == "2027-03-01")
    }
}

struct HalaqahStoreTests {
    @Test func completeWritesTheMutabaahEntry() {
        let store = HalaqahStore(fileURL: nil)
        let replica = MutabaahReplica(fileURL: nil)
        #expect(store.completeDay(programId: "ramadhan-1448", day: 3, completedOn: "2027-02-20", writer: replica, at: 1000))
        #expect(replica.entryValue(date: "2027-02-20", itemId: "halaqah") == 1)
        #expect(replica.dirtyEntries().map(\.itemId) == ["halaqah"])
        #expect(store.progress(programId: "ramadhan-1448") == [3: "2027-02-20"])

        // Marking again keeps the first completion date.
        store.completeDay(programId: "ramadhan-1448", day: 3, completedOn: "2027-02-21", writer: replica, at: 2000)
        #expect(store.progress(programId: "ramadhan-1448") == [3: "2027-02-20"])
        #expect(replica.entryValue(date: "2027-02-21", itemId: "halaqah") == nil)
    }

    @Test func undoClearsOnlyWhenNoOtherSessionThatDay() {
        let store = HalaqahStore(fileURL: nil)
        let replica = MutabaahReplica(fileURL: nil)
        store.completeDay(programId: "ramadhan-1448", day: 1, completedOn: "2027-02-20", writer: replica, at: 1000)
        store.completeDay(programId: "ramadhan-1448", day: 2, completedOn: "2027-02-20", writer: replica, at: 1001)

        #expect(!store.uncompleteDay(programId: "ramadhan-1448", day: 1, writer: replica, at: 2000))
        #expect(replica.entryValue(date: "2027-02-20", itemId: "halaqah") == 1)

        #expect(store.uncompleteDay(programId: "ramadhan-1448", day: 2, writer: replica, at: 3000))
        #expect(replica.entryValue(date: "2027-02-20", itemId: "halaqah") == 0)
        #expect(store.progress(programId: "ramadhan-1448").isEmpty)
        #expect(!store.uncompleteDay(programId: "ramadhan-1448", day: 2, writer: replica, at: 4000))
    }

    @Test func reflectionsStayLocalAndPersist() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("halaqah-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let store = HalaqahStore(fileURL: url)
        store.saveReflection(programId: "p", day: 1, text: "  Alhamdulillah  \n")
        store.saveReflection(programId: "p", day: 2, text: String(repeating: "a", count: 5000))
        store.completeDay(programId: "p", day: 1, completedOn: "2027-02-08", writer: MutabaahReplica(fileURL: nil), at: 1)

        let reopened = HalaqahStore(fileURL: url)
        #expect(reopened.reflection(programId: "p", day: 1) == "Alhamdulillah")
        #expect(reopened.reflection(programId: "p", day: 2).count == HalaqahStore.maxReflection)
        #expect(reopened.progress(programId: "p") == [1: "2027-02-08"])

        reopened.saveReflection(programId: "p", day: 1, text: "   ")
        #expect(HalaqahStore(fileURL: url).reflection(programId: "p", day: 1) == "")
    }
}
