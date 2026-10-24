//
//  SettingsSyncMapping.swift
//  waqtu
//
//  Which settings follow the account and how the Mac's prayer preferences map to them
//  (apps/mobile/src/mutabaah/syncKeys.ts, apps/mobile/src/prayer/config.ts).
//  Location, time zone and language are never synced.
//

import Foundation

/// The Mac prayer preferences that have an account counterpart.
struct PrayerPrefs: Equatable {
    /// Adhan method id as stored by `AppSettings.calculationMethod`.
    var calculationMethod: String
    /// `AppSettings.madhab`: "shafi" or "hanafi".
    var madhab: String
    /// Whole-minute nudges by prayer id (fajr, sunrise, dhuhr, asr, maghrib, isha).
    var adjustments: [String: Int]

    static let macDefault = PrayerPrefs(
        calculationMethod: "muslimWorldLeague",
        madhab: "shafi",
        adjustments: [:]
    )

    func adjustment(_ prayer: String) -> Int { adjustments[prayer] ?? 0 }
}

enum SettingsSyncMapping {
    static let offsetPrayers = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
    /// The account stores nudges of at most this many minutes either way (the Mac allows 60).
    static let maxOffsetMinutes = 30
    static let maxHijriOffset = 2

    /// Whitelist of keys that are exchanged with the server; everything else stays on the device.
    static let syncedKeys: Set<String> = {
        var keys: Set<String> = ["items", "streak", "method", "asr", "hijriOffset"]
        for prayer in offsetPrayers { keys.insert("offset.\(prayer)") }
        return keys
    }()

    static func isSyncedKey(_ key: String) -> Bool { syncedKeys.contains(key) }

    // MARK: Method / madhab ids

    private static let macForAccountMethod: [String: String] = [
        "kemenag": "singapore",  // Kemenag uses the same 20°/18° angles as the Singapore method
        "mwl": "muslimWorldLeague",
        "isna": "northAmerica",
        "ummAlQura": "ummAlQura",
        "egyptian": "egyptian",
        "singapore": "singapore",
    ]

    private static let accountForMacMethod: [String: String] = [
        "muslimWorldLeague": "mwl",
        "northAmerica": "isna",
        "ummAlQura": "ummAlQura",
        "egyptian": "egyptian",
        "singapore": "singapore",
    ]

    static func macMethod(forAccountMethod id: String) -> String? { macForAccountMethod[id] }
    static func accountMethod(forMacMethod id: String) -> String? { accountForMacMethod[id] }

    static func macMadhab(forAccountAsr id: String) -> String? {
        switch id {
        case "shafii": return "shafi"
        case "hanafi": return "hanafi"
        default: return nil
        }
    }

    static func accountAsr(forMacMadhab id: String) -> String? {
        switch id {
        case "shafi": return "shafii"
        case "hanafi": return "hanafi"
        default: return nil
        }
    }

    static func clampOffset(_ minutes: Int) -> Int {
        min(maxOffsetMinutes, max(-maxOffsetMinutes, minutes))
    }

    /// The account values the Mac's preferences stand for; methods without an account id are left out.
    static func accountValues(for prefs: PrayerPrefs) -> [String: String] {
        var out: [String: String] = [:]
        if let method = accountMethod(forMacMethod: prefs.calculationMethod) { out["method"] = method }
        if let asr = accountAsr(forMacMadhab: prefs.madhab) { out["asr"] = asr }
        for prayer in offsetPrayers {
            out["offset.\(prayer)"] = String(clampOffset(prefs.adjustment(prayer)))
        }
        return out
    }

    /// True when the account value `remote` already stands for the Mac's `prefs` under `key`.
    static func isEquivalent(key: String, remote: String, to prefs: PrayerPrefs) -> Bool {
        guard let local = accountValues(for: prefs)[key] else { return true }
        switch key {
        case "method":
            return macMethod(forAccountMethod: remote) == prefs.calculationMethod
        case "asr":
            return macMadhab(forAccountAsr: remote) == prefs.madhab
        default:
            return Int(remote.trimmingCharacters(in: .whitespaces)) == Int(local)
        }
    }

    private static func isDefault(key: String, local: String) -> Bool {
        accountValues(for: .macDefault)[key] == local
    }

    /// Settings the user changed on the Mac that the account does not hold yet.
    /// - `explicitChange`: the user just edited the preferences, so a missing account value counts
    ///   as a change. Otherwise a missing value is only seeded from non-default preferences, so a
    ///   fresh Mac never overwrites what the server will hand it.
    static func pending(
        prefs: PrayerPrefs,
        stored: (String) -> String?,
        explicitChange: Bool
    ) -> [(key: String, value: String)] {
        var out: [(key: String, value: String)] = []
        for (key, local) in accountValues(for: prefs).sorted(by: { $0.key < $1.key }) {
            if let remote = stored(key) {
                if !isEquivalent(key: key, remote: remote, to: prefs) { out.append((key, local)) }
            } else if explicitChange || !isDefault(key: key, local: local) {
                out.append((key, local))
            }
        }
        return out
    }

    /// Applies pulled settings to the preferences; returns true when something changed.
    /// Values the Mac cannot represent (unknown method ids, non-numbers) are ignored.
    @discardableResult
    static func apply(_ settings: [SyncSetting], to prefs: inout PrayerPrefs) -> Bool {
        let before = prefs
        for s in settings {
            switch s.key {
            case "method":
                if let mac = macMethod(forAccountMethod: s.value), mac != prefs.calculationMethod {
                    prefs.calculationMethod = mac
                }
            case "asr":
                if let mac = macMadhab(forAccountAsr: s.value) { prefs.madhab = mac }
            default:
                guard s.key.hasPrefix("offset.") else { continue }
                let prayer = String(s.key.dropFirst("offset.".count))
                guard offsetPrayers.contains(prayer),
                      let minutes = Int(s.value.trimmingCharacters(in: .whitespaces)) else { continue }
                // A Mac nudge beyond the account's range already stands for the clamped value.
                if clampOffset(prefs.adjustment(prayer)) != clampOffset(minutes) {
                    prefs.adjustments[prayer] = clampOffset(minutes)
                }
            }
        }
        return prefs != before
    }

    /// Moon-sighting correction pulled from the account (days, -2...2); 0 when none.
    static func hijriOffset(from raw: String?) -> Int {
        guard let raw, let n = Int(raw.trimmingCharacters(in: .whitespaces)),
              abs(n) <= maxHijriOffset else { return 0 }
        return n
    }
}
