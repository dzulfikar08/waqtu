//
//  IbadahLogicTests.swift
//  waqtuTests
//
//  The Ibadah tools' logic against the phone's (apps/mobile/test/ibadah.test.ts and
//  muhasabah.test.ts): reader counters and progress, morning or evening, the mutabaah tick of a
//  finished dzikir through the sync replica, doa search and favourites, tasbih, and the
//  device-local muhasabah journal.
//

import Foundation
import Testing

private func item(_ key: String, repeats: Int) -> ReaderItem {
    ReaderItem(key: key, title: nil, heading: nil, lines: [], repeatCount: repeats, reference: nil)
}

struct IbadahReaderTests {
    private let session = ReaderSession(
        id: .dzikirPagi, sourceTitle: "t", translationLang: .en,
        items: [item("a", repeats: 1), item("b", repeats: 3), item("c", repeats: 2)])

    private var a: ReaderItem { session.items[0] }
    private var b: ReaderItem { session.items[1] }
    private var c: ReaderItem { session.items[2] }

    @Test func aTapCountsOneRecitationDownAndStopsAtZero() {
        var counts: ReaderCounts = [:]
        #expect(IbadahReader.remaining(counts, b) == 3)
        counts = IbadahReader.tap(counts, b)
        counts = IbadahReader.tap(counts, b)
        #expect(IbadahReader.remaining(counts, b) == 1)
        counts = IbadahReader.tap(counts, b)
        #expect(IbadahReader.isItemDone(counts, b))
        #expect(IbadahReader.tap(counts, b) == counts)
        #expect(IbadahReader.doneCount(counts, b) == 3)
    }

    @Test func resettingPutsAnItemBackToItsFullCount() {
        let counts = IbadahReader.tap(IbadahReader.tap([:], b), a)
        let back = IbadahReader.reset(counts, b)
        #expect(IbadahReader.remaining(back, b) == 3)
        #expect(IbadahReader.remaining(back, a) == 0)
        #expect(IbadahReader.reset(back, b) == back)
    }

    @Test func progressCountsRepetitionsAndFinishedItems() {
        var counts: ReaderCounts = [:]
        #expect(IbadahReader.progress(session, counts)
                == ReaderProgress(done: 0, total: 6, itemsDone: 0, itemsTotal: 3, fraction: 0, complete: false))
        counts = IbadahReader.tap(IbadahReader.tap(IbadahReader.tap(counts, a), b), c)
        let mid = IbadahReader.progress(session, counts)
        #expect(mid.done == 3)
        #expect(mid.itemsDone == 1)
        #expect(mid.fraction == 0.5)
        counts = IbadahReader.tap(IbadahReader.tap(IbadahReader.tap(counts, b), b), c)
        #expect(IbadahReader.progress(session, counts).complete)
    }

    @Test func storedCountsAboveAnItemsRepeatNeverOvershoot() {
        #expect(IbadahReader.doneCount(["a": 99], a) == 1)
        #expect(IbadahReader.progress(session, ["a": 99]).done == 1)
    }

    @Test func theNextUnfinishedItemWrapsRoundAndIsNilWhenAllAreDone() {
        #expect(IbadahReader.nextOpenItem(session, ["a": 1], from: 0) == 1)
        #expect(IbadahReader.nextOpenItem(session, ["a": 1, "b": 3], from: 0) == 2)
        // Only the item itself is left: the search comes back round to it.
        #expect(IbadahReader.nextOpenItem(session, ["a": 1, "b": 3], from: 2) == 2)
        #expect(IbadahReader.nextOpenItem(session, ["b": 3, "c": 2], from: 2) == 0)
        #expect(IbadahReader.nextOpenItem(session, ["a": 1, "b": 3, "c": 2], from: 0) == nil)
    }

    @Test func progressIsKeptForTheDayOnly() {
        let stored = IbadahReader.serializeProgress(["a": 1, "b": 2], today: "2027-02-12")
        #expect(IbadahReader.parseProgress(stored, today: "2027-02-12") == ["a": 1, "b": 2])
        #expect(IbadahReader.parseProgress(stored, today: "2027-02-13") == [:])
        #expect(IbadahReader.parseProgress("nonsense", today: "2027-02-12") == [:])
        #expect(IbadahReader.parseProgress(nil, today: "2027-02-12") == [:])
        #expect(IbadahReader.parseProgress(#"{"day":"2027-02-12","counts":{"a":-1,"b":1.5,"c":2,"d":true}}"#, today: "2027-02-12")
                == ["c": 2])
        // The phone's key for the same session (device-local on both).
        #expect(IbadahReader.progressKey(.matsuratSughroPagi) == "ibadah.progress.matsurat-sughro-pagi")
    }

    @Test func morningFromSubuhUntilAsrEveningFromAsrThroughTheNight() {
        #expect(IbadahReader.suggestedTime(.fajr) == .pagi)
        #expect(IbadahReader.suggestedTime(.sunrise) == .pagi)
        #expect(IbadahReader.suggestedTime(.dhuhr) == .pagi)
        #expect(IbadahReader.suggestedTime(.asr) == .petang)
        #expect(IbadahReader.suggestedTime(.maghrib) == .petang)
        #expect(IbadahReader.suggestedTime(.isha) == .petang)
        #expect(IbadahReader.mutabaahItem(for: .pagi) == "dzikir_pagi")
        #expect(IbadahReader.mutabaahItem(for: .petang) == "dzikir_petang")
    }

    @Test func theClockDecidesWithoutPrayerTimes() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Jakarta") ?? .current
        func at(_ hour: Int) -> Date {
            calendar.date(from: DateComponents(year: 2027, month: 2, day: 12, hour: hour)) ?? Date()
        }
        #expect(IbadahReader.suggestTime(marks: [], now: at(9), calendar: calendar) == .pagi)
        #expect(IbadahReader.suggestTime(marks: [], now: at(16), calendar: calendar) == .petang)
        #expect(IbadahReader.suggestTime(marks: [], now: at(2), calendar: calendar) == .petang)
    }

    @Test func thePrayerTimesDecideWhenThereAreSome() {
        // 12 Feb 2027 in Jakarta (UTC+7): Subuh 04:30, Dzuhur 12:05, Asr 15:15, Maghrib 18:15, Isha 19:25.
        func utc(_ hour: Int, _ minute: Int) -> Date {
            Date(timeIntervalSince1970: 1_802_390_400 + Double((hour - 7) * 3600 + minute * 60))
        }
        let marks: [(period: DayPeriod, at: Date)] = [
            (period: .fajr, at: utc(4, 30)), (period: .dhuhr, at: utc(12, 5)), (period: .asr, at: utc(15, 15)),
            (period: .maghrib, at: utc(18, 15)), (period: .isha, at: utc(19, 25)),
        ]
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(7, 0)) == .pagi)
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(14, 0)) == .pagi)
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(15, 15)) == .petang)
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(17, 0)) == .petang)
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(23, 0)) == .petang)
        // After midnight, before today's Subuh: still the night.
        #expect(IbadahReader.suggestTime(marks: marks, now: utc(3, 0)) == .petang)
    }

    @Test func readerViewKeepsBothPartsOnUnlessTurnedOffExplicitly() {
        #expect(ReaderView.parse(nil) == ReaderView(latin: true, translation: true))
        #expect(ReaderView.parse("{") == ReaderView(latin: true, translation: true))
        #expect(ReaderView.parse(#"{"latin":false}"#) == ReaderView(latin: true, translation: true))
        #expect(ReaderView.parse(#"{"latin":false,"translation":true}"#) == ReaderView(latin: false, translation: true))
        #expect(ReaderView.parse(ReaderView(latin: true, translation: false).serialized())
                == ReaderView(latin: true, translation: false))
    }
}

/// Finishing a session ticks `dzikir_pagi` / `dzikir_petang` in the account replica, as the phone's `setEntry(..., 1)`.
@MainActor
struct IbadahMutabaahTickTests {
    private let day = "2027-02-12"

    @Test func tickingWritesTheCheckEntryTheSyncUploads() async throws {
        let server = FakeServer()
        let replica = MutabaahReplica(fileURL: nil)
        let itemId = IbadahReader.mutabaahItem(for: .petang)
        #expect(MutabaahChecklist.items(in: replica).contains { $0.id == itemId })
        #expect(MutabaahChecklist.value(date: day, itemId: itemId, in: replica) == 0)

        #expect(MutabaahChecklist.setCheck(true, itemId: itemId, date: day, in: replica, at: 1000))
        #expect(MutabaahChecklist.value(date: day, itemId: itemId, in: replica) == 1)
        // Ticking an already ticked item changes nothing (unlike a toggle).
        #expect(!MutabaahChecklist.setCheck(true, itemId: itemId, date: day, in: replica, at: 2000))
        #expect(MutabaahChecklist.value(date: day, itemId: itemId, in: replica) == 1)

        _ = try await runSync(store: replica, transport: server)
        #expect(server.entry(day, "dzikir_petang")?.value == 1)
        #expect(server.entry(day, "dzikir_pagi") == nil)
    }

    @Test func theSameIdsAsThePhonesChecklist() {
        #expect(MutabaahItems.defaultItems.contains(ItemDef(id: "dzikir_pagi", kind: .check)))
        #expect(MutabaahItems.defaultItems.contains(ItemDef(id: "dzikir_petang", kind: .check)))
    }

    @Test func aTasbihCountIsAddedToTheUsersOwnCounter() throws {
        let replica = MutabaahReplica(fileURL: nil)
        var items = MutabaahChecklist.items(in: replica)
        items = MutabaahItems.addCustomItem(items, label: "Istighfar", kind: .count, random: { "istg2026" })
        #expect(MutabaahChecklist.setItems(items, in: replica, at: 100))
        let linked = try #require(Tasbih.linkedItem(of: TasbihState(
            preset: .istighfar, count: 100, customTarget: 0, feedback: true, linkedItem: "c.istg2026"), in: items))
        let current = MutabaahChecklist.value(date: day, itemId: linked.id, in: replica)
        #expect(MutabaahChecklist.setCount(Tasbih.addedCount(current: current, count: 100), itemId: linked.id, date: day, in: replica, at: 200))
        #expect(MutabaahChecklist.value(date: day, itemId: "c.istg2026", in: replica) == 100)
    }
}

struct IbadahDoaTests {
    private static func categories() throws -> [DuaCategory] {
        try IbadahContent.parseDuas(try RepoFiles.data("content/adhkar/duas.json"))
    }

    private func ids(_ query: String, english: Bool = false) throws -> [String] {
        IbadahDoa.search(try Self.categories(), query: query, english: english).flatMap { $0.duas.map(\.id) }
    }

    @Test func indonesianListLabelsEnglishFromTheFileAndAFallbackForUnknownIds() throws {
        let found = try #require(IbadahContent.findDua("dua-before-eating", in: try Self.categories()))
        #expect(IbadahDoa.duaTitle(found.dua, english: false) == "Sebelum makan")
        #expect(IbadahDoa.duaTitle(found.dua, english: true) == "Before Eating")
        #expect(IbadahDoa.categoryName(found.category, english: false) == "Doa sehari-hari")
        let unknown = Dua(id: "new", title: "Before Eating", arabic: "ب", transliteration: "b", translation: "t",
                          reference: "r", notes: nil)
        #expect(IbadahDoa.duaTitle(unknown, english: false) == "Before Eating")
    }

    @Test func everyDuaAndCategoryHasAnIndonesianLabel() throws {
        for category in try Self.categories() {
            #expect(IbadahDoa.categoriesId[category.id] != nil, "\(category.id)")
            for dua in category.duas { #expect(IbadahDoa.titlesId[dua.id] != nil, "\(dua.id)") }
        }
    }

    @Test func searchMatchesEveryWordAcrossTitlesTransliterationTranslationAndArabic() throws {
        #expect(try ids("").count == 13)
        #expect(try ids("makan") == ["dua-before-eating", "dua-after-eating"])
        #expect(try ids("masjid keluar") == ["dua-leaving-masjid"])
        #expect(try ids("forgiveness", english: true).contains("dua-istighfar"))
        #expect(try ids("Muslim 713") == ["dua-entering-masjid", "dua-leaving-masjid"])
        // Bare Arabic without harakat finds the vocalised text.
        #expect(try ids("بسم الله").contains("dua-before-eating"))
        #expect(try ids("zzz") == [])
        #expect(IbadahDoa.foldForSearch("Du'ā") == "dua")
    }

    @Test func favouritesRoundTripAndSurviveBadStoredValues() {
        var favourites = IbadahDoa.parseFavourites(nil)
        favourites = IbadahDoa.toggleFavourite(favourites, "dua-travel")
        favourites = IbadahDoa.toggleFavourite(favourites, "dua-before-eating")
        #expect(IbadahDoa.serializeFavourites(favourites) == #"["dua-before-eating","dua-travel"]"#)
        #expect(IbadahDoa.parseFavourites(IbadahDoa.serializeFavourites(favourites)) == ["dua-before-eating", "dua-travel"])
        #expect(!IbadahDoa.toggleFavourite(favourites, "dua-travel").contains("dua-travel"))
        #expect(IbadahDoa.parseFavourites("{") == [])
        #expect(IbadahDoa.parseFavourites(#"{"a":1}"#) == [])
        #expect(IbadahDoa.parseFavourites(#"["ok", 3, null]"#) == ["ok"])
    }

    @Test func favouritesAndTheCountSurviveARestart() throws {
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent("waqtu-ibadah-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("ibadah.json")
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        let store = IbadahStore(fileURL: file)
        store.set(IbadahDoa.favouritesKey, IbadahDoa.serializeFavourites(["dua-travel"]))
        store.set(Tasbih.key, Tasbih.serialize(TasbihState(preset: .salawat, count: 57, customTarget: 33, feedback: false, linkedItem: "c.istg2026")))

        let reopened = IbadahStore(fileURL: file)
        #expect(IbadahDoa.parseFavourites(reopened.value(IbadahDoa.favouritesKey)) == ["dua-travel"])
        #expect(Tasbih.parse(reopened.value(Tasbih.key))
                == TasbihState(preset: .salawat, count: 57, customTarget: 33, feedback: false, linkedItem: "c.istg2026"))
        #expect(reopened.value("ibadah.nothing") == nil)
    }
}

struct TasbihTests {
    private func phrases() throws -> [TasbihPhrase] {
        try IbadahContent.parseTasbih(try RepoFiles.data("content/adhkar/tasbih.json"))
    }

    @Test func thirtyThreeThirtyThreeThirtyFourWalksThroughThePhrasesAndCompletesAtOneHundred() throws {
        let after = try Tasbih.phases(.afterPrayer, phrases: try phrases(), customTarget: 0)
        #expect(after.map(\.target) == [33, 33, 34])
        #expect(Tasbih.position(of: 0, in: after) == TasbihPosition(phase: 0, inPhase: 0, target: 33, rounds: 0, roundComplete: false))
        #expect(Tasbih.position(of: 33, in: after).inPhase == 33)
        #expect(Tasbih.position(of: 33, in: after).phase == 0)
        #expect(Tasbih.position(of: 34, in: after).phase == 1)
        #expect(Tasbih.position(of: 34, in: after).inPhase == 1)
        let hundred = Tasbih.position(of: 100, in: after)
        #expect(hundred.phase == 2 && hundred.inPhase == 34 && hundred.roundComplete)
        let next = Tasbih.position(of: 101, in: after)
        #expect(next.phase == 0 && next.inPhase == 1 && next.rounds == 1 && !next.roundComplete)
    }

    @Test func tapsReportTheEndOfAPartAndOfARound() throws {
        let after = try Tasbih.phases(.afterPrayer, phrases: try phrases(), customTarget: 0)
        var state = TasbihState.initial
        state.count = 32
        var result = Tasbih.tap(state, phases: after)
        #expect(result.event == .phase)
        state = result.state
        #expect(Tasbih.tap(state, phases: after).event == .tick)
        state.count = 99
        result = Tasbih.tap(state, phases: after)
        #expect(result.event == .round)
        #expect(result.state.count == 100)
    }

    @Test func oneHundredOfOnePhraseAndTheFreeCount() throws {
        let all = try phrases()
        let istighfar = try Tasbih.phases(.istighfar, phrases: all, customTarget: 0)
        #expect(istighfar == [TasbihPhase(phrase: all[4], target: 100)])
        let open = try Tasbih.phases(.custom, phrases: all, customTarget: 0)
        let counting = Tasbih.position(of: 250, in: open)
        #expect(counting.inPhase == 250 && counting.target == 0 && !counting.roundComplete)
        var state = TasbihState.initial
        state.preset = .custom
        state.count = 5
        #expect(Tasbih.tap(state, phases: open).event == .tick)
        let eleven = try Tasbih.phases(.custom, phrases: all, customTarget: 11)
        state.count = 10
        #expect(Tasbih.tap(state, phases: eleven).event == .round)
    }

    @Test func undoResetSwitchingPresetAndTargetBounds() {
        var state = TasbihState.initial
        state.count = 3
        #expect(Tasbih.undo(state).count == 2)
        state.count = 0
        #expect(Tasbih.undo(state).count == 0)
        state.count = 3
        #expect(Tasbih.reset(state).count == 0)
        let tahlil = Tasbih.choosePreset(state, .tahlil)
        #expect(tahlil.preset == .tahlil && tahlil.count == 0)
        #expect(Tasbih.choosePreset(state, .afterPrayer) == state)
        #expect(Tasbih.setCustomTarget(state, 99_999).customTarget == Tasbih.maxCustomTarget)
        #expect(Tasbih.setCustomTarget(state, -4).customTarget == 0)
    }

    @Test func aMissingPhraseIsAnError() {
        #expect(throws: TasbihContentError.self) {
            _ = try Tasbih.phases(.afterPrayer, phrases: [], customTarget: 0)
        }
    }

    @Test func badStoredValuesFallBackFieldByField() {
        #expect(Tasbih.parse(nil) == TasbihState.initial)
        #expect(Tasbih.parse("[") == TasbihState.initial)
        var expected = TasbihState.initial
        expected.customTarget = 7
        #expect(Tasbih.parse(#"{"preset":"nope","count":-3,"feedback":"yes","customTarget":7}"#) == expected)
    }

    @Test func onlyTheUsersOwnCountersCanBeLinkedAndAddingClamps() {
        let items = MutabaahItems.defaultItems + [
            ItemDef(id: "c.istighfar1", kind: .count, label: "Istighfar"),
            ItemDef(id: "c.tick0001", kind: .check, label: "Tick"),
        ]
        #expect(Tasbih.linkableItems(items).map(\.id) == ["c.istighfar1"])
        var state = TasbihState.initial
        state.linkedItem = "c.istighfar1"
        #expect(Tasbih.linkedItem(of: state, in: items)?.id == "c.istighfar1")
        state.linkedItem = "tilawah"
        #expect(Tasbih.linkedItem(of: state, in: items) == nil)
        #expect(Tasbih.addedCount(current: 10, count: 33) == 43)
        #expect(Tasbih.addedCount(current: 9_990, count: 33) == 10_000)
    }
}

struct MuhasabahTests {
    private let today = "2027-02-12"

    private func entry(_ date: String, _ fill: (inout MuhasabahEntry) -> Void = { _ in }) -> MuhasabahEntry {
        var e = MuhasabahEntry(date: date)
        fill(&e)
        return e
    }

    @Test func saveReadBackUpdateAndDeleteOneDay() {
        let store = MuhasabahStore(fileURL: nil)
        #expect(store.entry(today) == nil)
        let saved = store.save(entry(today) { $0.feelings = "  Tenang  "; $0.taqwa = 7; $0.gratitude = 9 }, now: 1000)
        #expect(saved == entry(today) { $0.feelings = "Tenang"; $0.taqwa = 7; $0.gratitude = 9 })
        #expect(store.entry(today) == saved)

        store.save(entry(today) { $0.feelings = "Lebih baik"; $0.energy = 5 }, now: 2000)
        #expect(store.entry(today) == entry(today) { $0.feelings = "Lebih baik"; $0.energy = 5 })

        store.delete(today)
        #expect(store.entry(today) == nil)
    }

    @Test func savingAnEmptyReflectionRemovesTheDayInsteadOfStoringBlanks() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(today) { $0.newAction = "Sedekah" }, now: 1)
        #expect(store.save(entry(today) { $0.newAction = "   " }, now: 2) == nil)
        #expect(store.entry(today) == nil)
    }

    @Test func ratingsOutsideOneToTenAreDropped() {
        let store = MuhasabahStore(fileURL: nil)
        store.save(entry(today) { $0.taqwa = 11; $0.gratitude = 0; $0.willingness = 10 }, now: 1)
        #expect(store.entry(today) == entry(today) { $0.willingness = 10 })
    }

    @Test func aRangeComesBackOldestFirst() {
        let store = MuhasabahStore(fileURL: nil)
        for back in [0, 3, 1, 40] {
            store.save(entry(DayKeys.addDays(today, -back)) { $0.taqwa = 5 }, now: 1)
        }
        let rows = store.entries(from: DayKeys.addDays(today, -29), to: today)
        #expect(rows.map(\.date) == ["2027-02-09", "2027-02-11", "2027-02-12"])
    }

    @Test func theJournalStaysOnThisMacAndSurvivesARestart() throws {
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent("waqtu-muhasabah-\(UUID().uuidString)", isDirectory: true)
            .appendingPathComponent("muhasabah.json")
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        let store = MuhasabahStore(fileURL: file)
        store.save(entry(today) { $0.feelings = "Rahasia"; $0.taqwa = 8 }, now: 1000)
        store.save(entry(today) { $0.feelings = "Rahasia"; $0.taqwa = 9 }, now: 5000)
        let reopened = MuhasabahStore(fileURL: file)
        #expect(reopened.entry(today) == entry(today) { $0.feelings = "Rahasia"; $0.taqwa = 9 })
        #expect(reopened.allDates == [today])
        // Private: the journal is a file of its own, apart from the sync replica and its settings.
        #expect(file.lastPathComponent == "muhasabah.json")
        let replica = MutabaahReplica(fileURL: nil)
        #expect(!replica.hasDirtyRows)
    }

    @Test func sevenQuestionsInTheMutabaahAppsOrder() {
        #expect(Muhasabah.questions == [
            .text(.feelings), .text(.newAction), .rating(.taqwa), .rating(.gratitude), .rating(.energy),
            .rating(.willingness), .text(.continueTomorrow),
        ])
    }

    @Test func contentCompletionAndTheMeanRating() {
        #expect(!Muhasabah.hasContent(entry(today)))
        #expect(!Muhasabah.hasContent(entry(today) { $0.feelings = " " }))
        #expect(Muhasabah.hasContent(entry(today) { $0.energy = 3 }))
        let twoOfSeven = entry(today) { $0.feelings = "a"; $0.taqwa = 2 }
        let completion: Double = Muhasabah.completion(twoOfSeven)
        #expect(abs(completion - 2.0 / 7.0) < 1e-9)
        #expect(Muhasabah.averageRating(entry(today) { $0.taqwa = 8; $0.gratitude = 9; $0.energy = 4 }) == 7)
        #expect(Muhasabah.averageRating(entry(today) { $0.feelings = "a" }) == nil)
    }

    @Test func textIsTrimmedAndCapped() {
        let long = String(repeating: "x", count: 5000)
        #expect(Muhasabah.clean(entry(today) { $0.feelings = long }).feelings?.count == 4000)
        #expect(Muhasabah.clean(entry(today) { $0.continueTomorrow = "\n  " }).continueTomorrow == nil)
    }

    private var trendEntries: [MuhasabahEntry] {
        [
            entry(DayKeys.addDays(today, -40)) { $0.taqwa = 1 },
            entry(DayKeys.addDays(today, -20)) { $0.taqwa = 4; $0.gratitude = 6 },
            entry(DayKeys.addDays(today, -16)) { $0.energy = 4 },
            entry(DayKeys.addDays(today, -5)) { $0.taqwa = 8; $0.gratitude = 8; $0.energy = 6; $0.willingness = 10 },
            entry(today) { $0.feelings = "Tanpa nilai" },
        ]
    }

    @Test func thirtyDaysEndingTodayOldestFirstAMeanPerDay() {
        let trend = Muhasabah.ratingTrend(trendEntries, today: today, days: 30)
        #expect(trend.count == 30)
        #expect(trend[0].date == DayKeys.addDays(today, -29))
        #expect(trend.last == MuhasabahTrendDay(date: today, average: nil))
        #expect(trend.first { $0.date == DayKeys.addDays(today, -20) }?.average == 5)
        #expect(trend.first { $0.date == DayKeys.addDays(today, -5) }?.average == 8)
        #expect(trend.filter { $0.average != nil }.count == 3)
    }

    @Test func summaryDaysWrittenMeanPerAspectAndTheChangeBetweenHalves() throws {
        let summary = Muhasabah.summarizeTrend(trendEntries, today: today, days: 30)
        #expect(summary.daysWritten == 4)
        let average: Double = try #require(summary.average)
        let expectedAverage: Double = (5.0 + 4.0 + 8.0) / 3.0
        #expect(abs(average - expectedAverage) < 1e-9)
        let expectedAspects: [MuhasabahAspect: Double] = [.taqwa: 6, .gratitude: 7, .energy: 5, .willingness: 10]
        #expect(summary.aspects == expectedAspects)
        // Earlier half (days 29..15 back): 5 and 4 → 4.5; later half: 8.
        let change: Double = try #require(summary.change)
        #expect(abs(change - 3.5) < 1e-9)
    }

    @Test func noRatingsMeansNoMeanAndNoChange() {
        let summary = Muhasabah.summarizeTrend([entry(today) { $0.feelings = "a" }], today: today, days: 30)
        #expect(summary == MuhasabahTrendSummary(daysWritten: 1, average: nil, aspects: [:], change: nil))
    }

    @Test func februaryTwentySevenStartsOnAMondayAndFillsFourWeeks() {
        let weeks = Muhasabah.monthWeeks(year: 2027, month: 2)
        #expect(weeks.count == 4)
        #expect(weeks[0][0] == "2027-02-01")
        #expect(weeks[3][6] == "2027-02-28")
    }

    @Test func paddingBeforeTheFirstAndAfterTheLastDay() {
        let weeks = Muhasabah.monthWeeks(year: 2026, month: 10)
        // 1 Oct 2026 is a Thursday.
        #expect(Array(weeks[0].prefix(4)) == [nil, nil, nil, "2026-10-01"])
        #expect(weeks.flatMap { $0 }.compactMap { $0 }.count == 31)
        #expect(weeks.allSatisfy { $0.count == 7 })
    }

    @Test func monthArithmeticAcrossTheYear() {
        #expect(Muhasabah.shiftMonth(year: 2027, month: 1, delta: -1) == (2026, 12))
        #expect(Muhasabah.shiftMonth(year: 2026, month: 12, delta: 1) == (2027, 1))
        #expect(Muhasabah.shiftMonth(year: 2027, month: 2, delta: -14) == (2025, 12))
    }
}
