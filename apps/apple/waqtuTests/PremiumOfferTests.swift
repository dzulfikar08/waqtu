//
//  PremiumOfferTests.swift
//  waqtuTests
//
//  The Mac App Store paywall's pure pieces (waqtu-sync/PremiumOffer.swift): which introductory
//  offer shows as a free trial, its length, and the legal links per language.
//

import Foundation
import Testing

struct PremiumOfferTests {
    private let week = SubscriptionTerm(value: 1, unit: .week)

    @Test func eligibleFreeIntroOfferIsTheFreeTrial() {
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: week, periodCount: 1) == week)
    }

    @Test func noFreeTrialWhenUsedOrNotFree() {
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: false, period: week, periodCount: 1) == nil)
        #expect(SubscriptionTerm.freeTrial(isFree: false, isEligible: true, period: week, periodCount: 1) == nil)
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: week, periodCount: 0) == nil)
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: SubscriptionTerm(value: 0, unit: .day), periodCount: 1) == nil)
    }

    @Test func lengthIsSaidTheWayAPersonSaysIt() {
        let sevenDays = SubscriptionTerm(value: 7, unit: .day)
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: sevenDays, periodCount: 1) == week)
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: SubscriptionTerm(value: 1, unit: .day), periodCount: 14)
            == SubscriptionTerm(value: 2, unit: .week))
        #expect(SubscriptionTerm(value: 3, unit: .day).normalized == SubscriptionTerm(value: 3, unit: .day))
        #expect(SubscriptionTerm.freeTrial(isFree: true, isEligible: true, period: SubscriptionTerm(value: 1, unit: .month), periodCount: 2)
            == SubscriptionTerm(value: 2, unit: .month))
    }

    @Test func legalLinksFollowTheAppLanguage() {
        #expect(LegalLinks.terms(language: "id").absoluteString == "https://getwaqtu.com/terms")
        #expect(LegalLinks.privacy(language: "id-ID").absoluteString == "https://getwaqtu.com/privacy")
        #expect(LegalLinks.terms(language: "en").absoluteString == "https://getwaqtu.com/en/terms")
        #expect(LegalLinks.privacy(language: "en-GB").absoluteString == "https://getwaqtu.com/en/privacy")
        #expect(LegalLinks.terms(language: nil).absoluteString == "https://getwaqtu.com/en/terms")
    }
}
