//
//  MutabaahChecklistTests.swift
//  waqtuTests
//
//  The Mac checklist over the account replica: the `items` setting and entry values travel
//  between the phone and the Mac unchanged. JSON strings are what apps/mobile/src/mutabaah/items.ts
//  produces for the same edits (generated with bun).
//

import Foundation
import Testing

@MainActor
struct MutabaahChecklistTests {
    private let day = "2027-02-08"

    /// Phone: DEFAULT_ITEMS − puasa + halaqah + custom "Baca Al-Kahfi" (token kahf0001).
    private let phoneItems = #"[{"id":"fajr","kind":"fardh"},{"id":"dhuhr","kind":"fardh"},{"id":"asr","kind":"fardh"},{"id":"maghrib","kind":"fardh"},{"id":"isha","kind":"fardh"},{"id":"rawatib","kind":"check"},{"id":"dhuha","kind":"check"},{"id":"tahajjud","kind":"check"},{"id":"tilawah","kind":"count"},{"id":"dzikir_pagi","kind":"check"},{"id":"dzikir_petang","kind":"check"},{"id":"sedekah","kind":"check"},{"id":"halaqah","kind":"check"},{"id":"c.kahf0001","kind":"check","label":"Baca Al-Kahfi"}]"#

    /// The same edit made on the phone: DEFAULT_ITEMS − sedekah + custom count "  Istighfar  " (token istg2026).
    private let macEditAsPhone = #"[{"id":"fajr","kind":"fardh"},{"id":"dhuhr","kind":"fardh"},{"id":"asr","kind":"fardh"},{"id":"maghrib","kind":"fardh"},{"id":"isha","kind":"fardh"},{"id":"rawatib","kind":"check"},{"id":"dhuha","kind":"check"},{"id":"tahajjud","kind":"check"},{"id":"tilawah","kind":"count"},{"id":"dzikir_pagi","kind":"check"},{"id":"dzikir_petang","kind":"check"},{"id":"puasa","kind":"check"},{"id":"c.istg2026","kind":"count","label":"Istighfar"}]"#

    @Test func noStoredListMeansDefaultsAndNothingIsUploaded() async throws {
        let replica = MutabaahReplica(fileURL: nil)
        #expect(MutabaahChecklist.items(in: replica) == MutabaahItems.defaultItems)
        #expect(!replica.hasDirtyRows)
    }

    @Test func phoneListArrivesOnTheMac() async throws {
        let server = FakeServer()
        server.seed(SyncSetting(key: MutabaahSettingKey.items, value: phoneItems, updatedAt: 100))
        let replica = MutabaahReplica(fileURL: nil)

        _ = try await runSync(store: replica, transport: server)

        let items = MutabaahChecklist.items(in: replica)
        #expect(items.map(\.id) == [
            "fajr", "dhuhr", "asr", "maghrib", "isha", "rawatib", "dhuha", "tahajjud", "tilawah",
            "dzikir_pagi", "dzikir_petang", "sedekah", "halaqah", "c.kahf0001",
        ])
        #expect(items.last == ItemDef(id: "c.kahf0001", kind: .check, label: "Baca Al-Kahfi"))
        #expect(items.first(where: { $0.id == "tilawah" })?.kind == .count)
    }

    @Test func macListEditReachesTheServerInThePhonesFormat() async throws {
        let server = FakeServer()
        let replica = MutabaahReplica(fileURL: nil)
        var items = MutabaahChecklist.items(in: replica)
        items = MutabaahItems.removeItem(items, id: "sedekah")
        items = MutabaahItems.addCustomItem(items, label: "  Istighfar  ", kind: .count, random: { "istg2026" })
        #expect(MutabaahChecklist.setItems(items, in: replica, at: 200))
        #expect(!MutabaahChecklist.setItems(items, in: replica, at: 300))

        _ = try await runSync(store: replica, transport: server)

        #expect(server.setting(MutabaahSettingKey.items)?.value == macEditAsPhone)
        #expect(!replica.hasDirtyRows)
    }

    @Test func entryValuesUseThePhonesEncoding() async throws {
        let server = FakeServer()
        let replica = MutabaahReplica(fileURL: nil)

        let jamaah = MutabaahChecklist.applyFardh(.jamaah, fardh: .fajr, date: day, in: replica, at: 10)
        #expect(MutabaahChecklist.value(date: day, itemId: "fajr", in: replica) == FardhFlag.done | FardhFlag.onTime | FardhFlag.jamaah)
        #expect(jamaah == PrayerLogChange(date: day, prayer: "Fajr", status: .prayed, at: FardhMapping.date(fromMillis: 10)))

        let qadha = MutabaahChecklist.applyFardh(.qadha, fardh: .fajr, date: day, in: replica, at: 20)
        #expect(MutabaahChecklist.value(date: day, itemId: "fajr", in: replica) == 13)
        #expect(qadha?.status == .late)

        _ = MutabaahChecklist.applyFardh(.done, fardh: .isha, date: day, in: replica, at: 30)
        #expect(MutabaahChecklist.value(date: day, itemId: "isha", in: replica) == 3)

        #expect(MutabaahChecklist.toggleCheck(itemId: "dhuha", date: day, in: replica, at: 40))
        #expect(MutabaahChecklist.value(date: day, itemId: "dhuha", in: replica) == 1)
        #expect(MutabaahChecklist.setCount(12, itemId: "tilawah", date: day, in: replica, at: 50))
        #expect(MutabaahChecklist.setCount(25_000, itemId: "c.istg2026", date: day, in: replica, at: 60))
        #expect(MutabaahChecklist.value(date: day, itemId: "c.istg2026", in: replica) == MutabaahItems.maxCount)

        _ = try await runSync(store: replica, transport: server)

        #expect(server.entry(day, "fajr")?.value == 13)
        #expect(server.entry(day, "isha")?.value == 3)
        #expect(server.entry(day, "dhuha")?.value == 1)
        #expect(server.entry(day, "tilawah")?.value == 12)
        #expect(server.entry(day, "c.istg2026")?.value == 10_000)
    }

    @Test func untickingClearsToZeroAndAMissingRowIsNotWritten() {
        let replica = MutabaahReplica(fileURL: nil)
        #expect(!MutabaahChecklist.setCount(0, itemId: "tilawah", date: day, in: replica, at: 5))
        #expect(!MutabaahChecklist.setCount(-4, itemId: "tilawah", date: day, in: replica, at: 5))

        #expect(MutabaahChecklist.toggleCheck(itemId: "sedekah", date: day, in: replica, at: 10))
        #expect(MutabaahChecklist.toggleCheck(itemId: "sedekah", date: day, in: replica, at: 20))
        #expect(replica.entryValue(date: day, itemId: "sedekah") == 0)

        _ = MutabaahChecklist.applyFardh(.done, fardh: .asr, date: day, in: replica, at: 30)
        let cleared = MutabaahChecklist.applyFardh(.done, fardh: .asr, date: day, in: replica, at: 40)
        #expect(replica.entryValue(date: day, itemId: "asr") == 0)
        #expect(cleared?.status == nil)
        #expect(cleared?.prayer == "Asr")
    }

    @Test func phoneFlagsSurviveAMacEditOfAnotherItem() async throws {
        let server = FakeServer()
        server.seed(SyncEntry(date: day, itemId: "maghrib", value: 7, updatedAt: 100))
        server.seed(SyncEntry(date: day, itemId: "tilawah", value: 4, updatedAt: 100))
        let replica = MutabaahReplica(fileURL: nil)
        _ = try await runSync(store: replica, transport: server)

        #expect(MutabaahChecklist.value(date: day, itemId: "maghrib", in: replica) == 7)
        #expect(MutabaahChecklist.setCount(5, itemId: "tilawah", date: day, in: replica, at: 50))
        _ = try await runSync(store: replica, transport: server)

        #expect(server.pushes.last?.entries.map(\.itemId) == ["tilawah"])
        // Stamped after the pulled row even though the Mac clock is behind.
        #expect(server.entry(day, "tilawah")?.value == 5)
        #expect(server.entry(day, "maghrib")?.value == 7)
    }

    @Test func doneCountFollowsEachKindsRule() {
        let replica = MutabaahReplica(fileURL: nil)
        let items = MutabaahItems.defaultItems
        _ = MutabaahChecklist.applyFardh(.qadha, fardh: .dhuhr, date: day, in: replica, at: 1)
        _ = MutabaahChecklist.toggleCheck(itemId: "rawatib", date: day, in: replica, at: 2)
        _ = MutabaahChecklist.setCount(2, itemId: "tilawah", date: day, in: replica, at: 3)
        #expect(MutabaahChecklist.doneCount(items: items, date: day, in: replica) == 3)
        #expect(MutabaahChecklist.doneCount(items: items, date: "2027-02-09", in: replica) == 0)
    }

    @Test func randomTokensMakeValidCustomIds() {
        for _ in 0..<50 {
            let token = MutabaahChecklist.randomToken()
            #expect(token.count == 10)
            #expect(MutabaahItems.isCustomId("c.\(token)"))
        }
    }
}
