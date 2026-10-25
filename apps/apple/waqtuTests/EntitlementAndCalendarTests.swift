//
//  EntitlementAndCalendarTests.swift
//  waqtuTests
//
//  `GET /v1/entitlement` decoding and Gregorian civil dates under non-Gregorian system calendars.
//

import Foundation
import Testing

struct AccountEntitlementTests {
    @Test func decodesASubscriptionFromThePhone() throws {
        let json = #"{"premium":true,"source":"google","expiresAt":"2027-03-01T00:00:00.000Z"}"#
        let entitlement = try AccountEntitlement.decode(Data(json.utf8))
        #expect(entitlement == AccountEntitlement(premium: true, source: "google", expiresAt: "2027-03-01T00:00:00.000Z"))
    }

    @Test func decodesLifetimeAndNeverPremium() throws {
        let lifetime = try AccountEntitlement.decode(Data(#"{"premium":true,"source":"license","expiresAt":null}"#.utf8))
        #expect(lifetime.premium && lifetime.source == "license" && lifetime.expiresAt == nil)
        let none = try AccountEntitlement.decode(Data(#"{"premium":false,"source":null,"expiresAt":null}"#.utf8))
        #expect(none == AccountEntitlement(premium: false, source: nil, expiresAt: nil))
    }

    @Test func rejectsAMalformedBody() {
        #expect(throws: WaqtuAPIError.invalidResponse) {
            try AccountEntitlement.decode(Data(#"{"error":"unauthorized"}"#.utf8))
        }
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
