//
//  IbadahContentTests.swift
//  waqtuTests
//
//  The adhkar files bundled with the Mac app are byte for byte the ones the phone ships (same
//  SHA-256 pins as apps/mobile/test/ibadah.test.ts), parse like apps/mobile/src/ibadah/content.ts
//  and are part of both Mac targets' resources.
//

import CryptoKit
import Foundation
import Testing

private let adhkarFiles = [
    "duas.json", "evening_dhikr.json", "kubro-pagi.json", "kubro-petang.json",
    "morning_dhikr.json", "sugro-pagi.json", "sugro-petang.json", "tasbih.json", "translations-id.json",
]

/// SHA-256 of the files as copied from the Mutabaah app's Resources (tasbih.json: its TasbihPreset list).
/// A formatter or a hand edit that touches a byte of the Arabic fails here. translations-id.json is not a copy:
/// the Indonesian text taken verbatim from IslamHouse/QuranEnc (content/adhkar/README.md), pinned so it is never
/// reworded either.
private let pinned: [String: String] = [
    "duas.json": "44b92d396af50d6b4e2a113fa1c6385be8b12af407d0081e7df2ba2e56bbbb6a",
    "evening_dhikr.json": "1b8c8b0ed77c167d32881bf85ad48591c005758990ce85b609dc51b07cf1db4d",
    "kubro-pagi.json": "fccaf80a4aaf22a59be4b544fdcffe17fcf1adfc9fbd2d10f3a57c8728e7ac8b",
    "kubro-petang.json": "98b64f6a8c0ef67732c77a68054317cd3d3f151200cc9e9cc5850de458ae51a6",
    "morning_dhikr.json": "433e310ae46f74f8f6fce43c299731294d87459dc995578de4daaeae8eea36d3",
    "sugro-pagi.json": "5d66b65d960eb6b03d1f97acb88093cf7cc2b9ba3854b66284a0f3d8225f91a8",
    "sugro-petang.json": "2ffe51790503148d5e668d076c68465b5d6549f591ef5172e2c95297c370a1ff",
    "tasbih.json": "5675a8ddd44a083281841c1f36b1de2d5fcc46a4a4fa075aa7c53486f915144e",
    "translations-id.json": "59f92e2706b7f7a3ba959ceebf6af4bb894db30def99add029be934071ad1048",
]

private func adhkar(_ file: String) throws -> Data {
    try RepoFiles.data("content/adhkar/\(file)")
}

private func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

private func jsonObject(_ file: String) throws -> [String: Any] {
    try #require(try JSONSerialization.jsonObject(with: try adhkar(file)) as? [String: Any])
}

private func session(_ id: ReaderSessionID) throws -> ReaderSession {
    try IbadahContent.parseSession(try adhkar(id.fileName + ".json"), id: id)
}

struct IbadahContentFileTests {
    @Test func everyFileIsByteForByteTheCopiedOne() throws {
        #expect(Set(pinned.keys) == Set(adhkarFiles))
        for file in adhkarFiles {
            #expect(sha256(try adhkar(file)) == pinned[file], "\(file)")
        }
    }

    /// The phone pins the same files; a hash changed on one side only fails here.
    @Test func samePinsAsThePhone() throws {
        let phone = try #require(String(data: try RepoFiles.data("apps/mobile/test/ibadah.test.ts"), encoding: .utf8))
        for (file, digest) in pinned {
            #expect(phone.contains("\"\(file)\": \"\(digest)\""), "\(file)")
        }
    }

    /// Every file is a resource of both Mac targets (waqtu and waqtu-mas), so the app finds it by name.
    @Test func filesAreBundledIntoBothMacTargets() throws {
        let project = try #require(String(data: try RepoFiles.data("apps/apple/waqt.xcodeproj/project.pbxproj"), encoding: .utf8))
        for file in adhkarFiles {
            let buildFiles = project.components(separatedBy: "/* \(file) in Resources */ = {isa = PBXBuildFile;").count - 1
            #expect(buildFiles == 2, "\(file) in \(buildFiles) resource phases")
            #expect(project.contains("path = \"../../content/adhkar/\(file)\""), "\(file)")
        }
    }
}

struct IbadahSessionTests {
    @Test func everySessionLoadsWithTheExpectedSizeAndLanguage() throws {
        let expected: [ReaderSessionID: (items: Int, reps: Int, lang: IbadahTextLang)] = [
            .matsuratKubroPagi: (items: 40, reps: 199, lang: .id),
            .matsuratKubroPetang: (items: 40, reps: 199, lang: .id),
            .matsuratSughroPagi: (items: 32, reps: 191, lang: .id),
            .matsuratSughroPetang: (items: 32, reps: 195, lang: .id),
            .dzikirPagi: (items: 15, reps: 238, lang: .en),
            .dzikirPetang: (items: 15, reps: 238, lang: .en),
        ]
        #expect(ReaderSessionID.allCases.count == expected.count)
        for id in ReaderSessionID.allCases {
            let loaded = try session(id)
            let want = try #require(expected[id])
            #expect(loaded.id == id)
            #expect(loaded.items.count == want.items, "\(id.rawValue) items")
            #expect(loaded.items.reduce(0) { $0 + $1.repeatCount } == want.reps, "\(id.rawValue) repetitions")
            #expect(loaded.translationLang == want.lang)
            #expect(Set(loaded.items.map(\.key)).count == loaded.items.count)
            for item in loaded.items {
                #expect(!item.lines.isEmpty)
                for line in item.lines {
                    #expect(!line.arabic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    @Test func arabicIsPassedThroughExactlyAsStored() throws {
        let file = try jsonObject("kubro-pagi.json")
        let entries = try #require(file["data"] as? [[String: Any]])
        let loaded = try session(.matsuratKubroPagi)
        #expect(entries.count == loaded.items.count)
        for (i, entry) in entries.enumerated() {
            let item = loaded.items[i]
            if let verses = entry["data"] as? [[String: Any]] {
                #expect(item.heading?.arabic == entry["arabic"] as? String)
                #expect(item.lines.map(\.arabic) == verses.compactMap { $0["arabic"] as? String })
            } else {
                #expect(item.lines.first?.arabic == entry["arabic"] as? String)
            }
        }
        let morning = try jsonObject("morning_dhikr.json")
        let dhikr = try session(.dzikirPagi)
        for entry in try #require(morning["items"] as? [[String: Any]]) {
            let key = try #require(entry["id"] as? String)
            let item = try #require(dhikr.items.first { $0.key == key })
            #expect(item.lines.first?.arabic == entry["arabic"] as? String)
            #expect(item.reference == entry["reference"] as? String)
        }
    }

    @Test func dhikrFollowTheirOrderAndPassagesKeepTheirAyat() throws {
        let evening = try session(.dzikirPetang)
        #expect(evening.items.first?.key == "evening-001")
        #expect(evening.items.last?.key == "evening-015")
        let fatihah = try session(.matsuratSughroPetang).items[1]
        #expect(fatihah.title == "Surat Al-Fātiḥah")
        #expect(fatihah.heading?.translation == "Pembukaan")
        #expect(fatihah.lines.count == 7)
        #expect(fatihah.lines.first?.label == "Ayat 1")
    }

    @Test func sessionIdsByKindAndTime() {
        #expect(ReaderSessionID.matsurat(.kubro, .pagi) == .matsuratKubroPagi)
        #expect(ReaderSessionID.matsurat(.sughro, .petang).rawValue == "matsurat-sughro-petang")
        #expect(ReaderSessionID.dzikir(.petang).rawValue == "dzikir-petang")
        #expect(ReaderSessionID.dzikirPagi.fileName == "morning_dhikr")
    }

    private func data(_ json: String) -> Data { Data(json.utf8) }

    /// The place of the fault a parser reports ("" when it accepts the text).
    private func fault(_ body: () throws -> Void) -> String {
        do {
            try body()
            return ""
        } catch let error as IbadahContentError {
            return error.message
        } catch {
            return "other: \(error)"
        }
    }

    private func matsuratFault(_ json: String) -> String {
        fault { _ = try IbadahContent.parseMatsurat(data(json), id: .matsuratKubroPagi) }
    }

    private func dhikrFault(_ json: String) -> String {
        fault { _ = try IbadahContent.parseDhikr(data(json), id: .dzikirPagi) }
    }

    @Test func malformedFilesAreRejectedWithThePlaceOfTheFault() {
        let empty = matsuratFault(#"{"title":"x","data":[]}"#)
        #expect(empty.contains("expected a non-empty array"), "\(empty)")
        let zero = matsuratFault(#"{"title":"x","data":[{"title":"a","type":"single","arabic":"ب","repeat":0}]}"#)
        #expect(zero.contains("data[0].repeat"), "\(zero)")
        let boolean = matsuratFault(#"{"title":"x","data":[{"title":"a","type":"single","arabic":"ب","repeat":true}]}"#)
        #expect(boolean.contains("data[0].repeat"), "\(boolean)")
        let other = matsuratFault(#"{"title":"x","data":[{"title":"a","type":"other","arabic":"ب","repeat":1}]}"#)
        #expect(other.contains("type"), "\(other)")

        let item = #"{"id":"a","arabic":"ب","transliteration":"b","translation":"t","repetitions":1,"reference":"r","order":1}"#
        let twice = dhikrFault(#"{"title":"x","items":[\#(item),\#(item)]}"#)
        #expect(twice.contains("duplicate"), "\(twice)")
        let blankItem = #"{"id":"a","arabic":"  ","transliteration":"b","translation":"t","repetitions":1,"reference":"r","order":1}"#
        let blank = dhikrFault(#"{"title":"x","items":[\#(blankItem)]}"#)
        #expect(blank.contains("arabic"), "\(blank)")

        let noDuas = fault { _ = try IbadahContent.parseDuas(data(#"{"categories":[{"id":"c","name":"C","duas":[]}]}"#)) }
        #expect(noDuas.contains("expected a non-empty array"), "\(noDuas)")
        let notJSON = fault { _ = try IbadahContent.parseDuas(data("not json")) }
        #expect(notJSON.contains("not valid JSON"), "\(notJSON)")
        let noCount = fault { _ = try IbadahContent.parseTasbih(data(#"{"phrases":[{"id":"x"}]}"#)) }
        #expect(noCount.contains("recommendedCount"), "\(noCount)")
    }

    @Test func aMissingTranslationOrTransliterationIsNilNeverInvented() throws {
        let parsed = try IbadahContent.parseMatsurat(
            data(#"{"title":"x","data":[{"title":"a","type":"single","arabic":"ب","repeat":1}]}"#), id: .matsuratKubroPagi)
        #expect(parsed.items[0].lines[0] == ReaderLine(label: nil, arabic: "ب", latin: nil, translation: nil))
    }

    @Test func dhikrWithTheSameOrderKeepTheFileOrder() throws {
        func entry(_ id: String, _ order: Int) -> String {
            #"{"id":"\#(id)","arabic":"ب","transliteration":"b","translation":"t","repetitions":1,"reference":"r","order":\#(order)}"#
        }
        let parsed = try IbadahContent.parseDhikr(
            data(#"{"title":"x","items":[\#(entry("b", 2)),\#(entry("a", 1)),\#(entry("c", 2))]}"#), id: .dzikirPagi)
        #expect(parsed.items.map(\.key) == ["a", "b", "c"])
    }
}

struct IbadahDuaContentTests {
    @Test func thirteenDuasInFiveCategoriesEachWithASource() throws {
        let categories = try IbadahContent.parseDuas(try adhkar("duas.json"))
        #expect(categories.count == 5)
        let duas = categories.flatMap(\.duas)
        #expect(duas.count == 13)
        #expect(Set(duas.map(\.id)).count == 13)
        for dua in duas { #expect(!dua.reference.trimmingCharacters(in: .whitespaces).isEmpty) }
        let sayyid = try #require(IbadahContent.findDua("dua-sayyidul-istighfar", in: categories))
        #expect(sayyid.dua.notes?.contains("people of Paradise") == true)
        #expect(IbadahContent.findDua("nope", in: categories) == nil)
    }

    @Test func tasbihPhrasesAreTheMutabaahPresetsUntouched() throws {
        let phrases = try IbadahContent.parseTasbih(try adhkar("tasbih.json"))
        #expect(phrases.map(\.id) == ["subhanallah", "alhamdulillah", "allahu-akbar", "tahlil", "istighfar", "salawat"])
        #expect(phrases.map(\.recommendedCount) == [33, 33, 34, 100, 100, 100])
        #expect(phrases[0].arabic == "سُبْحَانَ اللَّهِ")
    }
}

struct IbadahIndonesianTranslationTests {
    private static let untranslated: Set<String> = [
        "morning-013", "evening-013", "dua-after-eating", "dua-leaving-home", "dua-evil-eye", "dua-new-blessing",
    ]

    /// Every id of the sidecar is an item of the base files, and the ones whose Arabic differs from the book are absent.
    @Test func everyKeyIsAnItemOfTheBaseFiles() throws {
        var baseIds = Set<String>()
        for file in ["morning_dhikr.json", "evening_dhikr.json"] {
            for item in try #require(try jsonObject(file)["items"] as? [[String: Any]]) {
                baseIds.insert(try #require(item["id"] as? String))
            }
        }
        for category in try #require(try jsonObject("duas.json")["categories"] as? [[String: Any]]) {
            for dua in try #require(category["duas"] as? [[String: Any]]) {
                baseIds.insert(try #require(dua["id"] as? String))
            }
        }
        let file = try jsonObject("translations-id.json")
        let items = try #require(file["items"] as? [String: [String: Any]])
        #expect(items.count == 37)
        for (key, entry) in items {
            #expect(baseIds.contains(key), "\(key)")
            let text = try #require(entry["text"] as? String)
            #expect(text == text.trimmingCharacters(in: .whitespacesAndNewlines) && !text.isEmpty, "\(key)")
        }
        #expect(Set(items.keys).isDisjoint(with: Self.untranslated))
        #expect(baseIds.subtracting(items.keys) == Self.untranslated)
        let quran = try #require(file["quranSource"] as? [String: Any])
        #expect(quran["key"] as? String == "indonesian_affairs")
        #expect(quran["version"] as? String == "1.0.1")
    }

    @Test func theLoadersAttachTheTextByIdAndLeaveTheStoredEnglishAlone() throws {
        let map = try IbadahContent.parseIdTranslations(try adhkar("translations-id.json"))
        #expect(map.count == 37)
        let morning = try IbadahContent.parseDhikr(
            try adhkar("morning_dhikr.json"), id: .dzikirPagi, idTranslations: map)
        let four = try #require(morning.items.first { $0.key == "morning-004" })
        #expect(four.lines[0].translationId == map["morning-004"])
        #expect(four.lines[0].translation == "Glory be to Allah and praise Him")
        #expect(morning.items.first { $0.key == "morning-013" }?.lines[0].translationId == nil)
        let categories = try IbadahContent.parseDuas(try adhkar("duas.json"), idTranslations: map)
        let gratitude = try #require(IbadahContent.findDua("dua-gratitude", in: categories))
        #expect(gratitude.dua.translationId == "Segala puji bagi Allah, Tuhan seluruh alam,")
        #expect(try #require(IbadahContent.findDua("dua-after-eating", in: categories)).dua.translationId == nil)
        let matsurat = try IbadahContent.parseSession(
            try adhkar("kubro-pagi.json"), id: .matsuratKubroPagi, idTranslations: map)
        #expect(matsurat.items[0].lines[0].translationId == nil)
    }

    @Test func indonesianShowsInAnIndonesianUIAndEnglishOtherwise() {
        let id = IbadahContent.pickTranslation(stored: "Praise", storedLang: .en, indonesian: "Puji", english: false)
        #expect(id.text == "Puji" && id.lang == .id)
        let missing = IbadahContent.pickTranslation(stored: "Praise", storedLang: .en, indonesian: nil, english: false)
        #expect(missing.text == "Praise" && missing.lang == .en)
        let en = IbadahContent.pickTranslation(stored: "Praise", storedLang: .en, indonesian: "Puji", english: true)
        #expect(en.text == "Praise" && en.lang == .en)
    }

    @Test func theNoticeNamesTheLanguageOrSaysSomeAreMissing() throws {
        func session(_ ids: [String?]) -> ReaderSession {
            ReaderSession(
                id: .dzikirPagi, sourceTitle: "t", translationLang: .en,
                items: ids.enumerated().map { index, translationId in
                    ReaderItem(
                        key: String(index), title: nil, heading: nil,
                        lines: [ReaderLine(
                            label: nil, arabic: "ب", latin: nil, translation: "t", translationId: translationId)],
                        repeatCount: 1, reference: nil)
                })
        }
        #expect(IbadahContent.translationNote(session(["a", "b"]), english: false) == nil)
        #expect(IbadahContent.translationNote(session([nil, nil]), english: false) == .en)
        #expect(IbadahContent.translationNote(session(["a", nil]), english: false) == .mixed)
        #expect(IbadahContent.translationNote(session(["a", nil]), english: true) == nil)
        let matsurat = try IbadahContent.parseSession(try adhkar("kubro-pagi.json"), id: .matsuratKubroPagi)
        #expect(IbadahContent.translationNote(matsurat, english: true) == .id)
        #expect(IbadahContent.translationNote(matsurat, english: false) == nil)
    }

    @Test func malformedSidecarsAreRejected() {
        #expect(throws: IbadahContentError.self) { try IbadahContent.parseIdTranslations(Data("not json".utf8)) }
        #expect(throws: IbadahContentError.self) { try IbadahContent.parseIdTranslations(Data("{}".utf8)) }
    }
}
