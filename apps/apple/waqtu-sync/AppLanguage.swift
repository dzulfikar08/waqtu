//
//  AppLanguage.swift
//  waqtu
//
//  The language the app's strings resolved to (Localizable.xcstrings: Indonesian or English,
//  picked by the system's preferred languages), so dates and numbers are formatted to match.
//

import Foundation

enum AppLanguage {
    /// Locale of the localization the bundle chose; English when none matched.
    static var locale: Locale {
        Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en")
    }

    private static let englishShortWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// One-letter weekday for an English short name ("Mon" → "M", or "S" for Senin in Indonesian).
    static func weekdayInitial(englishShortName: String) -> String {
        guard let index = englishShortWeekdays.firstIndex(of: englishShortName) else {
            return String(englishShortName.prefix(1)).uppercased()
        }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = locale
        return formatter.veryShortWeekdaySymbols[index]
    }
}
