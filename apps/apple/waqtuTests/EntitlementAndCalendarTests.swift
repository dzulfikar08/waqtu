//
//  EntitlementAndCalendarTests.swift
//  waqtuTests
//
//  `GET /v1/entitlement` decoding, the App Store account token and Gregorian civil dates under
//  non-Gregorian system calendars.
//

import Foundation
import Testing

struct AccountEntitlementTests {
    @Test func decodesASubscriptionFromThePhone() throws {
        let json = #"{"premium":true,"source":"google","expiresAt":"2027-03-01T00:00:00.000Z"}"#
        let entitlement = try AccountEntitlement.decode(Data(json.utf8))
        #expect(entitlement == AccountEntitlement(premium: true, source: "google", expiresAt: "2027-03-01T00:00:00.000Z"))
    }

    @Test func decodesAMacAppStoreSubscriptionAndNeverPremium() throws {
        let mac = try AccountEntitlement.decode(Data(#"{"premium":true,"source":"apple","expiresAt":"2027-01-01T00:00:00.000Z"}"#.utf8))
        #expect(mac.premium && mac.source == "apple")
        let none = try AccountEntitlement.decode(Data(#"{"premium":false,"source":null,"expiresAt":null}"#.utf8))
        #expect(none == AccountEntitlement(premium: false, source: nil, expiresAt: nil))
    }

    @Test func rejectsAMalformedBody() {
        #expect(throws: WaqtuAPIError.invalidResponse) {
            try AccountEntitlement.decode(Data(#"{"error":"unauthorized"}"#.utf8))
        }
    }
}

struct AppleAccountTokenTests {
    // Same vectors as services/api/test/apple.test.ts and apps/mobile/test/premium.test.ts: the
    // server refuses a purchase whose appAccountToken is not the signed-in account's.
    @Test func matchesTheServerToken() {
        #expect(AppleAccountToken.uuid(forUserId: "u1").uuidString.lowercased() == "9e06e6d6-1126-521a-9511-b7cf7cf56f56")
        #expect(AppleAccountToken.uuid(forUserId: "user-7f3c9a2e").uuidString.lowercased() == "113d974f-b307-5679-90ee-46873dc02d81")
    }
}

struct NonGregorianSystemCalendarTests {
    private func noonUTC(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        return utc.date(from: DateComponents(year: y, month: m, day: d, hour: 12))!
    }

    @Test func ramadhanIsTheSameUnderAnIslamicSystemCalendar() {
        var islamic = Calendar(identifier: .islamicUmmAlQura)
        islamic.timeZone = TimeZone(identifier: "UTC")!
        var gregorian = Calendar(identifier: .gregorian)
        gregorian.timeZone = islamic.timeZone
        // Ramadhan 1447 falls in March 2026.
        #expect(Ramadhan.isRamadhan(on: noonUTC(2026, 3, 5), calendar: islamic))
        #expect(!Ramadhan.isRamadhan(on: noonUTC(2026, 4, 10), calendar: islamic))
        for d in 1...28 {
            #expect(Ramadhan.isRamadhan(on: noonUTC(2026, 2, d), calendar: islamic)
                    == Ramadhan.isRamadhan(on: noonUTC(2026, 2, d), calendar: gregorian))
        }
    }
}
