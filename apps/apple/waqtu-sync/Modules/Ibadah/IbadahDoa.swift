//
//  IbadahDoa.swift
//  waqtu
//
//  Doa list labels, search and favourites, a port of apps/mobile/src/ibadah/labels.ts. The Arabic,
//  transliteration and translation are always shown as stored; only the list labels (category
//  names, titles) have Indonesian versions. Pure; no UI.
//

import Foundation

/// The duas of one category that match a search.
struct DuaGroup: Identifiable {
    let category: DuaCategory
    let duas: [Dua]

    var id: String { category.id }
}

enum IbadahDoa {
    /// Indonesian names for the doa categories in duas.json, whose own names are English. An id
    /// missing here falls back to the file's English name.
    static let categoriesId: [String: String] = [
        "daily-supplications": "Doa sehari-hari",
        "protection-duas": "Perlindungan & keselamatan",
        "gratitude-duas": "Syukur & pujian",
        "forgiveness-duas": "Memohon ampunan",
        "travel-duas": "Perjalanan",
    ]

    static let titlesId: [String: String] = [
        "dua-before-eating": "Sebelum makan",
        "dua-after-eating": "Sesudah makan",
        "dua-entering-home": "Masuk rumah",
        "dua-leaving-home": "Keluar rumah",
        "dua-entering-masjid": "Masuk masjid",
        "dua-leaving-masjid": "Keluar masjid",
        "dua-protection": "Memohon perlindungan",
        "dua-evil-eye": "Perlindungan dari 'ain",
        "dua-gratitude": "Syukur",
        "dua-new-blessing": "Saat menerima nikmat",
        "dua-istighfar": "Istighfar",
        "dua-sayyidul-istighfar": "Sayyidul istighfar",
        "dua-travel": "Dalam perjalanan",
    ]

    /// `english` is the app language: Indonesian unless the app runs in another language.
    static func categoryName(_ category: DuaCategory, english: Bool) -> String {
        english ? category.name : (categoriesId[category.id] ?? category.name)
    }

    static func duaTitle(_ dua: Dua, english: Bool) -> String {
        english ? dua.title : (titlesId[dua.id] ?? dua.title)
    }

    /// Marks that search ignores: Latin accents, Arabic harakat and the apostrophe family.
    private static func isIgnored(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x0300...0x036F, 0x0610...0x061A, 0x064B...0x065F, 0x0670, 0x06D6...0x06ED:
            return true
        case 0x0027, 0x0060, 0x02BF, 0x02BE, 0x2018, 0x2019:
            return true
        default:
            return false
        }
    }

    /// Lower case without Arabic harakat or Latin accents, so "dua'", "Du'ā" and a bare Arabic word all match.
    static func foldForSearch(_ value: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in value.decomposedStringWithCanonicalMapping.unicodeScalars where !isIgnored(scalar) {
            scalars.append(scalar)
        }
        return String(scalars).lowercased()
    }

    /// Duas matching every word of `query` in any of their texts; all of them for an empty query.
    static func search(_ categories: [DuaCategory], query: String, english: Bool) -> [DuaGroup] {
        let words = foldForSearch(query)
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        var groups: [DuaGroup] = []
        for category in categories {
            let matching = category.duas.filter { dua in
                if words.isEmpty { return true }
                let haystack = foldForSearch([
                    duaTitle(dua, english: english),
                    dua.title,
                    categoryName(category, english: english),
                    dua.transliteration,
                    dua.translation,
                    dua.arabic,
                    dua.reference,
                ].joined(separator: " "))
                return words.allSatisfy { haystack.contains($0) }
            }
            if !matching.isEmpty { groups.append(DuaGroup(category: category, duas: matching)) }
        }
        return groups
    }

    // MARK: - Favourites (this Mac only)

    static let favouritesKey = "ibadah.duaFavourites"

    /// Stored favourites (a JSON array of dua ids) → a set; anything malformed is an empty set.
    static func parseFavourites(_ raw: String?) -> Set<String> {
        guard let raw, let data = raw.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any] else { return [] }
        return Set(array.compactMap { element -> String? in
            guard let id = element as? String, id.count <= 64 else { return nil }
            return id
        })
    }

    static func toggleFavourite(_ favourites: Set<String>, _ id: String) -> Set<String> {
        var next = favourites
        if next.contains(id) { next.remove(id) } else { next.insert(id) }
        return next
    }

    static func serializeFavourites(_ favourites: Set<String>) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: favourites.sorted()),
              let string = String(data: data, encoding: .utf8) else { return "[]" }
        return string
    }
}
