//
//  IbadahCatalogTests.swift
//  waqtuTests
//
//  The Ibadah string catalog (waqtu/Resources/Ibadah.xcstrings, table "Ibadah"): Indonesian and
//  English for every key, the same arguments in each, exactly the keys the views ask for, and the
//  copy the phone also has (apps/mobile/src/ibadah/strings.ts) word for word.
//

import Foundation
import Testing

private struct IbadahCatalog {
    /// Key → language → every text of it (the plural forms of a key are all listed).
    let texts: [String: [String: [String]]]

    init() throws {
        let data = try RepoFiles.data("apps/apple/waqtu/Resources/Ibadah.xcstrings")
        let root = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(root["sourceLanguage"] as? String == "en")
        let strings = try #require(root["strings"] as? [String: [String: Any]])
        var out: [String: [String: [String]]] = [:]
        for (key, entry) in strings {
            let localizations = entry["localizations"] as? [String: [String: Any]] ?? [:]
            var byLanguage: [String: [String]] = [:]
            for (language, localization) in localizations {
                if let unit = localization["stringUnit"] as? [String: Any], let value = unit["value"] as? String {
                    byLanguage[language] = [value]
                } else if let variations = localization["variations"] as? [String: Any],
                          let plural = variations["plural"] as? [String: [String: Any]] {
                    byLanguage[language] = plural.values.compactMap {
                        ($0["stringUnit"] as? [String: Any])?["value"] as? String
                    }
                }
            }
            out[key] = byLanguage
        }
        texts = out
    }

    func text(_ key: String, _ language: String) -> String? { texts[key]?[language]?.first }
}

/// Format specifiers of a catalog string in argument order (`%2$@` is the second argument).
private func specifiers(_ s: String) -> [String] {
    let regex = try! NSRegularExpression(pattern: "%(?:(\\d+)\\$)?(lld|ld|d|@|f|%)")
    var positional: [(Int, String)] = []
    var next = 1
    for match in regex.matches(in: s, range: NSRange(s.startIndex..., in: s)) {
        let type = String(s[Range(match.range(at: 2), in: s)!])
        if type == "%" { continue }
        var index = next
        if let r = Range(match.range(at: 1), in: s), let n = Int(s[r]) { index = n } else { next += 1 }
        positional.append((index, type))
    }
    return positional.sorted { $0.0 < $1.0 }.map(\.1)
}

/// The keys the views ask for with `istr("...")`: the text before the first argument, and how many arguments follow.
private func istrCalls(in source: String) -> [(prefix: String, args: Int)] {
    let chars = Array(source)
    let opener = Array("istr(\"")
    var calls: [(prefix: String, args: Int)] = []
    var i = 0
    while i + opener.count <= chars.count {
        guard Array(chars[i..<i + opener.count]) == opener else {
            i += 1
            continue
        }
        i += opener.count
        var text = ""
        var args = 0
        while i < chars.count, chars[i] != "\"" {
            if chars[i] == "\\", i + 1 < chars.count, chars[i + 1] == "(" {
                args += 1
                var depth = 0
                i += 1
                while i < chars.count {
                    if chars[i] == "(" { depth += 1 }
                    if chars[i] == ")" {
                        depth -= 1
                        if depth == 0 { break }
                    }
                    i += 1
                }
                i += 1
                continue
            }
            text.append(chars[i])
            i += 1
        }
        calls.append((text.trimmingCharacters(in: .whitespaces), args))
    }
    return calls
}

/// The `ibadahId` / `ibadahEn` copy of the phone, flattened to `section.leaf` → text.
private struct PhoneCopy {
    let id: [String: String]
    let en: [String: String]

    init() throws {
        let source = try #require(String(data: try RepoFiles.data("apps/mobile/src/ibadah/strings.ts"), encoding: .utf8))
        let halves = source.components(separatedBy: "export const ibadahEn")
        try #require(halves.count == 2)
        id = Self.leaves(halves[0])
        en = Self.leaves(halves[1])
    }

    private static func groups(_ pattern: String, in line: String) -> [String]? {
        let regex = try! NSRegularExpression(pattern: pattern)
        guard let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)) else { return nil }
        return (1..<match.numberOfRanges).map { i in
            Range(match.range(at: i), in: line).map { String(line[$0]) } ?? ""
        }
    }

    private static func unquote(_ s: String) -> String {
        var value = s
        value = value.replacingOccurrences(of: "\\\"", with: "\"")
        value = value.replacingOccurrences(of: "\\'", with: "'")
        return value.replacingOccurrences(of: "\\\\", with: "\\")
    }

    private static let leafPattern = "^(\\w+): (?:\"((?:[^\"\\\\]|\\\\.)*)\"|'((?:[^'\\\\]|\\\\.)*)'),?$"

    static func leaves(_ text: String) -> [String: String] {
        var out: [String: String] = [:]
        var stack: [String] = []
        var pending: String?
        for raw in text.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if let key = pending {
                pending = nil
                if let g = groups("^(?:\"((?:[^\"\\\\]|\\\\.)*)\"|'((?:[^'\\\\]|\\\\.)*)'),?$", in: line) {
                    out[(stack + [key]).joined(separator: ".")] = unquote(g[0].isEmpty ? g[1] : g[0])
                }
                continue
            }
            if let g = groups("^(\\w+): \\{$", in: line) {
                stack.append(g[0])
            } else if line.hasPrefix("}") {
                if !stack.isEmpty { stack.removeLast() }
            } else if let g = groups(leafPattern, in: line) {
                out[(stack + [g[0]]).joined(separator: ".")] = unquote(g[1].isEmpty ? g[2] : g[1])
            } else if let g = groups("^(\\w+):$", in: line) {
                pending = g[0]
            } else if let g = groups("^(\\w+): \\{ (.*) \\},?$", in: line) {
                for pair in g[1].components(separatedBy: ", ") {
                    if let leaf = groups(leafPattern, in: pair) {
                        out[(stack + [g[0], leaf[0]]).joined(separator: ".")] = unquote(leaf[1].isEmpty ? leaf[2] : leaf[1])
                    }
                }
            }
        }
        return out
    }
}

/// Arguments of either notation become one mark, so `{{count}}` and `%lld` compare equal.
private func normalized(_ s: String) -> String {
    var value = s
    for pattern in ["\\{\\{\\w+\\}\\}", "%(?:\\d+\\$)?(?:lld|@)"] {
        value = try! NSRegularExpression(pattern: pattern)
            .stringByReplacingMatches(in: value, range: NSRange(value.startIndex..., in: value), withTemplate: "§")
    }
    return value
}

struct IbadahCatalogTests {
    /// Mac key → the phone's `ibadah.<path>` string it is the same copy as.
    private static let fromPhone: [String: String] = [
        "ibadah.doa.all": "doa.all",
        "ibadah.doa.favourite": "doa.favourite",
        "ibadah.doa.favourites": "doa.favourites",
        "ibadah.doa.isFavourite": "doa.isFavourite",
        "ibadah.doa.noFavourites": "doa.noFavourites",
        "ibadah.doa.noResults": "doa.noResults",
        "ibadah.doa.notes": "doa.notes",
        "ibadah.doa.search": "doa.search",
        "ibadah.doa.searchPlaceholder": "doa.searchPlaceholder",
        "ibadah.doa.source": "doa.source",
        "ibadah.doa.title": "doa.title",
        "ibadah.doa.translation": "doa.translation",
        "ibadah.doa.translationEn": "doa.translationEn",
        "ibadah.doa.transliteration": "doa.transliteration",
        "ibadah.doa.unfavourite": "doa.unfavourite",
        "ibadah.dzikir.title": "dzikir.title",
        "ibadah.heroBody": "heroBody",
        "ibadah.heroDone %@": "heroDone",
        "ibadah.heroPagi": "heroPagi",
        "ibadah.heroPetang": "heroPetang",
        "ibadah.hubSubtitle": "hubSubtitle",
        "ibadah.matsurat.kubro": "matsurat.kubro",
        "ibadah.matsurat.sughro": "matsurat.sughro",
        "ibadah.matsurat.title": "matsurat.title",
        "ibadah.muhasabah.aspect.energy": "muhasabah.aspect.energy",
        "ibadah.muhasabah.aspect.gratitude": "muhasabah.aspect.gratitude",
        "ibadah.muhasabah.aspect.taqwa": "muhasabah.aspect.taqwa",
        "ibadah.muhasabah.aspect.willingness": "muhasabah.aspect.willingness",
        "ibadah.muhasabah.average": "muhasabah.average",
        "ibadah.muhasabah.averageToday %@": "muhasabah.averageToday",
        "ibadah.muhasabah.calendar": "muhasabah.calendar",
        "ibadah.muhasabah.cancel": "muhasabah.cancel",
        "ibadah.muhasabah.chartLabel": "muhasabah.chartLabel",
        "ibadah.muhasabah.clearRating": "muhasabah.clearRating",
        "ibadah.muhasabah.confirmDelete": "muhasabah.confirmDelete",
        "ibadah.muhasabah.dayEmpty %@": "muhasabah.dayEmpty",
        "ibadah.muhasabah.dayLabel %@": "muhasabah.dayLabel",
        "ibadah.muhasabah.daysWritten %lld": "muhasabah.daysWritten",
        "ibadah.muhasabah.delete": "muhasabah.delete",
        "ibadah.muhasabah.deleteTitle": "muhasabah.deleteTitle",
        "ibadah.muhasabah.down %@": "muhasabah.down",
        "ibadah.muhasabah.edit": "muhasabah.edit",
        "ibadah.muhasabah.entryTitle %@": "muhasabah.entryTitle",
        "ibadah.muhasabah.high.energy": "muhasabah.high.energy",
        "ibadah.muhasabah.high.gratitude": "muhasabah.high.gratitude",
        "ibadah.muhasabah.high.taqwa": "muhasabah.high.taqwa",
        "ibadah.muhasabah.high.willingness": "muhasabah.high.willingness",
        "ibadah.muhasabah.low.energy": "muhasabah.low.energy",
        "ibadah.muhasabah.low.gratitude": "muhasabah.low.gratitude",
        "ibadah.muhasabah.low.taqwa": "muhasabah.low.taqwa",
        "ibadah.muhasabah.low.willingness": "muhasabah.low.willingness",
        "ibadah.muhasabah.nextMonth": "muhasabah.nextMonth",
        "ibadah.muhasabah.noRatings": "muhasabah.noRatings",
        "ibadah.muhasabah.placeholder.continueTomorrow": "muhasabah.placeholder.continueTomorrow",
        "ibadah.muhasabah.placeholder.feelings": "muhasabah.placeholder.feelings",
        "ibadah.muhasabah.placeholder.newAction": "muhasabah.placeholder.newAction",
        "ibadah.muhasabah.prevMonth": "muhasabah.prevMonth",
        "ibadah.muhasabah.question.continueTomorrow": "muhasabah.question.continueTomorrow",
        "ibadah.muhasabah.question.energy": "muhasabah.question.energy",
        "ibadah.muhasabah.question.feelings": "muhasabah.question.feelings",
        "ibadah.muhasabah.question.gratitude": "muhasabah.question.gratitude",
        "ibadah.muhasabah.question.newAction": "muhasabah.question.newAction",
        "ibadah.muhasabah.question.taqwa": "muhasabah.question.taqwa",
        "ibadah.muhasabah.question.willingness": "muhasabah.question.willingness",
        "ibadah.muhasabah.rate %@ %lld": "muhasabah.rate",
        "ibadah.muhasabah.save": "muhasabah.save",
        "ibadah.muhasabah.start": "muhasabah.start",
        "ibadah.muhasabah.steady": "muhasabah.steady",
        "ibadah.muhasabah.title": "muhasabah.title",
        "ibadah.muhasabah.today": "muhasabah.today",
        "ibadah.muhasabah.trends": "muhasabah.trends",
        "ibadah.muhasabah.up %@": "muhasabah.up",
        "ibadah.qibla.bearing": "qibla.bearing",
        "ibadah.qibla.distance %@": "qibla.distance",
        "ibadah.qibla.east": "qibla.east",
        "ibadah.qibla.from %@": "qibla.from",
        "ibadah.qibla.fromNorth": "qibla.fromNorth",
        "ibadah.qibla.north": "qibla.north",
        "ibadah.qibla.openSettings": "qibla.openSettings",
        "ibadah.qibla.south": "qibla.south",
        "ibadah.qibla.title": "qibla.title",
        "ibadah.qibla.west": "qibla.west",
        "ibadah.reader.cancel": "reader.cancel",
        "ibadah.reader.completeBody": "reader.completeBody",
        "ibadah.reader.completeTitle": "reader.completeTitle",
        "ibadah.reader.confirmRestart": "reader.confirmRestart",
        "ibadah.reader.countLabel %@ %lld %lld": "reader.countLabel",
        "ibadah.reader.item %lld": "reader.item",
        "ibadah.reader.itemDone": "reader.itemDone",
        "ibadah.reader.kindChoice": "reader.kindChoice",
        "ibadah.reader.markMutabaah %@": "reader.markMutabaah",
        "ibadah.reader.marked %@": "reader.marked",
        "ibadah.reader.notInChecklist %@": "reader.notInChecklist",
        "ibadah.reader.now": "reader.now",
        "ibadah.reader.progress %lld %lld": "reader.progress",
        "ibadah.reader.reference %@": "reader.reference",
        "ibadah.reader.reps %lld %lld": "reader.reps",
        "ibadah.reader.restart": "reader.restart",
        "ibadah.reader.restartBody": "reader.restartBody",
        "ibadah.reader.restartTitle": "reader.restartTitle",
        "ibadah.reader.showLatin": "reader.showLatin",
        "ibadah.reader.showTranslation": "reader.showTranslation",
        "ibadah.reader.timeChoice": "reader.timeChoice",
        "ibadah.reader.times %lld": "reader.times",
        "ibadah.reader.translationEn": "reader.translationEn",
        "ibadah.reader.translationId": "reader.translationId",
        "ibadah.tasbih.cancel": "tasbih.cancel",
        "ibadah.tasbih.confirmReset": "tasbih.confirmReset",
        "ibadah.tasbih.counterLabel %lld": "tasbih.counterLabel",
        "ibadah.tasbih.keepsCount": "tasbih.keepsCount",
        "ibadah.tasbih.linkHint": "tasbih.linkHint",
        "ibadah.tasbih.manage": "tasbih.manage",
        "ibadah.tasbih.mutabaah": "tasbih.mutabaah",
        "ibadah.tasbih.noCounters": "tasbih.noCounters",
        "ibadah.tasbih.noTarget": "tasbih.noTarget",
        "ibadah.tasbih.of %lld": "tasbih.of",
        "ibadah.tasbih.preset.afterPrayer": "tasbih.preset.afterPrayer",
        "ibadah.tasbih.preset.custom": "tasbih.preset.custom",
        "ibadah.tasbih.preset.istighfar": "tasbih.preset.istighfar",
        "ibadah.tasbih.preset.salawat": "tasbih.preset.salawat",
        "ibadah.tasbih.preset.tahlil": "tasbih.preset.tahlil",
        "ibadah.tasbih.presetHint.afterPrayer": "tasbih.presetHint.afterPrayer",
        "ibadah.tasbih.presetHint.custom": "tasbih.presetHint.custom",
        "ibadah.tasbih.presetHint.istighfar": "tasbih.presetHint.istighfar",
        "ibadah.tasbih.presetHint.salawat": "tasbih.presetHint.salawat",
        "ibadah.tasbih.presetHint.tahlil": "tasbih.presetHint.tahlil",
        "ibadah.tasbih.presets": "tasbih.presets",
        "ibadah.tasbih.record %lld %@": "tasbih.record",
        "ibadah.tasbih.recorded %lld %@": "tasbih.recorded",
        "ibadah.tasbih.reset": "tasbih.reset",
        "ibadah.tasbih.resetBody": "tasbih.resetBody",
        "ibadah.tasbih.resetTitle": "tasbih.resetTitle",
        "ibadah.tasbih.roundDone": "tasbih.roundDone",
        "ibadah.tasbih.target": "tasbih.target",
        "ibadah.tasbih.title": "tasbih.title",
        "ibadah.tasbih.todayValue %lld": "tasbih.todayValue",
        "ibadah.tasbih.total %lld": "tasbih.total",
        "ibadah.tasbih.undo": "tasbih.undo",
        "ibadah.time.pagi": "time.pagi",
        "ibadah.time.petang": "time.petang",
        "ibadah.timeTitle.pagi": "timeTitle.pagi",
        "ibadah.timeTitle.petang": "timeTitle.petang",
        "ibadah.tools": "tools",
    ]

    @Test func everyKeyIsInIndonesianAndEnglish() throws {
        let catalog = try IbadahCatalog()
        #expect(catalog.texts.count > 100)
        for (key, languages) in catalog.texts {
            for language in ["en", "id"] {
                let values = try #require(languages[language], "\(key) has no \(language)")
                #expect(!values.isEmpty && values.allSatisfy { !$0.isEmpty }, "\(key) \(language)")
            }
        }
    }

    @Test func everyTextTakesTheArgumentsOfItsKey() throws {
        let catalog = try IbadahCatalog()
        for (key, languages) in catalog.texts {
            for (language, values) in languages {
                for value in values {
                    #expect(specifiers(key) == specifiers(value), "\(key) [\(language)] → \(value)")
                }
            }
        }
    }

    @Test func theViewsAskForExactlyTheKeysOfTheCatalog() throws {
        let catalog = try IbadahCatalog()
        let sources = RepoFiles.root.appendingPathComponent("apps/apple/waqtu")
        let enumerator = try #require(FileManager.default.enumerator(at: sources, includingPropertiesForKeys: nil))
        var calls: [(prefix: String, args: Int)] = []
        for case let file as URL in enumerator where file.pathExtension == "swift" {
            calls += istrCalls(in: try String(contentsOf: file, encoding: .utf8))
        }
        #expect(calls.count > 100)

        var catalogKeys = Set<String>()
        for key in catalog.texts.keys {
            let prefix = key.components(separatedBy: " %").first ?? key
            catalogKeys.insert("\(prefix)|\(specifiers(key).count)")
        }
        var used = Set<String>()
        for call in calls {
            let id = "\(call.prefix)|\(call.args)"
            used.insert(id)
            #expect(catalogKeys.contains(id), "no catalog key for \(id)")
        }
        #expect(catalogKeys.subtracting(used).isEmpty, "unused keys: \(catalogKeys.subtracting(used).sorted())")
    }

    @Test func copyTheMacSharesWithThePhoneIsTheSameWordForWord() throws {
        let catalog = try IbadahCatalog()
        let phone = try PhoneCopy()
        #expect(Self.fromPhone.count > 100)
        for (key, path) in Self.fromPhone {
            let phoneId = try #require(phone.id[path], "phone id.\(path)")
            let phoneEn = try #require(phone.en[path], "phone en.\(path)")
            #expect(normalized(try #require(catalog.text(key, "id"), "\(key) id")) == normalized(phoneId), "\(key) id")
            #expect(normalized(try #require(catalog.text(key, "en"), "\(key) en")) == normalized(phoneEn), "\(key) en")
        }
    }

    @Test func thePhoneCopyParserFindsNestedAndWrappedStrings() throws {
        let phone = try PhoneCopy()
        #expect(phone.id["qibla.title"] == "Arah Kiblat")
        #expect(phone.en["tasbih.preset.custom"] == "Free")
        #expect(phone.id["muhasabah.question.feelings"] == "Perasaan apa yang kamu alami hari ini?")
        // A long text that the formatter wraps onto its own line.
        #expect(phone.en["muhasabah.private"]?.hasPrefix("Private: your muhasabah notes") == true)
        // Single-quoted because it holds double quotes.
        #expect(phone.en["tasbih.noCounters"]?.contains("(type Counter)") == true)
        #expect(phone.id["time.pagi"] == "pagi")
    }

    @Test func englishPluralFormsForRounds() throws {
        let catalog = try IbadahCatalog()
        let forms = try #require(catalog.texts["ibadah.tasbih.rounds %lld"]?["en"])
        #expect(Set(forms) == ["%lld round done", "%lld rounds done"])
        #expect(catalog.text("ibadah.tasbih.rounds %lld", "id") == "%lld putaran selesai")
    }
}
