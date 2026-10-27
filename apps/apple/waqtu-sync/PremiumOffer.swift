//
//  PremiumOffer.swift
//  waqtu
//
//  Pure pieces of the Mac App Store paywall (UI/MenuBarView.swift `PremiumOfferView`), kept free of
//  StoreKit and SwiftUI so waqtuTests can check them: the free-trial length an introductory offer
//  gives, and the Terms of Use and Privacy Policy pages in the app's language.
//

import Foundation

/// A length of time as StoreKit's `Product.SubscriptionPeriod` reports it.
struct SubscriptionTerm: Equatable {
    enum Unit: Equatable {
        case day, week, month, year
    }

    let value: Int
    let unit: Unit

    /// The way a person says it: StoreKit may report a week as 7 days.
    var normalized: SubscriptionTerm {
        if unit == .day, value > 0, value % 7 == 0 { return SubscriptionTerm(value: value / 7, unit: .week) }
        return self
    }

    /// The free trial to show before subscribing: only an introductory offer that is free, for an
    /// Apple ID still eligible for it. The offer runs `periodCount` times `period` (a one-week free
    /// trial is 1 × P1W).
    static func freeTrial(isFree: Bool, isEligible: Bool, period: SubscriptionTerm, periodCount: Int) -> SubscriptionTerm? {
        guard isFree, isEligible, period.value > 0, periodCount > 0 else { return nil }
        return SubscriptionTerm(value: period.value * periodCount, unit: period.unit).normalized
    }
}

/// Terms of Use and Privacy Policy on getwaqtu.com: Indonesian at the root, English under /en.
enum LegalLinks {
    private static func isIndonesian(_ language: String?) -> Bool {
        language?.lowercased().hasPrefix("id") == true
    }

    /// `language` is the app's language, e.g. `Bundle.main.preferredLocalizations.first`.
    static func terms(language: String?) -> URL {
        URL(string: isIndonesian(language) ? "https://getwaqtu.com/terms" : "https://getwaqtu.com/en/terms")!
    }

    static func privacy(language: String?) -> URL {
        URL(string: isIndonesian(language) ? "https://getwaqtu.com/privacy" : "https://getwaqtu.com/en/privacy")!
    }
}
