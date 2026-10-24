//
//  SyncMergeTests.swift
//  waqtuTests
//
//  Last-write-wins rules and the pull/push engine against a fake server.
//

import Foundation
import Testing

struct SyncMergeTests {
    private func entry(_ value: Int, at ms: Int64) -> SyncEntry {
        SyncEntry(date: "2027-02-08", itemId: "fajr", value: value, updatedAt: ms)
    }

    @Test func newerTimestampWins() {
        #expect(SyncMerge.entryWins(entry(0, at: 20), over: entry(3, at: 10)))
        #expect(!SyncMerge.entryWins(entry(3, at: 10), over: entry(0, at: 20)))
    }

    @Test func equalTimestampGreaterValueWinsAndIdenticalDoesNot() {
        #expect(SyncMerge.entryWins(entry(3, at: 10), over: entry(1, at: 10)))
        #expect(!SyncMerge.entryWins(entry(1, at: 10), over: entry(3, at: 10)))
        #expect(!SyncMerge.entryWins(entry(3, at: 10), over: entry(3, at: 10)))
    }

    @Test func missingRowAlwaysLoses() {
        #expect(SyncMerge.entryWins(entry(0, at: 0), over: nil))
        #expect(SyncMerge.settingWins(SyncSetting(key: "method", value: "mwl", updatedAt: 0), over: nil))
    }

    @Test func settingTieBreaksOnBytewiseValue() {
        let a = SyncSetting(key: "method", value: "kemenag", updatedAt: 5)
        let b = SyncSetting(key: "method", value: "mwl", updatedAt: 5)
        #expect(SyncMerge.settingWins(b, over: a))
        #expect(!SyncMerge.settingWins(a, over: b))
    }

    @Test func chunkSplitsInOrder() {
        #expect(SyncMerge.chunk([1, 2, 3, 4, 5], size: 2) == [[1, 2], [3, 4], [5]])
        #expect(SyncMerge.chunk([Int](), size: 2).isEmpty)
    }
}

@MainActor
struct SyncEngineTests {
    private func fardh(_ date: String, _ id: String, _ value: Int, _ ms: Int64) -> SyncEntry {
        SyncEntry(date: date, itemId: id, value: value, updatedAt: ms)
    }

    @Test func pullsServerRowsAndStoresThemClean() async throws {
        let server = FakeServer()
        server.seed(fardh("2027-02-08", "fajr", 3, 100))
        server.seed(SyncSetting(key: "asr", value: "hanafi", updatedAt: 100))
        let replica = MutabaahReplica(fileURL: nil)

        let report = try await runSync(store: replica, transport: server)

        #expect(report.pulledEntries == [fardh("2027-02-08", "fajr", 3, 100)])
        #expect(report.pulledSettings.map(\.key) == ["asr"])
        #expect(replica.entryValue(date: "2027-02-08", itemId: "fajr") == 3)
        #expect(replica.settingValue("asr") == "hanafi")
        #expect(!replica.hasDirtyRows)
        #expect(server.pushes.isEmpty)
    }

    @Test func staleLocalEditLosesToNewerRemoteBeforeItIsPushed() async throws {
        let server = FakeServer()
        server.seed(fardh("2027-02-08", "dhuhr", 0, 500))
        let replica = MutabaahReplica(fileURL: nil)
        // Dirty at 400, older than the server's row at 500.
        replica.recordLocalEntry(date: "2027-02-08", itemId: "dhuhr", value: 3, at: 400)

        let report = try await runSync(store: replica, transport: server)

        #expect(report.pulledEntries.count == 1)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "dhuhr") == 0)
        #expect(server.pushes.isEmpty)
    }

    @Test func newerLocalEditIsPushedAndMarkedClean() async throws {
        let server = FakeServer()
        server.seed(fardh("2027-02-08", "asr", 1, 100))
        let replica = MutabaahReplica(fileURL: nil)
        replica.recordLocalEntry(date: "2027-02-08", itemId: "asr", value: 3, at: 200)

        let report = try await runSync(store: replica, transport: server)

        #expect(report.pushed == 1)
        #expect(server.entry("2027-02-08", "asr")?.value == 3)
        #expect(!replica.hasDirtyRows)

        let again = try await runSync(store: replica, transport: server)
        #expect(again.pushed == 0)
        #expect(server.pushes.count == 1)
    }

    @Test func followsPagesUntilNoMore() async throws {
        let server = FakeServer()
        server.pullPageSize = 2
        for i in 1...5 { server.seed(fardh("2027-02-0\(i)", "isha", 3, Int64(i))) }
        let replica = MutabaahReplica(fileURL: nil)

        let report = try await runSync(store: replica, transport: server)

        #expect(report.pulledEntries.count == 5)
        #expect(replica.cursor() == "5")
    }

    @Test func editMadeDuringSyncStaysQueued() async throws {
        let replica = MutabaahReplica(fileURL: nil)
        replica.recordLocalEntry(date: "2027-02-08", itemId: "maghrib", value: 3, at: 100)
        let pushed = replica.dirtyEntries()
        // The user changes the same cell while the push is in flight.
        replica.recordLocalEntry(date: "2027-02-08", itemId: "maghrib", value: 0, at: 200)

        replica.markEntriesClean(pushed)

        #expect(replica.hasDirtyRows)
        #expect(replica.dirtyEntries().first?.value == 0)
    }

    @Test func pushFailureLeavesRowsDirty() async throws {
        let server = FakeServer()
        server.failPush = SyncHTTPError(status: 500)
        let replica = MutabaahReplica(fileURL: nil)
        replica.recordLocalEntry(date: "2027-02-08", itemId: "fajr", value: 3, at: 100)

        await #expect(throws: SyncHTTPError.self) {
            _ = try await runSync(store: replica, transport: server)
        }
        #expect(replica.hasDirtyRows)
    }

    @Test func clearMadeWhileSignedOutReachesTheServerOnTheNextSync() async throws {
        let server = FakeServer()
        server.seed(fardh("2027-02-08", "fajr", 3, 1000))
        let replica = MutabaahReplica(fileURL: nil)
        replica.prepareAccount(userId: "u1")
        _ = try await runSync(store: replica, transport: server)
        #expect(server.entry("2027-02-08", "fajr")?.value == 3)

        // Signed out: the user unticks Fajr; the Mac log no longer has it.
        let cleared = [FardhMapping.clearKey(date: "2027-02-08", prayer: "Fajr"): FardhMapping.date(fromMillis: 5000)]
        // Signed in again with the same account.
        #expect(replica.prepareAccount(userId: "u1") == .unchanged)
        LogSync.reconcile(log: [], cleared: cleared, into: replica)
        _ = try await runSync(store: replica, transport: server)

        #expect(server.entry("2027-02-08", "fajr") == fardh("2027-02-08", "fajr", 0, 5000))
        #expect(!replica.hasDirtyRows)
    }

    @Test func settingsOutsideTheWhitelistAreNeverStoredOrPushed() async throws {
        let server = FakeServer()
        server.seed(SyncSetting(key: "lat", value: "-6.2", updatedAt: 1))
        let replica = MutabaahReplica(fileURL: nil)

        _ = try await runSync(store: replica, transport: server)
        #expect(replica.settingValue("lat") == nil)

        replica.recordLocalSetting(key: "lon", value: "106.8", at: 5)
        #expect(replica.dirtySettings().isEmpty)
        _ = try await runSync(store: replica, transport: server)
        #expect(server.setting("lon") == nil)
    }
}
