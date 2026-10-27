//
//  IbadahSupport.swift
//  waqtu
//
//  Shared plumbing of the Ibadah window: its string table (Ibadah.xcstrings, Indonesian + English,
//  kept apart from Localizable and Modules) and the bundled adhkar content (content/adhkar copied
//  into the app as-is), parsed on first use.
//

import Foundation

/// A string from the `Ibadah` table (Ibadah.xcstrings).
func istr(_ key: String.LocalizationValue) -> String {
    String(localized: key, table: "Ibadah")
}

/// The adhkar files of content/adhkar, read from the app bundle. Main-thread use only.
enum IbadahLibrary {
    private static var sessions: [ReaderSessionID: ReaderSession] = [:]
    private static var cachedDuas: [DuaCategory]?
    private static var cachedPhrases: [TasbihPhrase]?

    private static func data(_ name: String) -> Data? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json") else { return nil }
        return try? Data(contentsOf: url)
    }

    /// A reader session, parsed on first use and kept. Nil when its file is missing or invalid.
    static func session(_ id: ReaderSessionID) -> ReaderSession? {
        if let cached = sessions[id] { return cached }
        guard let bytes = data(id.fileName), let session = try? IbadahContent.parseSession(bytes, id: id) else {
            return nil
        }
        sessions[id] = session
        return session
    }

    static var duas: [DuaCategory] {
        if let cachedDuas { return cachedDuas }
        guard let bytes = data("duas"), let parsed = try? IbadahContent.parseDuas(bytes) else { return [] }
        cachedDuas = parsed
        return parsed
    }

    static var phrases: [TasbihPhrase] {
        if let cachedPhrases { return cachedPhrases }
        guard let bytes = data("tasbih"), let parsed = try? IbadahContent.parseTasbih(bytes) else { return [] }
        cachedPhrases = parsed
        return parsed
    }
}
