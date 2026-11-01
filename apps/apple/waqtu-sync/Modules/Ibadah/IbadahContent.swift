//
//  IbadahContent.swift
//  waqtu
//
//  Adhkar, Al-Ma'tsurat, doa and tasbih phrases shipped in the app (content/adhkar, copied
//  unmodified from the Mutabaah app and bundled as-is). Mac counterpart of
//  apps/mobile/src/ibadah/content.ts and tasbih.ts: the parsers check the shape and keep every
//  Arabic string exactly as stored; nothing here translates. A text carries the language its
//  translation is in. Pure; no UI.
//

import Foundation

/// Language a text's translation is written in.
enum IbadahTextLang: String, Equatable {
    case id, en
}

enum ReaderTime: String, CaseIterable, Equatable {
    case pagi, petang
}

enum MatsuratKind: String, CaseIterable, Equatable {
    case kubro, sughro
}

/// One reader session; the raw value is the id the phone uses.
enum ReaderSessionID: String, CaseIterable, Hashable {
    case matsuratKubroPagi = "matsurat-kubro-pagi"
    case matsuratKubroPetang = "matsurat-kubro-petang"
    case matsuratSughroPagi = "matsurat-sughro-pagi"
    case matsuratSughroPetang = "matsurat-sughro-petang"
    case dzikirPagi = "dzikir-pagi"
    case dzikirPetang = "dzikir-petang"

    static func matsurat(_ kind: MatsuratKind, _ time: ReaderTime) -> ReaderSessionID {
        switch (kind, time) {
        case (.kubro, .pagi): return .matsuratKubroPagi
        case (.kubro, .petang): return .matsuratKubroPetang
        case (.sughro, .pagi): return .matsuratSughroPagi
        case (.sughro, .petang): return .matsuratSughroPetang
        }
    }

    static func dzikir(_ time: ReaderTime) -> ReaderSessionID {
        time == .pagi ? .dzikirPagi : .dzikirPetang
    }

    /// The content file the session is read from (content/adhkar).
    var fileName: String {
        switch self {
        case .matsuratKubroPagi: return "kubro-pagi"
        case .matsuratKubroPetang: return "kubro-petang"
        case .matsuratSughroPagi: return "sugro-pagi"
        case .matsuratSughroPetang: return "sugro-petang"
        case .dzikirPagi: return "morning_dhikr"
        case .dzikirPetang: return "evening_dhikr"
        }
    }

    var isMatsurat: Bool {
        switch self {
        case .dzikirPagi, .dzikirPetang: return false
        default: return true
        }
    }
}

/// One recited text: a whole dhikr, or one ayah of a passage.
struct ReaderLine: Equatable {
    /// "Ayat 1" within a passage; nil for a single text.
    let label: String?
    let arabic: String
    let latin: String?
    let translation: String?
}

struct ReaderHeading: Equatable {
    let arabic: String
    let latin: String?
    let translation: String?
}

/// One counted step of a session: a single text, or a passage of ayat recited together.
struct ReaderItem: Equatable, Identifiable {
    /// Stable within its session; progress is stored by it.
    let key: String
    let title: String?
    let heading: ReaderHeading?
    let lines: [ReaderLine]
    let repeatCount: Int
    let reference: String?

    var id: String { key }
}

struct ReaderSession: Equatable {
    let id: ReaderSessionID
    /// The title as stored in the file.
    let sourceTitle: String
    let translationLang: IbadahTextLang
    let items: [ReaderItem]
}

struct Dua: Equatable, Identifiable {
    let id: String
    let title: String
    let arabic: String
    let transliteration: String
    let translation: String
    let reference: String
    let notes: String?
}

struct DuaCategory: Equatable, Identifiable {
    let id: String
    let name: String
    let duas: [Dua]
}

/// A phrase from content/adhkar/tasbih.json.
struct TasbihPhrase: Equatable, Identifiable {
    let id: String
    let name: String
    let arabic: String
    let transliteration: String
    /// English, as in the source.
    let translation: String
    let recommendedCount: Int
}

struct IbadahContentError: Error, Equatable, CustomStringConvertible {
    let message: String
    var description: String { message }
}

enum IbadahContent {
    /// Most repetitions any text asks for in the bundled files is 100; anything far above that is a broken file.
    static let maxRepeat = 1000

    /// Translations of the duas are in English.
    static let duaTranslationLang: IbadahTextLang = .en

    // MARK: - Reading the JSON

    private static func fail(_ message: String) -> IbadahContentError { IbadahContentError(message: message) }

    private static func root(_ data: Data, _ name: String) throws -> [String: Any] {
        guard let value = try? JSONSerialization.jsonObject(with: data) else {
            throw fail("\(name): not valid JSON")
        }
        return try record(value, name)
    }

    private static func record(_ value: Any?, _ where_: String) throws -> [String: Any] {
        guard let dict = value as? [String: Any] else { throw fail("\(where_): expected an object") }
        return dict
    }

    private static func list(_ value: Any?, _ where_: String) throws -> [Any] {
        guard let array = value as? [Any], !array.isEmpty else {
            throw fail("\(where_): expected a non-empty array")
        }
        return array
    }

    private static func isBlank(_ s: String) -> Bool {
        s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func text(_ value: Any?, _ where_: String) throws -> String {
        guard let s = value as? String, !isBlank(s) else { throw fail("\(where_): expected text") }
        return s
    }

    private static func optionalText(_ value: Any?, _ where_: String) throws -> String? {
        if value == nil || value is NSNull { return nil }
        guard let s = value as? String else { throw fail("\(where_): expected text") }
        return isBlank(s) ? nil : s
    }

    /// A JSON number that is a whole number (not a boolean).
    private static func integer(_ value: Any?) -> Int? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        guard d.isFinite, d == d.rounded(), abs(d) < 1e9 else { return nil }
        return n.intValue
    }

    private static func repeatCount(_ value: Any?, _ where_: String) throws -> Int {
        guard let n = integer(value), n >= 1, n <= maxRepeat else {
            throw fail("\(where_): expected a repeat count from 1 to \(maxRepeat)")
        }
        return n
    }

    // MARK: - Al-Ma'tsurat

    /// An Al-Ma'tsurat file: `data` of `single` texts and `parent` passages whose ayat sit in their own `data`.
    static func parseMatsurat(_ data: Data, id: ReaderSessionID) throws -> ReaderSession {
        let name = id.rawValue
        let file = try root(data, name)
        var items: [ReaderItem] = []
        for (index, entry) in try list(file["data"], "\(name).data").enumerated() {
            let at = "\(name).data[\(index)]"
            let item = try record(entry, at)
            let title = try text(item["title"], "\(at).title")
            let type = item["type"] as? String
            if type == "parent" {
                var lines: [ReaderLine] = []
                for (v, verse) in try list(item["data"], "\(at).data").enumerated() {
                    let verseAt = "\(at).data[\(v)]"
                    let line = try record(verse, verseAt)
                    lines.append(ReaderLine(
                        label: try optionalText(line["title"], "\(verseAt).title"),
                        arabic: try text(line["arabic"], "\(verseAt).arabic"),
                        latin: try optionalText(line["latin"], "\(verseAt).latin"),
                        translation: try optionalText(line["translation"], "\(verseAt).translation")))
                }
                items.append(ReaderItem(
                    key: String(index),
                    title: title,
                    heading: ReaderHeading(
                        arabic: try text(item["arabic"], "\(at).arabic"),
                        latin: try optionalText(item["latin"], "\(at).latin"),
                        translation: try optionalText(item["translation"], "\(at).translation")),
                    lines: lines,
                    repeatCount: try repeatCount(item["repeat"], "\(at).repeat"),
                    reference: nil))
                continue
            }
            guard type == "single" else { throw fail("\(at).type: expected single or parent") }
            items.append(ReaderItem(
                key: String(index),
                title: title,
                heading: nil,
                lines: [ReaderLine(
                    label: nil,
                    arabic: try text(item["arabic"], "\(at).arabic"),
                    latin: try optionalText(item["latin"], "\(at).latin"),
                    translation: try optionalText(item["translation"], "\(at).translation"))],
                repeatCount: try repeatCount(item["repeat"], "\(at).repeat"),
                reference: nil))
        }
        return ReaderSession(
            id: id, sourceTitle: try text(file["title"], "\(name).title"), translationLang: .id, items: items)
    }

    // MARK: - Morning and evening dhikr

    /// A morning or evening dhikr file: `items` with their own id, order, repetitions and hadith reference.
    static func parseDhikr(_ data: Data, id: ReaderSessionID) throws -> ReaderSession {
        let name = id.rawValue
        let file = try root(data, name)
        var seen = Set<String>()
        var parsed: [(order: Double, index: Int, item: ReaderItem)] = []
        for (index, entry) in try list(file["items"], "\(name).items").enumerated() {
            let at = "\(name).items[\(index)]"
            let item = try record(entry, at)
            let key = try text(item["id"], "\(at).id")
            guard seen.insert(key).inserted else { throw fail("\(at).id: duplicate \(key)") }
            guard let orderNumber = item["order"] as? NSNumber,
                  CFGetTypeID(orderNumber) != CFBooleanGetTypeID(),
                  orderNumber.doubleValue.isFinite else {
                throw fail("\(at).order: expected a number")
            }
            let order = orderNumber.doubleValue
            parsed.append((order, index, ReaderItem(
                key: key,
                title: nil,
                heading: nil,
                lines: [ReaderLine(
                    label: nil,
                    arabic: try text(item["arabic"], "\(at).arabic"),
                    latin: try optionalText(item["transliteration"], "\(at).transliteration"),
                    translation: try optionalText(item["translation"], "\(at).translation"))],
                repeatCount: try repeatCount(item["repetitions"], "\(at).repetitions"),
                reference: try optionalText(item["reference"], "\(at).reference"))))
        }
        // Ties keep file order (the phone's sort is stable).
        let ordered = parsed.sorted { a, b in a.order != b.order ? a.order < b.order : a.index < b.index }
        return ReaderSession(
            id: id, sourceTitle: try text(file["title"], "\(name).title"), translationLang: .en,
            items: ordered.map(\.item))
    }

    /// The session of `id` from its file's bytes.
    static func parseSession(_ data: Data, id: ReaderSessionID) throws -> ReaderSession {
        if id.isMatsurat { return try parseMatsurat(data, id: id) }
        return try parseDhikr(data, id: id)
    }

    // MARK: - Doa

    /// duas.json: categories of duas, each with an id unique across the file.
    static func parseDuas(_ data: Data) throws -> [DuaCategory] {
        let file = try root(data, "duas")
        var seen = Set<String>()
        var categories: [DuaCategory] = []
        for (c, entry) in try list(file["categories"], "duas.categories").enumerated() {
            let at = "duas.categories[\(c)]"
            let category = try record(entry, at)
            var duas: [Dua] = []
            for (i, d) in try list(category["duas"], "\(at).duas").enumerated() {
                let duaAt = "\(at).duas[\(i)]"
                let dua = try record(d, duaAt)
                let id = try text(dua["id"], "\(duaAt).id")
                guard seen.insert(id).inserted else { throw fail("\(duaAt).id: duplicate \(id)") }
                duas.append(Dua(
                    id: id,
                    title: try text(dua["title"], "\(duaAt).title"),
                    arabic: try text(dua["arabic"], "\(duaAt).arabic"),
                    transliteration: try text(dua["transliteration"], "\(duaAt).transliteration"),
                    translation: try text(dua["translation"], "\(duaAt).translation"),
                    reference: try text(dua["reference"], "\(duaAt).reference"),
                    notes: try optionalText(dua["notes"], "\(duaAt).notes")))
            }
            categories.append(DuaCategory(
                id: try text(category["id"], "\(at).id"),
                name: try text(category["name"], "\(at).name"),
                duas: duas))
        }
        return categories
    }

    // MARK: - Tasbih phrases

    static func parseTasbih(_ data: Data) throws -> [TasbihPhrase] {
        let file = try root(data, "tasbih")
        guard let entries = file["phrases"] as? [Any] else { throw fail("tasbih: expected phrases") }
        var phrases: [TasbihPhrase] = []
        for (index, entry) in entries.enumerated() {
            let at = "tasbih.phrases[\(index)]"
            let phrase = try record(entry, at)
            guard let count = integer(phrase["recommendedCount"]), count >= 1 else {
                throw fail("\(at).recommendedCount: expected a count")
            }
            phrases.append(TasbihPhrase(
                id: try text(phrase["id"], "\(at).id"),
                name: try text(phrase["name"], "\(at).name"),
                arabic: try text(phrase["arabic"], "\(at).arabic"),
                transliteration: try text(phrase["transliteration"], "\(at).transliteration"),
                translation: try text(phrase["translation"], "\(at).translation"),
                recommendedCount: count))
        }
        return phrases
    }

    static func findDua(_ id: String, in categories: [DuaCategory]) -> (dua: Dua, category: DuaCategory)? {
        for category in categories {
            if let dua = category.duas.first(where: { $0.id == id }) { return (dua, category) }
        }
        return nil
    }
}
