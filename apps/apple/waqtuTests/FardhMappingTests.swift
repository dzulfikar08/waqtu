//
//  FardhMappingTests.swift
//  waqtuTests
//
//  Prayer log ↔ mutabaah entry mapping and the replica rules around it.
//

import Foundation
import Testing

struct FardhMappingTests {
    @Test func statusMapsToTheFlagsThePhoneUses() {
        #expect(FardhMapping.value(for: .prayed) == FardhFlag.done | FardhFlag.onTime)
        #expect(FardhMapping.value(for: .late) == FardhFlag.done)
        #expect(FardhMapping.value(for: .missed) == 0)
    }

    @Test func valueMapsBackToAStatus() {
        #expect(FardhMapping.status(forValue: 0) == nil)
        #expect(FardhMapping.status(forValue: 3) == .prayed)
        #expect(FardhMapping.status(forValue: 7) == .prayed)  // + jamaah
        #expect(FardhMapping.status(forValue: 1) == .late)
        #expect(FardhMapping.status(forValue: 9) == .late)  // done + qadha, not on time
        #expect(FardhMapping.status(forValue: 4) == nil)  // jamaah alone is not done
    }

    @Test func logEntryBecomesAMutabaahEntryForTheFiveFardhuOnly() {
        let fajr = logEntry("2027-02-08", "Fajr", .prayed, at: 1_800_000_000_000)
        #expect(FardhMapping.entry(for: fajr) == SyncEntry(date: "2027-02-08", itemId: "fajr", value: 3, updatedAt: 1_800_000_000_000))
        #expect(FardhMapping.entry(for: logEntry("2027-02-08", "Isha", .late, at: 5))?.itemId == "isha")
        #expect(FardhMapping.entry(for: logEntry("2027-02-08", "Tahajjud", .prayed, at: 5)) == nil)
        #expect(FardhMapping.entry(for: logEntry("08-02-2027", "Fajr", .prayed, at: 5)) == nil)
        #expect(FardhMapping.entry(for: logEntry("2027-02-30", "Fajr", .prayed, at: 5)) == nil)
    }

    @Test func pulledEntryBecomesALogChange() {
        let change = FardhMapping.change(for: SyncEntry(date: "2027-02-08", itemId: "maghrib", value: 3, updatedAt: 42_000))
        #expect(change?.prayer == "Maghrib")
        #expect(change?.status == .prayed)
        #expect(change?.at == Date(timeIntervalSince1970: 42))
        #expect(FardhMapping.change(for: SyncEntry(date: "2027-02-08", itemId: "maghrib", value: 0, updatedAt: 1))?.status == nil)
        #expect(FardhMapping.change(for: SyncEntry(date: "2027-02-08", itemId: "tilawah", value: 12, updatedAt: 1)) == nil)
        #expect(FardhMapping.change(for: SyncEntry(date: "2027-02-08", itemId: "c.abcd1234", value: 1, updatedAt: 1)) == nil)
    }

    @Test func dayKeyIsTheGregorianLocalDay() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Jakarta")!
        // 2027-02-07 20:00 UTC is already the 8th in Jakarta.
        let date = Date(timeIntervalSince1970: 1_802_030_400)
        #expect(FardhMapping.dayKey(for: date, calendar: cal) == "2027-02-08")
    }

    @Test func dayKeyValidation() {
        #expect(FardhMapping.isDayKey("2028-02-29"))
        #expect(!FardhMapping.isDayKey("2027-02-29"))
        #expect(!FardhMapping.isDayKey("2027-13-01"))
        #expect(!FardhMapping.isDayKey("2027-1-01"))
        #expect(!FardhMapping.isDayKey("hello"))
    }
}

struct LogSyncTests {
    @Test func localEditIsRecordedDirtyAtItsTimestamp() {
        let replica = MutabaahReplica(fileURL: nil)
        let change = PrayerLogChange(date: "2027-02-08", prayer: "Dhuhr", status: .prayed, at: FardhMapping.date(fromMillis: 1000))

        #expect(LogSync.record(change, in: replica))

        #expect(replica.dirtyEntries() == [SyncEntry(date: "2027-02-08", itemId: "dhuhr", value: 3, updatedAt: 1000)])
    }

    @Test func clearingRecordsZeroOnlyWhenSomethingWasThere() {
        let replica = MutabaahReplica(fileURL: nil)
        let clear = PrayerLogChange(date: "2027-02-08", prayer: "Dhuhr", status: nil, at: FardhMapping.date(fromMillis: 2000))
        #expect(!LogSync.record(clear, in: replica))

        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "dhuhr", value: 3, updatedAt: 1000))
        #expect(LogSync.record(clear, in: replica))
        #expect(replica.entryValue(date: "2027-02-08", itemId: "dhuhr") == 0)
    }

    @Test func missedIsRecordedAsNothingAndOverridesAnEarlierDone() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "asr", value: 3, updatedAt: 1000))
        let missed = PrayerLogChange(date: "2027-02-08", prayer: "Asr", status: .missed, at: FardhMapping.date(fromMillis: 3000))

        #expect(LogSync.record(missed, in: replica))
        #expect(replica.entryValue(date: "2027-02-08", itemId: "asr") == 0)
    }

    @Test func resavingTheSameStateKeepsThePhonesExtraFlags() {
        let replica = MutabaahReplica(fileURL: nil)
        // The phone marked Isha prayed in jamaah (7); the Mac log shows it as prayed.
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "isha", value: 7, updatedAt: 1000))
        let change = PrayerLogChange(date: "2027-02-08", prayer: "Isha", status: .prayed, at: FardhMapping.date(fromMillis: 5000))

        #expect(!LogSync.record(change, in: replica))
        #expect(replica.entryValue(date: "2027-02-08", itemId: "isha") == 7)
    }

    @Test func localEditBeatsARemoteRowWithAFutureClock() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "fajr", value: 3, updatedAt: 9_000))
        let clear = PrayerLogChange(date: "2027-02-08", prayer: "Fajr", status: nil, at: FardhMapping.date(fromMillis: 1_000))

        #expect(LogSync.record(clear, in: replica))
        #expect(replica.dirtyEntries().first?.updatedAt == 9_001)
    }

    @Test func reconcileQueuesTheLogOnFirstSignInAndNothingTwice() {
        let replica = MutabaahReplica(fileURL: nil)
        let log = [
            logEntry("2027-02-08", "Fajr", .prayed, at: 1000),
            logEntry("2027-02-08", "Dhuhr", .late, at: 2000),
            logEntry("2027-02-08", "Asr", .missed, at: 3000),
            logEntry("2027-02-08", "Witr", .prayed, at: 4000),
        ]

        #expect(LogSync.reconcile(log: log, into: replica) == 2)
        #expect(replica.dirtyEntries().map(\.itemId).sorted() == ["dhuhr", "fajr"])
        #expect(LogSync.reconcile(log: log, into: replica) == 0)
    }

    @Test func clearMadeWhileSignedOutIsRecordedAtTheTimeOfTheClear() {
        let replica = MutabaahReplica(fileURL: nil)
        // Fajr was pulled in an earlier session; the user cleared it on the Mac while signed out.
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "fajr", value: 3, updatedAt: 1000))
        let cleared = [FardhMapping.clearKey(date: "2027-02-08", prayer: "Fajr"): FardhMapping.date(fromMillis: 5000)]

        #expect(LogSync.reconcile(log: [], cleared: cleared, into: replica) == 1)
        #expect(replica.dirtyEntries() == [SyncEntry(date: "2027-02-08", itemId: "fajr", value: 0, updatedAt: 5000)])
        // Nothing new the second time round.
        #expect(LogSync.reconcile(log: [], cleared: cleared, into: replica) == 0)
    }

    @Test func clearBeatsARemoteRowStampedAfterIt() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "isha", value: 3, updatedAt: 9000))
        let cleared = [FardhMapping.clearKey(date: "2027-02-08", prayer: "Isha"): FardhMapping.date(fromMillis: 5000)]

        #expect(LogSync.reconcile(log: [], cleared: cleared, into: replica) == 1)
        #expect(replica.dirtyEntries().first?.updatedAt == 9001)
    }

    @Test func rowsMissingFromTheLogWithoutAClearMarkAreNotZeroed() {
        let replica = MutabaahReplica(fileURL: nil)
        // A pull stored this row but the app was closed before it reached the log.
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "dhuhr", value: 3, updatedAt: 1000))

        #expect(LogSync.reconcile(log: [], into: replica) == 0)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "dhuhr") == 3)
        #expect(!replica.hasDirtyRows)
    }

    @Test func clearMarkIsIgnoredOnceThePrayerIsLoggedAgain() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "asr", value: 3, updatedAt: 1000))
        let cleared = [FardhMapping.clearKey(date: "2027-02-08", prayer: "Asr"): FardhMapping.date(fromMillis: 5000)]
        let log = [logEntry("2027-02-08", "Asr", .prayed, at: 6000)]

        #expect(LogSync.reconcile(log: log, cleared: cleared, into: replica) == 0)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "asr") == 3)
    }

    @Test func clearMarkForAPrayerTheReplicaNeverHadWritesNothing() {
        let replica = MutabaahReplica(fileURL: nil)
        let cleared = [FardhMapping.clearKey(date: "2027-02-08", prayer: "Maghrib"): FardhMapping.date(fromMillis: 5000)]

        #expect(LogSync.reconcile(log: [], cleared: cleared, into: replica) == 0)
        #expect(!replica.hasDirtyRows)
    }

    @Test func reconcileLeavesNewerReplicaRowsAlone() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.putRemoteEntry(SyncEntry(date: "2027-02-08", itemId: "fajr", value: 0, updatedAt: 9000))

        #expect(LogSync.reconcile(log: [logEntry("2027-02-08", "Fajr", .prayed, at: 1000)], into: replica) == 0)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "fajr") == 0)
    }
}

struct MutabaahReplicaTests {
    @Test func firstSignInKeepsOfflineRowsAndADifferentAccountClearsThem() {
        let replica = MutabaahReplica(fileURL: nil)
        replica.recordLocalEntry(date: "2027-02-08", itemId: "fajr", value: 3, at: 100)
        replica.recordLocalSetting(key: "asr", value: "hanafi", at: 100)
        replica.setCursor("12")

        #expect(replica.prepareAccount(userId: "u1") == .firstSignIn)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "fajr") == 3)
        #expect(replica.cursor() == "0")

        replica.setCursor("7")
        #expect(replica.prepareAccount(userId: "u1") == .unchanged)
        #expect(replica.cursor() == "7")

        #expect(replica.prepareAccount(userId: "u2") == .replaced)
        #expect(replica.entryValue(date: "2027-02-08", itemId: "fajr") == nil)
        #expect(replica.settingValue("asr") == nil)
        #expect(replica.cursor() == "0")
    }

    @Test func persistsToDiskAndReloads() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let file = dir.appendingPathComponent("replica.json")
        defer { try? FileManager.default.removeItem(at: dir) }

        let first = MutabaahReplica(fileURL: file)
        first.prepareAccount(userId: "u1")
        first.recordLocalEntry(date: "2027-02-08", itemId: "maghrib", value: 3, at: 700)
        first.setCursor("4")
        first.commit()

        let second = MutabaahReplica(fileURL: file)
        #expect(second.state.userId == "u1")
        #expect(second.cursor() == "4")
        #expect(second.dirtyEntries() == [SyncEntry(date: "2027-02-08", itemId: "maghrib", value: 3, updatedAt: 700)])
    }

    @Test func noOpEditsWriteNothing() {
        let replica = MutabaahReplica(fileURL: nil)
        #expect(!replica.recordLocalEntry(date: "2027-02-08", itemId: "fajr", value: 0, at: 1))
        #expect(replica.recordLocalEntry(date: "2027-02-08", itemId: "fajr", value: 3, at: 2))
        #expect(!replica.recordLocalEntry(date: "2027-02-08", itemId: "fajr", value: 3, at: 3))
        #expect(replica.dirtyEntries().first?.updatedAt == 2)
    }
}
