//
//  MuhasabahCloudTests.swift
//  waqtuTests
//
//  The opt-in cloud copy of the muhasabah journal: the store's tombstones and dirty flags, the
//  last-write-wins merge, the wire format of services/api `/v1/muhasabah`, the per-account setting
//  and the pull/push engine against a fake server.
//

import Foundation
import Testing

/// A fake /v1/muhasabah server: one row per day, a revision counter as the cursor, the same
/// last-write-wins rule as services/api/src/muhasabah.ts (an equal timestamp keeps the stored day).
final class FakeMuhasabahServer: MuhasabahTransport {
    private var rev = 0
    private var rows: [String: (wire: MuhasabahWire, rev: Int)] = [:]
    private(set) var pushes: [[MuhasabahWire]] = []
    private(set) var pulls: [(since: String, limit: Int)] = []
    var pullPageSize = MuhasabahLimits.pull
    var failPush: Error?

    func seed(_ wire: MuhasabahWire) { apply(wire) }

    func row(_ date: String) -> MuhasabahWire? { rows[date]?.wire }

    var dates: [String] { rows.keys.sorted() }

    func deleteAll() { rows = [:] }

    private func apply(_ wire: MuhasabahWire) {
        if let current = rows[wire.date], current.wire.updatedAt >= wire.updatedAt { return }
        rev += 1
        rows[wire.date] = (wire, rev)
    }

    func pull(since: String, limit: Int) async throws -> MuhasabahPullPage {
        pulls.append((since, limit))
        let after = Int(since) ?? 0
        var newer: [(wire: MuhasabahWire, rev: Int)] = []
        for (_, row) in rows where row.rev > after { newer.append(row) }
        newer.sort { $0.rev < $1.rev }
        let size = min(limit, pullPageSize)
        let page = Array(newer.prefix(size))
        let last = page.last?.rev ?? after
        return MuhasabahPullPage(entries: page.map { $0.wire }, cursor: String(last), hasMore: newer.count > size)
    }

    func push(_ entries: [MuhasabahWire]) async throws {
        if let failPush { throw failPush }
        pushes.append(entries)
        for wire in entries { apply(wire) }
    }
}

private func entry(_ date: String, _ fill: (inout MuhasabahEntry) -> Void = { _ in }) -> MuhasabahEntry {
    var e = MuhasabahEntry(date: date)
    fill(&e)
    return e
}

private func body(_ fill: (inout MuhasabahWireEntry) -> Void) -> MuhasabahWireEntry {
    var b = MuhasabahWireEntry()
    fill(&b)
    return b
}

struct MuhasabahStoreCloudTests {
    private let day = "2027-02-12"

    @Test func aDeletedDayStaysAsATombstoneThatIsQueuedForUpload() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "Tenang" }, now: 100)
        store.markClean(store.dirtyWires())
        #expect(store.dirtyWires().isEmpty)

        store.delete(day, now: 200)
        #expect(store.entry(day) == nil)
        #expect(store.allDates.isEmpty)
        #expect(store.dirtyWires() == [MuhasabahWire(date: day, updatedAt: 200, entry: nil)])
    }

    @Test func deletingADayThatWasNeverWrittenLeavesNothingToUpload() {
        let store = MuhasabahStore(fileURL: nil)
        store.delete(day, now: 100)
        #expect(store.dirtyWires().isEmpty)
    }

    @Test func savingWritesTheCleanedAnswersAsDirty() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "  Syukur  "; $0.taqwa = 7; $0.energy = 11 }, now: 100)
        let wires = store.dirtyWires()
        #expect(wires.count == 1)
        #expect(wires.first?.updatedAt == 100)
        #expect(wires.first?.entry == body { $0.feelings = "Syukur"; $0.taqwa = 7 })
    }

    @Test func markCleanKeepsAnEditMadeWhileThePushWasInFlight() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "satu" }, now: 100)
        let pushed = store.dirtyWires()
        store.save(entry(day) { $0.feelings = "dua" }, now: 200)
        store.markClean(pushed)
        #expect(store.dirtyWires().map(\.updatedAt) == [200])
    }

    @Test func daysFromBeforeCloudSyncAreDirtyAndAFileKeepsTheFlagsAcrossARestart() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("waqtu-muhasabah-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent("muhasabah.json")

        // A file as the previous version wrote it: no tombstones, no dirty flag.
        let legacy = """
        {"2027-02-10":{"createdAt":5,"entry":{"date":"2027-02-10","feelings":"lama","taqwa":6},"updatedAt":9}}
        """
        try legacy.write(to: file, atomically: true, encoding: .utf8)
        let store = MuhasabahStore(fileURL: file)
        #expect(store.entry("2027-02-10")?.feelings == "lama")
        #expect(store.dirtyWires().map(\.date) == ["2027-02-10"])

        store.markClean(store.dirtyWires())
        store.save(entry(day) { $0.energy = 4 }, now: 300)
        store.delete("2027-02-10", now: 400)
        let reopened = MuhasabahStore(fileURL: file)
        #expect(reopened.allDates == [day])
        #expect(reopened.entry("2027-02-10") == nil)
        // Oldest edit first: the day written at 300, then the deletion at 400.
        #expect(reopened.dirtyWires().map(\.date) == [day, "2027-02-10"])
    }

    @Test func markAllDirtyQueuesEveryDayForUpload() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry("2027-02-10") { $0.taqwa = 5 }, now: 100)
        store.save(entry("2027-02-11") { $0.taqwa = 6 }, now: 200)
        store.markClean(store.dirtyWires())
        #expect(store.dirtyWires().isEmpty)
        store.markAllDirty()
        #expect(store.dirtyWires().map(\.date) == ["2027-02-10", "2027-02-11"])
    }

    @Test func aNewerCloudDayReplacesOursAndAnOlderOrEqualOneDoesNot() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "lokal" }, now: 500)

        let older = MuhasabahWire(date: day, updatedAt: 400, entry: body { $0.feelings = "lama" })
        let equal = MuhasabahWire(date: day, updatedAt: 500, entry: body { $0.feelings = "sama" })
        #expect(store.merge(remote: [older, equal]).isEmpty)
        #expect(store.entry(day)?.feelings == "lokal")

        let newer = MuhasabahWire(date: day, updatedAt: 600, entry: body { $0.feelings = "baru"; $0.gratitude = 9 })
        #expect(store.merge(remote: [newer]) == [day])
        #expect(store.entry(day) == entry(day) { $0.feelings = "baru"; $0.gratitude = 9 })
        // What came from the cloud copy is clean.
        #expect(store.dirtyWires().isEmpty)
    }

    @Test func aNewerCloudTombstoneDeletesTheDayHere() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "lokal" }, now: 500)
        #expect(store.merge(remote: [MuhasabahWire(date: day, updatedAt: 700, entry: nil)]) == [day])
        #expect(store.entry(day) == nil)
        #expect(store.dirtyWires().isEmpty)
    }

    @Test func aDayTheStoreNeverHadIsTakenAtAnyTimestamp() {
        let store = MuhasabahStore(fileURL: nil)
        let wire = MuhasabahWire(date: day, updatedAt: 0, entry: body { $0.newAction = "Sedekah" })
        #expect(store.merge(remote: [wire]) == [day])
        #expect(store.entry(day)?.newAction == "Sedekah")
    }

    @Test func cloudAnswersOutsideTheJournalsRulesAreCleaned() {
        let store = MuhasabahStore(fileURL: nil)
        let wire = MuhasabahWire(date: day, updatedAt: 10, entry: body { $0.taqwa = 12; $0.willingness = 8 })
        store.merge(remote: [wire])
        #expect(store.entry(day) == entry(day) { $0.willingness = 8 })
    }
}

struct MuhasabahWireFormatTests {
    private func json(_ wire: MuhasabahWire) throws -> [String: Any] {
        let data = try JSONEncoder().encode(wire)
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    @Test func aDeletedDayIsSentWithAnExplicitNullEntry() throws {
        let object = try json(MuhasabahWire(date: "2027-02-12", updatedAt: 5, entry: nil))
        #expect(object["date"] as? String == "2027-02-12")
        #expect((object["updatedAt"] as? NSNumber)?.int64Value == 5)
        #expect(object.keys.contains("entry"))
        #expect(object["entry"] is NSNull)
    }

    @Test func unansweredQuestionsAreLeftOutNotSentAsNull() throws {
        let wire = MuhasabahWire(date: "2027-02-12", updatedAt: 5, entry: body { $0.feelings = "a"; $0.taqwa = 3 })
        let object = try json(wire)
        let answers = try #require(object["entry"] as? [String: Any])
        #expect(Set(answers.keys) == ["feelings", "taqwa"])
    }

    @Test func aPullPageDecodesDaysAndTombstones() throws {
        let page = """
        {"entries":[
          {"date":"2027-02-12","updatedAt":9,"entry":{"feelings":"x","energy":4,"continueTomorrow":"y"}},
          {"date":"2027-02-11","updatedAt":8,"entry":null}
        ],"cursor":"7","hasMore":true}
        """
        let decoded = try JSONDecoder().decode(MuhasabahPullPage.self, from: Data(page.utf8))
        #expect(decoded.cursor == "7")
        #expect(decoded.hasMore)
        #expect(decoded.entries.count == 2)
        #expect(decoded.entries[0].entry == body { $0.feelings = "x"; $0.energy = 4; $0.continueTomorrow = "y" })
        #expect(decoded.entries[1].entry == nil)
    }

    @Test func textBeyondTheServerCapIsTrimmed() {
        let long = String(repeating: "😀", count: 3900)
        let wire = MuhasabahWireEntry(entry("2027-02-12") { $0.feelings = long })
        #expect((wire.feelings?.utf16.count ?? 0) <= MuhasabahWireEntry.maxServerText)
        #expect(wire.feelings?.isEmpty == false)
    }
}

struct MuhasabahCloudPrefsTests {
    @Test func theSettingBelongsToOneAccountAndStartsOff() {
        let prefs = MuhasabahCloudPrefs(fileURL: nil)
        #expect(prefs.userId == nil)
        #expect(!prefs.isEnabled(for: "a"))

        prefs.enable(for: "a")
        #expect(prefs.isEnabled(for: "a"))
        #expect(!prefs.isEnabled(for: "b"))

        prefs.disable()
        #expect(prefs.userId == nil)
        #expect(prefs.cursor == "0")
    }

    @Test func turningItOnStartsFromACleanCursorAndTheCursorOnlyMovesWhileOn() {
        let prefs = MuhasabahCloudPrefs(fileURL: nil)
        prefs.setCursor("9")
        #expect(prefs.cursor == "0")

        prefs.enable(for: "a")
        prefs.setCursor("9")
        #expect(prefs.cursor == "9")
        prefs.enable(for: "b")
        #expect(prefs.cursor == "0")
    }

    @Test func itSurvivesARestart() throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("waqtu-muhasabah-cloud-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: dir) }
        let file = dir.appendingPathComponent("muhasabah-cloud.json")
        let prefs = MuhasabahCloudPrefs(fileURL: file)
        prefs.enable(for: "a")
        prefs.setCursor("12")

        let reopened = MuhasabahCloudPrefs(fileURL: file)
        #expect(reopened.isEnabled(for: "a"))
        #expect(reopened.cursor == "12")
        // A file of its own, apart from the journal.
        #expect(file.lastPathComponent == "muhasabah-cloud.json")
    }
}

@MainActor
struct MuhasabahCloudEngineTests {
    private let day = "2027-02-12"

    private func entry(_ date: String, _ fill: (inout MuhasabahEntry) -> Void = { _ in }) -> MuhasabahEntry {
        var e = MuhasabahEntry(date: date)
        fill(&e)
        return e
    }

    private func enabledPrefs() -> MuhasabahCloudPrefs {
        let prefs = MuhasabahCloudPrefs(fileURL: nil)
        prefs.enable(for: "a")
        return prefs
    }

    @Test func pushesTheWholeJournalAndMarksItClean() async throws {
        let server = FakeMuhasabahServer()
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry("2027-02-10") { $0.feelings = "satu" }, now: 100)
        store.save(entry("2027-02-11") { $0.taqwa = 7 }, now: 200)

        let report = try await runMuhasabahSync(store: store, prefs: enabledPrefs(), transport: server)

        #expect(report.pushed == 2)
        #expect(server.dates == ["2027-02-10", "2027-02-11"])
        #expect(server.row("2027-02-11")?.entry == MuhasabahWireEntry(entry("2027-02-11") { $0.taqwa = 7 }))
        #expect(store.dirtyWires().isEmpty)

        let again = try await runMuhasabahSync(store: store, prefs: enabledPrefs(), transport: server)
        #expect(again.pushed == 0)
        #expect(server.pushes.count == 1)
    }

    @Test func pullsWhatAnotherDeviceWroteAndStoresItClean() async throws {
        let server = FakeMuhasabahServer()
        server.seed(MuhasabahWire(date: day, updatedAt: 100, entry: MuhasabahWireEntry(entry(day) { $0.feelings = "dari HP" })))
        let store = MuhasabahStore(fileURL: nil)
        let prefs = enabledPrefs()

        let report = try await runMuhasabahSync(store: store, prefs: prefs, transport: server)

        #expect(report.pulled == 1)
        #expect(store.entry(day)?.feelings == "dari HP")
        #expect(store.dirtyWires().isEmpty)
        #expect(prefs.cursor == "1")
        #expect(server.pushes.isEmpty)
    }

    @Test func aStaleLocalEditLosesToANewerCloudDayBeforeItIsPushed() async throws {
        let server = FakeMuhasabahServer()
        server.seed(MuhasabahWire(date: day, updatedAt: 900, entry: MuhasabahWireEntry(entry(day) { $0.feelings = "baru" })))
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "lama" }, now: 100)

        _ = try await runMuhasabahSync(store: store, prefs: enabledPrefs(), transport: server)

        #expect(store.entry(day)?.feelings == "baru")
        #expect(server.pushes.isEmpty)
    }

    @Test func aDeletionTravelsBothWays() async throws {
        let server = FakeMuhasabahServer()
        let phone = MuhasabahStore(fileURL: nil)
        let mac = MuhasabahStore(fileURL: nil)
        phone.save(entry(day) { $0.feelings = "catatan" }, now: 100)
        let phonePrefs = enabledPrefs()
        let macPrefs = enabledPrefs()
        _ = try await runMuhasabahSync(store: phone, prefs: phonePrefs, transport: server)
        _ = try await runMuhasabahSync(store: mac, prefs: macPrefs, transport: server)
        #expect(mac.entry(day)?.feelings == "catatan")

        mac.delete(day, now: 300)
        _ = try await runMuhasabahSync(store: mac, prefs: macPrefs, transport: server)
        #expect(server.row(day) != nil)
        #expect(server.row(day)?.entry == nil)
        _ = try await runMuhasabahSync(store: phone, prefs: phonePrefs, transport: server)
        #expect(phone.entry(day) == nil)
    }

    @Test func followsPagesAndPushesInChunksOfTwenty() async throws {
        let server = FakeMuhasabahServer()
        server.pullPageSize = 2
        for i in 1...5 {
            let date = String(format: "2027-01-%02d", i)
            server.seed(MuhasabahWire(date: date, updatedAt: Int64(i), entry: body { $0.energy = 5 }))
        }
        let store = MuhasabahStore(fileURL: nil)
        for i in 1...45 {
            let date = DayKeys.addDays("2027-03-01", i)
            store.save(entry(date) { $0.taqwa = 5 }, now: Int64(1000 + i))
        }
        let local = store.dirtyWires().count

        let prefs = enabledPrefs()
        let report = try await runMuhasabahSync(store: store, prefs: prefs, transport: server)

        #expect(report.pulled == 5)
        #expect(server.pulls.count == 3)
        #expect(prefs.cursor == "5")
        #expect(report.pushed == local)
        #expect(server.pushes.allSatisfy { $0.count <= MuhasabahLimits.push })
        #expect(local == 45)
        #expect(server.pushes.map(\.count) == [20, 20, 5])
    }

    @Test func aFailedPushLeavesTheDaysQueued() async throws {
        let server = FakeMuhasabahServer()
        server.failPush = SyncHTTPError(status: 500)
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "x" }, now: 100)

        await #expect(throws: SyncHTTPError.self) {
            _ = try await runMuhasabahSync(store: store, prefs: enabledPrefs(), transport: server)
        }
        #expect(store.dirtyWires().count == 1)
    }

    @Test func turningTheSettingOffStopsARunningPassBeforeItUploadsAnything() async throws {
        let server = FakeMuhasabahServer()
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(day) { $0.feelings = "x" }, now: 100)
        let prefs = enabledPrefs()

        let report = try await runMuhasabahSync(store: store, prefs: prefs, transport: server, isActive: { false })

        #expect(report == MuhasabahSyncReport())
        #expect(server.pushes.isEmpty)
        #expect(server.pulls.isEmpty)
    }

    @Test func enablingAgainAfterTheCloudCopyWasDeletedUploadsTheJournalAgain() async throws {
        let server = FakeMuhasabahServer()
        let store = MuhasabahStore(fileURL: nil)
        let prefs = MuhasabahCloudPrefs(fileURL: nil)
        store.save(entry(day) { $0.feelings = "x" }, now: 100)

        prefs.enable(for: "a")
        store.markAllDirty()
        _ = try await runMuhasabahSync(store: store, prefs: prefs, transport: server)
        #expect(server.dates == [day])

        // Off, the cloud copy deleted, on again: the Mac's own copy goes up once more.
        prefs.disable()
        server.deleteAll()
        prefs.enable(for: "a")
        store.markAllDirty()
        _ = try await runMuhasabahSync(store: store, prefs: prefs, transport: server)
        #expect(server.dates == [day])
        #expect(store.entry(day)?.feelings == "x")
    }
}
