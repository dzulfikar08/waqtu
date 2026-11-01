//
//  IbadahStore.swift
//  waqtu
//
//  Device-local state of the Ibadah tools (apps/mobile/src/ibadah/store.ts): reader progress for
//  the day, doa favourites, the tasbih count and the reader's display choices, kept as strings
//  under the same `ibadah.*` keys the phone uses in its settings table. One JSON file in
//  Application Support; none of it is synced. Main-thread use only.
//

import Foundation

final class IbadahStore {
    private var values: [String: String]
    private let fileURL: URL?

    /// `fileURL == nil` keeps everything in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            values = decoded
        } else {
            values = [:]
        }
    }

    /// `~/Library/Application Support/<bundle id>/ibadah.json`.
    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("ibadah.json")
    }

    func value(_ key: String) -> String? { values[key] }

    func set(_ key: String, _ value: String) {
        guard values[key] != value else { return }
        values[key] = value
        commit()
    }

    private func commit() {
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(values).write(to: fileURL, options: .atomic)
        } catch {
            // Keep working in memory; the next change tries again.
        }
    }
}

/// Which parts of a text the reader shows (mobile: `ibadah.readerView`).
struct ReaderView: Equatable {
    var latin = true
    var translation = true

    static let key = "ibadah.readerView"

    static func parse(_ raw: String?) -> ReaderView {
        var view = ReaderView()
        guard let raw, let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let latin = object["latin"], let translation = object["translation"] else { return view }
        // Like the phone: both keys must be there, and only a literal `false` turns a part off.
        view.latin = !isFalse(latin)
        view.translation = !isFalse(translation)
        return view
    }

    private static func isFalse(_ value: Any) -> Bool {
        guard let flag = value as? NSNumber, CFGetTypeID(flag) == CFBooleanGetTypeID() else { return false }
        return !flag.boolValue
    }

    func serialized() -> String {
        let object: [String: Any] = ["latin": latin, "translation": translation]
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8) else { return "{}" }
        return string
    }
}
