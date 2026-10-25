//
//  HafalanTests.swift
//  waqtuTests
//
//  The bundled Tanzil text parses with every ayah, the generated metadata matches
//  packages/core/src/quran-data.ts, the text helpers match quran-text.ts and the half-page units
//  match core's buildUnits (expected values taken from @waqtu/core).
//

import CryptoKit
import Foundation
import Testing

struct QuranTextTests {
    static let text: QuranText? = {
        guard let data = try? RepoFiles.data("content/quran/quran-uthmani-1.1.txt"),
              let string = String(data: data, encoding: .utf8) else { return nil }
        return try? QuranText(fileContents: string)
    }()

    static func coreArray(_ name: String) throws -> [Int] {
        let source = try #require(String(data: try RepoFiles.data("packages/core/src/quran-data.ts"), encoding: .utf8))
        let marker = "export const \(name): readonly number[] = ["
        let start = try #require(source.range(of: marker))
        let end = try #require(source.range(of: "];", range: start.upperBound..<source.endIndex))
        return source[start.upperBound..<end.lowerBound]
            .split(whereSeparator: { $0 == "," || $0.isWhitespace })
            .compactMap { Int($0) }
    }

    @Test func verbatimFileIsUnchanged() throws {
        let data = try RepoFiles.data("content/quran/quran-uthmani-1.1.txt")
        let core = try #require(String(data: try RepoFiles.data("packages/core/test/quran.test.ts"), encoding: .utf8))
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        // The same pin as the core test.
        #expect(core.contains(digest))
        #expect(String(data: data, encoding: .utf8)?.contains("CHANGING IT IS NOT ALLOWED") == true)
    }

    @Test func everyAyahIsThere() throws {
        let text = try #require(Self.text)
        #expect(text.ayahs.count == 114)
        #expect(text.ayahs.reduce(0) { $0 + $1.count } == Quran.totalAyahs)
        #expect(text.ayahs[0][0] == Quran.bismillah)
        #expect(text.text(6235) == "مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ")
    }

    @Test func metadataMatchesCore() throws {
        #expect(QuranMeta.surahs.count == 114)
        #expect(QuranMeta.surahs.reduce(0) { $0 + $1.ayahs } == Quran.totalAyahs)
        let pageStart = try Self.coreArray("PAGE_START")
        let juzStart = try Self.coreArray("JUZ_START")
        #expect(QuranMeta.pageStart == pageStart)
        #expect(QuranMeta.juzStart == juzStart)
        #expect(QuranMeta.pageStart.count == 604 && QuranMeta.juzStart.count == 30)
    }

    @Test func wordCountsMatchCore() throws {
        // Core derives AYAH_WORDS from the same text with splitBismillah + quranWords.
        let text = try #require(Self.text)
        let core = try Self.coreArray("AYAH_WORDS")
        #expect(core.count == Quran.totalAyahs)
        #expect(text.wordCounts == core)
    }

    @Test func indexHelpers() {
        #expect(Quran.ref(ofIndex: 7) == AyahRef(surah: 2, ayah: 1))
        #expect(Quran.ayahIndex(surah: 2, ayah: 1) == 7)
        #expect(Quran.ayahIndex(surah: 1, ayah: 8) == nil)
        #expect(Quran.page(ofIndex: 6235) == 604)
        #expect(Quran.juz(ofIndex: 6235) == 30)
        #expect(Quran.surahRange(114) == AyahRange(start: 6230, end: 6235))
        #expect(Quran.arabicDigits(286) == "٢٨٦")
    }

    @Test func bismillahIsLiftedForDisplayOnly() throws {
        let text = try #require(Self.text)
        let baqarah1 = text.ayahs[1][0]
        let split = Quran.splitBismillah(surah: 2, ayah: 1, text: baqarah1)
        #expect(split.bismillah == Quran.bismillah)
        #expect("\(split.bismillah ?? "") \(split.text)" == baqarah1)
        #expect(Quran.splitBismillah(surah: 1, ayah: 1, text: text.ayahs[0][0]).bismillah == nil)
        #expect(Quran.splitBismillah(surah: 9, ayah: 1, text: text.ayahs[8][0]).bismillah == nil)
        // Surahs 95 and 97 order the Bismillah's marks differently; it is still recognised.
        #expect(Quran.splitBismillah(surah: 95, ayah: 1, text: text.ayahs[94][0]).bismillah != nil)
        #expect(Quran.splitBismillah(surah: 97, ayah: 1, text: text.ayahs[96][0]).bismillah != nil)
    }

    @Test func firstLettersLikeCore() {
        #expect(Quran.firstLetters("\u{0631}\u{064E}\u{0628}\u{0650}\u{0651}") == "\u{0631}\u{064E}")
        #expect(Quran.firstLetters("\u{0671}\u{0644}\u{0652}\u{062D}\u{064E}\u{0645}\u{0652}\u{062F}\u{064F}") == "\u{0671}\u{0644}\u{0652}\u{062D}\u{064E}")
        #expect(Quran.firstLetters("\u{0648}\u{064E}") == "\u{0648}\u{064E}")
    }

    @Test func blocksSplitBySurah() throws {
        let text = try #require(Self.text)
        // An-Naba' 40 – An-Nazi'at 2 crosses a surah boundary.
        let start = try #require(Quran.ayahIndex(surah: 78, ayah: 40))
        let end = try #require(Quran.ayahIndex(surah: 79, ayah: 2))
        let blocks = QuranBlock.blocks(AyahRange(start: start, end: end), text: text)
        #expect(blocks.map(\.surah) == [78, 79])
        #expect(!blocks[0].startsSurah && blocks[1].startsSurah)
        #expect(blocks[0].bismillah == nil && blocks[1].bismillah == Quran.bismillah)
        #expect(blocks[1].ayahs.map(\.ayah) == [1, 2])
        let keys = QuranBlock.wordKeys(blocks)
        #expect(keys.count == blocks.reduce(0) { $0 + $1.ayahs.reduce(0) { $0 + $1.words.count } })
        #expect(keys.first == "\(start):0")
    }
}

struct HafalanPlanTests {
    private func units(_ target: HafalanTarget) throws -> [HafalanUnit] {
        let text = try #require(QuranTextTests.text)
        return HafalanUnit.build(try #require(target.range), wordCounts: text.wordCounts)
    }

    @Test func unitsMatchCore() throws {
        let juz30 = try units(HafalanTarget(kind: .juz, from: 30, to: 30))
        #expect(juz30.count == 46)
        #expect(juz30.prefix(3) == [
            HafalanUnit(index: 0, start: 5672, end: 5688, page: 582, words: 54),
            HafalanUnit(index: 1, start: 5689, end: 5701, page: 582, words: 51),
            HafalanUnit(index: 2, start: 5702, end: 5710, page: 583, words: 53),
        ])
        #expect(juz30.last == HafalanUnit(index: 45, start: 6228, end: 6235, page: 604, words: 30))

        let baqarah = try units(HafalanTarget(kind: .surah, from: 2, to: 2))
        #expect(baqarah.count == 94)
        #expect(baqarah.first == HafalanUnit(index: 0, start: 7, end: 11, page: 2, words: 36))
        #expect(baqarah.last == HafalanUnit(index: 93, start: 291, end: 292, page: 49, words: 76))

        let pages = try units(HafalanTarget(kind: .pages, from: 1, to: 3))
        #expect(pages.map(\.start) == [0, 7, 12, 18])

        let naba = try units(HafalanTarget(kind: .surah, from: 78, to: 78))
        #expect(naba.map(\.end) == [5688, 5701, 5708, 5711])
    }

    @Test func targetValidation() {
        #expect(HafalanTarget(kind: .surah, from: 1, to: 114).isValid)
        #expect(!HafalanTarget(kind: .surah, from: 0, to: 2).isValid)
        #expect(!HafalanTarget(kind: .juz, from: 3, to: 31).isValid)
        #expect(!HafalanTarget(kind: .pages, from: 10, to: 9).isValid)
        #expect(HafalanTarget(kind: .pages, from: 604, to: 604).range == AyahRange(start: QuranMeta.pageStart[603], end: 6235))
    }

    @Test func planProblemsAndPace() {
        let target = HafalanTarget(kind: .juz, from: 30, to: 30)
        let plan = HafalanPlan(target: target, startDay: "2027-03-01", deadline: "2027-03-30")
        #expect(plan.problem == nil)
        #expect(plan.totalDays == 30)
        #expect(plan.perDay(unitCount: 46) == 2)
        #expect(HafalanPlan(target: target, startDay: "2027-03-01", deadline: "2027-03-01").problem == nil)
        #expect(HafalanPlan(target: target, startDay: "2027-03-02", deadline: "2027-03-01").problem == .deadline)
        #expect(HafalanPlan(target: target, startDay: "2027-02-30", deadline: "2027-03-01").problem == .day)
        #expect(HafalanPlan(target: HafalanTarget(kind: .juz, from: 0, to: 1), startDay: "2027-03-01", deadline: "2027-03-01").problem == .target)
    }

    @Test func planIsStoredLocally() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("hafalan-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let store = HafalanPlanStore(fileURL: url)
        #expect(store.plan == nil)
        let plan = HafalanPlan(target: HafalanTarget(kind: .surah, from: 78, to: 114), startDay: "2027-03-01", deadline: "2027-05-01")
        #expect(store.save(plan))
        #expect(!store.save(HafalanPlan(target: plan.target, startDay: "2027-03-02", deadline: "2027-03-01")))
        #expect(HafalanPlanStore(fileURL: url).plan == plan)
        store.delete()
        #expect(HafalanPlanStore(fileURL: url).plan == nil)
    }
}
