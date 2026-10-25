//
//  MutabaahItemsTests.swift
//  waqtuTests
//
//  Parity with apps/mobile/test/items.test.ts, plus byte-for-byte round trips of JSON the
//  phone's `serializeItems` wrote (strings generated with bun from apps/mobile/src/mutabaah/items.ts).
//

import Foundation
import Testing

struct MutabaahItemsTests {
    private let done = FardhFlag.done
    private let ontime = FardhFlag.onTime
    private let jamaah = FardhFlag.jamaah
    private let qadha = FardhFlag.qadha

    // MARK: fardh flags

    @Test func doneMeansOnTimeTappingAgainClearsEverything() {
        let d = MutabaahItems.toggleFardh(0, .done)
        #expect(d == done | ontime)
        #expect(MutabaahItems.toggleFardh(d | jamaah, .done) == 0)
    }

    @Test func jamaahOnAnEmptyPrayerRecordsItDoneOnTimeWithJamaah() {
        #expect(MutabaahItems.toggleFardh(0, .jamaah) == done | ontime | jamaah)
        #expect(MutabaahItems.toggleFardh(done | ontime | jamaah, .jamaah) == done | ontime)
    }

    @Test func qadhaReplacesOnTimeAndTogglesBackOff() {
        let q = MutabaahItems.toggleFardh(done | ontime, .qadha)
        #expect(q == done | qadha)
        #expect(MutabaahItems.toggleFardh(q, .qadha) == done)
        #expect(MutabaahItems.toggleFardh(0, .qadha) == done | qadha)
    }

    @Test func onTimeClearsQadhaAndToggles() {
        #expect(MutabaahItems.toggleFardh(done | qadha, .ontime) == done | ontime)
        #expect(MutabaahItems.toggleFardh(done | ontime, .ontime) == done)
    }

    @Test func notificationActionKeepsWhatIsAlreadyRecorded() {
        #expect(MutabaahItems.markedFromNotification(0, onTime: true) == done | ontime)
        #expect(MutabaahItems.markedFromNotification(0, onTime: false) == done)
        let rich = done | jamaah | ontime
        #expect(MutabaahItems.markedFromNotification(rich, onTime: false) == rich)
    }

    @Test func isDoneByKind() {
        #expect(MutabaahItems.isDone(.fardh, done))
        #expect(!MutabaahItems.isDone(.fardh, jamaah))
        #expect(!MutabaahItems.isDone(.count, 0))
        #expect(MutabaahItems.isDone(.count, 2))
        #expect(MutabaahItems.isDone(.check, 1))
    }

    // MARK: checklist items

    @Test func defaultsToTheBuiltinsWithoutTheOptInHalaqahAndMurojaahItems() {
        #expect(MutabaahItems.parseItems(nil) == MutabaahItems.defaultItems)
        #expect(MutabaahItems.parseItems("garbage") == MutabaahItems.defaultItems)
        #expect(MutabaahItems.parseItems("{}") == MutabaahItems.defaultItems)
        #expect(!MutabaahItems.defaultItems.contains { $0.id == "halaqah" })
        #expect(MutabaahItems.builtinItems.contains { $0.id == "halaqah" })
        #expect(!MutabaahItems.defaultItems.contains { $0.id == "murojaah" })
        #expect(MutabaahItems.builtinItems.first { $0.id == "murojaah" } == ItemDef(id: "murojaah", kind: .check))
    }

    @Test func addCustomRemoveAddBuiltinBackRoundTrip() {
        var items = MutabaahItems.defaultItems
        items = MutabaahItems.addCustomItem(items, label: "  Baca Al-Mulk  ", kind: .check) { "abcd1234" }
        #expect(items.last == ItemDef(id: "c.abcd1234", kind: .check, label: "Baca Al-Mulk"))
        items = MutabaahItems.removeItem(items, id: "tahajjud")
        #expect(MutabaahItems.missingBuiltins(items).map(\.id) == ["tahajjud", "halaqah", "murojaah"])
        items = MutabaahItems.addBuiltinItem(items, id: "tahajjud")
        #expect(items.last?.id == "tahajjud")
        #expect(MutabaahItems.parseItems(MutabaahItems.serializeItems(items)) == items)
    }

    @Test func customIdsNeverCollideAndBlankLabelsAreIgnored() {
        let base = MutabaahItems.addCustomItem(MutabaahItems.builtinItems, label: "A", kind: .count) { "same0000" }
        var seq = ["same0000", "other111"]
        let next = MutabaahItems.addCustomItem(base, label: "B", kind: .check) { seq.removeFirst() }
        #expect(next.map(\.id).suffix(2) == ["c.same0000", "c.other111"])
        #expect(MutabaahItems.addCustomItem(base, label: "   ", kind: .check) { "zzzz0000" } == base)
    }

    @Test func parseDropsInvalidDuplicateAndFardhKindCustomEntries() {
        let raw = #"[{"id":"fajr","kind":"fardh"},{"id":"fajr","kind":"fardh"},{"id":"c.abcd1234","kind":"check","label":"Ok"},{"id":"c.bad","kind":"check","label":"short id"},{"id":"c.abcd5678","kind":"fardh","label":"fake fardh"},{"id":"c.abcd9999","kind":"count"},42]"#
        #expect(MutabaahItems.parseItems(raw).map(\.id) == ["fajr", "c.abcd1234"])
    }

    // MARK: constants and helpers

    @Test func builtinOrderIdsAndKindsMatchThePhone() {
        #expect(MutabaahItems.builtinItems.map(\.id) == [
            "fajr", "dhuhr", "asr", "maghrib", "isha", "rawatib", "dhuha", "tahajjud", "tilawah",
            "dzikir_pagi", "dzikir_petang", "sedekah", "puasa", "halaqah", "murojaah",
        ])
        #expect(MutabaahItems.builtinItems.first { $0.id == "tilawah" }?.kind == .count)
        #expect(MutabaahItems.builtinItems.filter { $0.kind == .fardh }.map(\.id) == Fardh.allCases.map(\.rawValue))
        #expect(MutabaahItems.isBuiltinId("dhuha"))
        #expect(!MutabaahItems.isBuiltinId("c.abcd1234"))
        #expect(MutabaahSettingKey.items == "items")
        #expect(MutabaahSettingKey.streak == "streak")
        #expect(ItemKind.allCases.map(\.rawValue) == ["fardh", "check", "count"])
    }

    @Test func customIdPattern() {
        #expect(MutabaahItems.isCustomId("c.abcd"))
        #expect(MutabaahItems.isCustomId("c." + String(repeating: "a", count: 32)))
        #expect(!MutabaahItems.isCustomId("c." + String(repeating: "a", count: 33)))
        #expect(!MutabaahItems.isCustomId("c.abc"))
        #expect(!MutabaahItems.isCustomId("c.ABCD"))
        #expect(!MutabaahItems.isCustomId("d.abcd"))
        #expect(!MutabaahItems.isCustomId("c.ab_d"))
    }

    @Test func clampCountTruncatesThenClamps() {
        #expect(MutabaahItems.clampCount(3.9) == 3)
        #expect(MutabaahItems.clampCount(-2.5) == 0)
        #expect(MutabaahItems.clampCount(12_345.0) == 10_000)
        #expect(MutabaahItems.clampCount(-7) == 0)
        #expect(MutabaahItems.clampCount(42) == 42)
        #expect(MutabaahItems.clampCount(10_001) == 10_000)
    }

    @Test func labelIsTrimmedAndCutAtFortyUTF16Units() {
        let long = String(repeating: "a", count: 50)
        let added = MutabaahItems.addCustomItem([], label: "\u{FEFF}\u{3000} \(long)\n", kind: .count) { "abcd0000" }
        #expect(added.last?.label == String(repeating: "a", count: 40))
        // "😀" is two UTF-16 units: 25 of them are 50 units, the first 40 units are exactly 20 emoji.
        let emoji = String(repeating: "😀", count: 25)
        let parsed = MutabaahItems.parseItems(#"[{"id":"c.emoj0002","kind":"check","label":"\#(emoji)"}]"#)
        #expect(parsed.first?.label == String(repeating: "😀", count: 20))
    }

    @Test func entryValueEncodings() {
        // fardh: bit flags; check: 0/1; count: non-negative integer.
        for value in 0...15 {
            #expect(MutabaahItems.isDone(.fardh, value) == (value & 1 != 0))
        }
        #expect(!MutabaahItems.isDone(.check, 0))
        #expect(MutabaahItems.isDone(.check, 1))
        #expect(MutabaahItems.isDone(.count, MutabaahItems.maxCount))
        #expect(FardhMapping.value(for: .prayed) == MutabaahItems.toggleFardh(0, .done))
    }

    // MARK: byte parity with the phone's JSON

    /// `serializeItems(BUILTIN_ITEMS)` from bun.
    private let tsBuiltins = #"[{"id":"fajr","kind":"fardh"},{"id":"dhuhr","kind":"fardh"},{"id":"asr","kind":"fardh"},{"id":"maghrib","kind":"fardh"},{"id":"isha","kind":"fardh"},{"id":"rawatib","kind":"check"},{"id":"dhuha","kind":"check"},{"id":"tahajjud","kind":"check"},{"id":"tilawah","kind":"count"},{"id":"dzikir_pagi","kind":"check"},{"id":"dzikir_petang","kind":"check"},{"id":"sedekah","kind":"check"},{"id":"puasa","kind":"check"},{"id":"halaqah","kind":"check"},{"id":"murojaah","kind":"check"}]"#

    /// DEFAULT_ITEMS plus `addCustomItem(items, '  Baca "Al-Mulk" \\ / ✨ سورة 😀\t\n  ', "count", () => "u1x2y3z4")`, serialized by bun.
    private let tsCustom = #"[{"id":"fajr","kind":"fardh"},{"id":"dhuhr","kind":"fardh"},{"id":"asr","kind":"fardh"},{"id":"maghrib","kind":"fardh"},{"id":"isha","kind":"fardh"},{"id":"rawatib","kind":"check"},{"id":"dhuha","kind":"check"},{"id":"tahajjud","kind":"check"},{"id":"tilawah","kind":"count"},{"id":"dzikir_pagi","kind":"check"},{"id":"dzikir_petang","kind":"check"},{"id":"sedekah","kind":"check"},{"id":"puasa","kind":"check"},{"id":"c.u1x2y3z4","kind":"count","label":"Baca \"Al-Mulk\" \\ / ✨ سورة 😀"}]"#

    @Test func builtinsSerializeLikeThePhone() {
        #expect(MutabaahItems.serializeItems(MutabaahItems.builtinItems) == tsBuiltins)
        #expect(MutabaahItems.parseItems(tsBuiltins) == MutabaahItems.builtinItems)
    }

    @Test func unicodeAndQuoteLabelsRoundTripByteForByte() {
        let parsed = MutabaahItems.parseItems(tsCustom)
        #expect(parsed.last == ItemDef(id: "c.u1x2y3z4", kind: .count, label: "Baca \"Al-Mulk\" \\ / ✨ سورة 😀"))
        #expect(MutabaahItems.serializeItems(parsed) == tsCustom)

        let built = MutabaahItems.addCustomItem(MutabaahItems.defaultItems, label: "  Baca \"Al-Mulk\" \\ / ✨ سورة 😀\t\n  ", kind: .count) { "u1x2y3z4" }
        #expect(MutabaahItems.serializeItems(built) == tsCustom)
    }

    @Test func controlCharactersEscapeLikeJSONStringify() {
        // bun: serializeItems(parseItems('[{..."label":"a\\u0001b\\u007f\\u2028c"}]')) keeps DEL and U+2028 raw.
        let parsed = MutabaahItems.parseItems(#"[{"id":"c.ctrl0001","kind":"check","label":"a\u0001b\u007f\u2028c"}]"#)
        #expect(MutabaahItems.serializeItems(parsed) == "[{\"id\":\"c.ctrl0001\",\"kind\":\"check\",\"label\":\"a\\u0001b\u{7F}\u{2028}c\"}]")
        #expect(MutabaahJSON.quote("\u{08}\u{0C}\n\r\t\u{1F}/") == #""\b\f\n\r\t\u001f/""#)
    }

    @Test func loneSurrogateLabelFromThePhoneStillParses() {
        // The phone cuts "x"×39 + "😀" mid-pair and stores "\ud83d". Swift keeps the item, with U+FFFD.
        let raw = #"[{"id":"fajr","kind":"fardh"},{"id":"c.emoj0001","kind":"check","label":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\ud83d"}]"#
        let parsed = MutabaahItems.parseItems(raw)
        #expect(parsed.map(\.id) == ["fajr", "c.emoj0001"])
        #expect(parsed.last?.label == String(repeating: "x", count: 39) + "\u{FFFD}")
    }
}
