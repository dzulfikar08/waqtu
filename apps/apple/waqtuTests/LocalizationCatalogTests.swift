//
//  LocalizationCatalogTests.swift
//  waqtuTests
//
//  Checks the Mac string catalog (waqtu/Localizable.xcstrings) against itself and against the
//  mobile app's Indonesian copy (apps/mobile/src/i18n/locales/id.ts), read from the source tree.
//

import Foundation
import Testing

private let testsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
private let catalogURL = testsDir.appendingPathComponent("../waqtu/Localizable.xcstrings").standardizedFileURL
private let mobileIdURL = testsDir.appendingPathComponent("../../mobile/src/i18n/locales/id.ts").standardizedFileURL

private struct Catalog {
    /// Key → Indonesian value (nil when the key is not translated); keys marked "do not translate" are left out.
    let indonesian: [String: String?]

    init() throws {
        let data = try Data(contentsOf: catalogURL)
        let root = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(root["sourceLanguage"] as? String == "en")
        let strings = try #require(root["strings"] as? [String: [String: Any]])
        var out: [String: String?] = [:]
        for (key, entry) in strings {
            if entry["shouldTranslate"] as? Bool == false { continue }
            let id = (entry["localizations"] as? [String: Any])?["id"] as? [String: Any]
            let unit = id?["stringUnit"] as? [String: Any]
            out[key] = unit?["value"] as? String
        }
        indonesian = out
    }

    func id(_ key: String) -> String? { indonesian[key] ?? nil }
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

struct LocalizationCatalogTests {
    @Test func everyTranslatableKeyHasIndonesian() throws {
        let catalog = try Catalog()
        #expect(catalog.indonesian.count > 200)
        let missing = catalog.indonesian.filter { $0.value?.isEmpty ?? true }.map(\.key).sorted()
        #expect(missing.isEmpty, "untranslated: \(missing)")
    }

    @Test func indonesianKeepsTheSameArguments() throws {
        let catalog = try Catalog()
        for (key, value) in catalog.indonesian {
            guard let value else { continue }
            #expect(specifiers(key) == specifiers(value), "\(key) → \(value)")
        }
    }

    @Test func specifierParsingHandlesPositionsAndPercent() {
        #expect(specifiers("This week: %lld/%lld (%lld%%)") == ["lld", "lld", "lld"])
        #expect(specifiers("%2$lld menit lagi: %1$@") == ["@", "lld"])
    }

    /// Prayer and checklist terms are the ones the phone shows, so a user switching devices reads the same words.
    @Test func termsMatchTheMobileApp() throws {
        let catalog = try Catalog()
        let mobile = try String(contentsOf: mobileIdURL, encoding: .utf8)
        func mobileValue(_ id: String) -> String? {
            let regex = try! NSRegularExpression(pattern: "\\b\(id): \"([^\"]+)\"")
            guard let m = regex.firstMatch(in: mobile, range: NSRange(mobile.startIndex..., in: mobile)),
                  let r = Range(m.range(at: 1), in: mobile) else { return nil }
            return String(mobile[r])
        }
        let pairs = [
            "Fajr": "fajr", "Sunrise": "sunrise", "Dhuhr": "dhuhr", "Asr": "asr", "Isha": "isha",
            // Checklist items and the item manager (mobile `items.*`, `mutabaah.*`).
            "Rawatib prayers": "rawatib", "Dhuha prayer": "dhuha", "Tahajjud prayer": "tahajjud",
            "Qur'an recitation": "tilawah", "Morning dhikr": "dzikir_pagi", "Evening dhikr": "dzikir_petang",
            "Charity": "sedekah", "Voluntary fasting": "puasa", "Ramadan halaqah": "halaqah",
            "Hafalan review": "murojaah", "On time": "onTime", "In congregation": "jamaah", "Made up": "qadha",
            "Manage checklist": "manage", "Your checklist is empty. Add practices in Settings.": "empty",
            "My list": "active", "Available to add back": "available", "Your own practice": "custom",
            "Practice name, e.g. Read Al-Mulk": "namePlaceholder", "Checkbox": "kindCheck",
            "Counter": "kindCount", "Add": "add", "Today": "today",
            // Streak copy (mobile `streak.*`, `streakSettings.*`).
            "Paused. These days don't count and don't break your streak.": "paused",
            "Start anywhere. One practice today already counts.": "start",
            "Slow and steady. What matters is to keep going.": "going",
            "Today is still open.": "todayOpen", "End pause": "pauseEnd",
            "Pause (illness, travel, excuse)": "pauseStart",
        ]
        for (key, mobileKey) in pairs {
            let expected = try #require(mobileValue(mobileKey), "mobile id.ts has no \(mobileKey)")
            #expect(catalog.id(key) == expected, "\(key)")
        }
        #expect(catalog.id("Next Prayer") == mobileValue("next"))
        #expect(catalog.id("Sync now") == mobileValue("now"))
        #expect(catalog.id("Not synced yet") == mobileValue("idle"))
        #expect(catalog.id("Syncing…") == mobileValue("syncing"))
        #expect(catalog.id("Sync failed. Will retry.") == mobileValue("error"))
        #expect(catalog.id("Sign in with Google") == mobileValue("signInGoogle"))
    }
}
