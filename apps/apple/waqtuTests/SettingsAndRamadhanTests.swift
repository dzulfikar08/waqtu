//
//  SettingsAndRamadhanTests.swift
//  waqtuTests
//
//  Account settings mapping, the whitelist, and the Ramadhan countdown.
//

import Foundation
import Testing

struct SettingsSyncMappingTests {
    private func prefs(method: String = "muslimWorldLeague", madhab: String = "shafi", _ adjustments: [String: Int] = [:]) -> PrayerPrefs {
        PrayerPrefs(calculationMethod: method, madhab: madhab, adjustments: adjustments)
    }

    @Test func locationAndLanguageNeverSync() {
        for key in ["lat", "lon", "tz", "locationName", "locationAt", "language", "manualLatitude", "manualLongitude"] {
            #expect(!SettingsSyncMapping.isSyncedKey(key))
        }
        for key in ["method", "asr", "hijriOffset", "offset.fajr", "offset.sunrise", "items", "streak"] {
            #expect(SettingsSyncMapping.isSyncedKey(key))
        }
        let keys = SettingsSyncMapping.accountValues(for: prefs()).keys
        #expect(keys.allSatisfy(SettingsSyncMapping.isSyncedKey))
    }

    @Test func macPrefsMapToAccountValues() {
        let values = SettingsSyncMapping.accountValues(for: prefs(method: "northAmerica", madhab: "hanafi", ["fajr": 2, "isha": -45]))
        #expect(values["method"] == "isna")
        #expect(values["asr"] == "hanafi")
        #expect(values["offset.fajr"] == "2")
        #expect(values["offset.isha"] == "-30")  // the account stops at 30
        #expect(values["offset.dhuhr"] == "0")
    }

    @Test func methodsWithoutAnAccountIdAreNotSynced() {
        #expect(SettingsSyncMapping.accountValues(for: prefs(method: "karachi"))["method"] == nil)
    }

    @Test func kemenagFromThePhoneIsTheSingaporeMethodHere() {
        var p = prefs()
        #expect(SettingsSyncMapping.apply([SyncSetting(key: "method", value: "kemenag", updatedAt: 1)], to: &p))
        #expect(p.calculationMethod == "singapore")
        // Already equivalent: a second pull changes nothing and nothing is queued for upload.
        #expect(!SettingsSyncMapping.apply([SyncSetting(key: "method", value: "kemenag", updatedAt: 2)], to: &p))
        let pending = SettingsSyncMapping.pending(prefs: p, stored: { $0 == "method" ? "kemenag" : nil }, explicitChange: false)
        #expect(!pending.contains { $0.key == "method" })
    }

    @Test func pulledSettingsAreAppliedAndBadOnesIgnored() {
        var p = prefs()
        let changed = SettingsSyncMapping.apply([
            SyncSetting(key: "asr", value: "hanafi", updatedAt: 1),
            SyncSetting(key: "offset.maghrib", value: "3", updatedAt: 1),
            SyncSetting(key: "offset.fajr", value: "banana", updatedAt: 1),
            SyncSetting(key: "offset.nope", value: "5", updatedAt: 1),
            SyncSetting(key: "method", value: "unknownMethod", updatedAt: 1),
            SyncSetting(key: "lat", value: "-6.2", updatedAt: 1),
        ], to: &p)
        #expect(changed)
        #expect(p.madhab == "hanafi")
        #expect(p.adjustment("maghrib") == 3)
        #expect(p.adjustment("fajr") == 0)
        #expect(p.calculationMethod == "muslimWorldLeague")
    }

    @Test func aMacNudgeBeyondTheAccountRangeStandsForTheClampedValue() {
        var p = prefs(["asr": 45])
        #expect(!SettingsSyncMapping.apply([SyncSetting(key: "offset.asr", value: "30", updatedAt: 1)], to: &p))
        #expect(p.adjustment("asr") == 45)
        #expect(SettingsSyncMapping.pending(prefs: p, stored: { $0 == "offset.asr" ? "30" : nil }, explicitChange: false).isEmpty)
    }

    @Test func freshMacDoesNotSeedDefaultsButCustomizedOneDoes() {
        #expect(SettingsSyncMapping.pending(prefs: prefs(), stored: { _ in nil }, explicitChange: false).isEmpty)

        let custom = SettingsSyncMapping.pending(prefs: prefs(method: "egyptian", ["fajr": 2]), stored: { _ in nil }, explicitChange: false)
        #expect(Set(custom.map { $0.key }) == ["method", "offset.fajr"])
    }

    @Test func explicitEditQueuesEvenAMissingDefault() {
        let pending = SettingsSyncMapping.pending(prefs: prefs(), stored: { _ in nil }, explicitChange: true)
        #expect(pending.contains { $0.key == "method" && $0.value == "mwl" })
        #expect(pending.contains { $0.key == "asr" && $0.value == "shafii" })
    }

    @Test func changedValueIsQueuedUnchangedIsNot() {
        let stored: [String: String] = ["method": "mwl", "asr": "shafii", "offset.fajr": "0"]
        let pending = SettingsSyncMapping.pending(
            prefs: prefs(madhab: "hanafi", ["fajr": 0]),
            stored: { stored[$0] },
            explicitChange: false
        )
        #expect(pending.map { $0.key } == ["asr"])
        #expect(pending.first?.value == "hanafi")
    }

    @Test func hijriOffsetIsClampedToWhatTheAccountAllows() {
        #expect(SettingsSyncMapping.hijriOffset(from: "-1") == -1)
        #expect(SettingsSyncMapping.hijriOffset(from: "2") == 2)
        #expect(SettingsSyncMapping.hijriOffset(from: "5") == 0)
        #expect(SettingsSyncMapping.hijriOffset(from: nil) == 0)
        #expect(SettingsSyncMapping.hijriOffset(from: "x") == 0)
    }
}

struct RamadhanTests {
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }

    private func day(_ y: Int, _ m: Int, _ d: Int, hour: Int = 12) -> Date {
        utc.date(from: DateComponents(year: y, month: m, day: d, hour: hour))!
    }

    @Test func ramadhan1447FallsInMarch2026() {
        #expect(Ramadhan.isRamadhan(on: day(2026, 3, 5), calendar: utc))
        #expect(Ramadhan.isRamadhan(on: day(2026, 3, 15), calendar: utc))
        #expect(!Ramadhan.isRamadhan(on: day(2026, 2, 10), calendar: utc))
        #expect(!Ramadhan.isRamadhan(on: day(2026, 4, 10), calendar: utc))
    }

    @Test func hijriOffsetShiftsTheCalendarByDays() {
        for d in 2...28 {
            #expect(Ramadhan.isRamadhan(on: day(2026, 3, d), hijriOffset: -1, calendar: utc)
                    == Ramadhan.isRamadhan(on: day(2026, 3, d - 1), hijriOffset: 0, calendar: utc))
            #expect(Ramadhan.isRamadhan(on: day(2026, 3, d - 1), hijriOffset: 1, calendar: utc)
                    == Ramadhan.isRamadhan(on: day(2026, 3, d), hijriOffset: 0, calendar: utc))
        }
    }

    // MARK: Countdown

    private let fajr = Date(timeIntervalSince1970: 1_800_000_000)          // 10 min before: imsak
    private var imsak: Date { fajr.addingTimeInterval(-600) }
    private var maghrib: Date { fajr.addingTimeInterval(12 * 3600) }
    private var tomorrowFajr: Date { fajr.addingTimeInterval(24 * 3600) }

    private func compute(now: Date, today: Bool = true, tomorrow: Bool = true) -> FastingCountdown? {
        FastingCountdown.compute(
            now: now, todayFajr: fajr, todayMaghrib: maghrib, tomorrowFajr: tomorrowFajr,
            isRamadhanToday: today, isRamadhanTomorrow: tomorrow
        )
    }

    @Test func countsDownToImsakThenIftarThenTomorrowsImsak() {
        #expect(compute(now: fajr.addingTimeInterval(-3600)) == FastingCountdown(target: .imsak, at: imsak))
        #expect(compute(now: imsak.addingTimeInterval(1)) == FastingCountdown(target: .maghrib, at: maghrib))
        #expect(compute(now: maghrib.addingTimeInterval(1)) == FastingCountdown(target: .imsak, at: tomorrowFajr.addingTimeInterval(-600)))
    }

    @Test func nothingOutsideFastingDays() {
        #expect(compute(now: fajr.addingTimeInterval(-3600), today: false, tomorrow: false) == nil)
        // Last day of Ramadhan: after iftar there is no next sahur.
        #expect(compute(now: maghrib.addingTimeInterval(1), today: true, tomorrow: false) == nil)
        // Eve of the first fast: nothing until maghrib, then the sahur countdown.
        #expect(compute(now: maghrib.addingTimeInterval(-60), today: false, tomorrow: true) == nil)
        #expect(compute(now: maghrib.addingTimeInterval(60), today: false, tomorrow: true)?.target == .imsak)
    }

    @Test func titleReadsLikeTheMenuBar() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        #expect(FastingCountdown(target: .maghrib, at: now.addingTimeInterval(2 * 3600 + 14 * 60 + 9)).title(at: now) == "Iftar 2h 14m")
        #expect(FastingCountdown(target: .imsak, at: now.addingTimeInterval(14 * 60 + 5)).title(at: now) == "Imsak 14m 05s")
        #expect(FastingCountdown(target: .imsak, at: now.addingTimeInterval(-5)).title(at: now) == "Imsak 0m 00s")
    }

    @Test func imsakMinutesAreConfigurable() {
        let c = FastingCountdown.compute(
            now: fajr.addingTimeInterval(-3600), todayFajr: fajr, todayMaghrib: maghrib, tomorrowFajr: tomorrowFajr,
            isRamadhanToday: true, isRamadhanTomorrow: true, imsakMinutes: 15
        )
        #expect(c?.at == fajr.addingTimeInterval(-900))
    }
}

struct AuthParsingTests {
    @Test func findsTheSessionTokenAmongSeveralCookies() {
        let header = "__Secure-better-auth.session_token=abc123.sig%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax, __Secure-better-auth.session_data=eyJ; Max-Age=300; Path=/"
        #expect(AuthParsing.sessionToken(fromSetCookie: header) == "abc123.sig%3D")
    }

    @Test func plainCookieNameAndNoTokenCases() {
        #expect(AuthParsing.sessionToken(fromSetCookie: "better-auth.session_token=t.s; Path=/") == "t.s")
        #expect(AuthParsing.sessionToken(fromSetCookie: "better-auth.session_data=x; Path=/") == nil)
        #expect(AuthParsing.sessionToken(fromSetCookie: "better-auth.session_token=; Max-Age=0") == nil)
    }

    @Test func readsTheOAuthStateCookie() {
        #expect(AuthParsing.oauthState(fromSetCookie: "__Secure-better-auth.oauth_state=enc%2Fdata; Max-Age=600") == "enc%2Fdata")
        #expect(AuthParsing.oauthState(fromSetCookie: "better-auth.state=abc.def; Max-Age=300") == nil)
    }

    @Test func tokenComesOutOfTheBrowserCallback() throws {
        let cookie = "__Secure-better-auth.session_token=tok.sig%3D; Max-Age=604800; Path=/"
        var comps = URLComponents(string: "waqtu://auth")!
        comps.queryItems = [URLQueryItem(name: "cookie", value: cookie)]
        let url = try #require(comps.url)
        #expect(try WaqtuAPIClient.sessionToken(fromCallback: url) == "tok.sig%3D")
    }

    @Test func callbackWithoutACookieIsAnError() {
        #expect(throws: WaqtuAPIError.missingToken) {
            _ = try WaqtuAPIClient.sessionToken(fromCallback: URL(string: "waqtu://auth?error=access_denied")!)
        }
    }

    @Test func percentEncodingLeavesNoQueryDelimiters() {
        let encoded = AuthParsing.percentEncode("https://accounts.google.com/o/oauth2/v2/auth?a=1&b=x y+z")
        #expect(!encoded.contains("&"))
        #expect(!encoded.contains("?"))
        #expect(!encoded.contains(" "))
        #expect(encoded.contains("%26"))
    }
}
