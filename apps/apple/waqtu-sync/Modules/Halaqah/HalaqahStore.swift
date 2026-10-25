//
//  HalaqahStore.swift
//  waqtu
//
//  Device-local halaqah state (apps/mobile/src/halaqah/db.ts): which program days are done and the
//  private text reflections. Neither leaves the Mac; completion reaches the account only through
//  the `halaqah` mutabaah entry, written to the sync replica exactly like mobile's `completeDay`.
//  Persisted as one JSON file. Main-thread use only.
//

import Foundation

/// Where a completed session is recorded: the mutabaah replica the sync engine uploads.
protocol MutabaahEntryWriter: AnyObject {
    func entryValue(date: String, itemId: String) -> Int?
    @discardableResult
    func recordLocalEntry(date: String, itemId: String, value: Int, at: Int64) -> Bool
}

extension MutabaahReplica: MutabaahEntryWriter {}

struct HalaqahLocalState: Codable, Equatable {
    /// `programId:day` → civil day (`YYYY-MM-DD`) the day was marked done.
    var progress: [String: String] = [:]
    /// `programId:day` → reflection text. Private: never synced.
    var reflections: [String: String] = [:]
}

final class HalaqahStore {
    /// Mutabaah item key a finished halaqah session is recorded under.
    static let itemId = "halaqah"
    static let maxReflection = 4000

    private(set) var state: HalaqahLocalState
    private let fileURL: URL?

    /// `fileURL == nil` keeps everything in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(HalaqahLocalState.self, from: data) {
            state = decoded
        } else {
            state = HalaqahLocalState()
        }
    }

    /// `~/Library/Application Support/<bundle id>/halaqah.json`.
    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("halaqah.json")
    }

    private static func key(_ programId: String, _ day: Int) -> String { "\(programId):\(day)" }

    /// Completed program days with the civil day each was marked.
    func progress(programId: String) -> [Int: String] {
        let prefix = programId + ":"
        var out: [Int: String] = [:]
        for (key, completedOn) in state.progress where key.hasPrefix(prefix) {
            if let day = Int(key.dropFirst(prefix.count)) { out[day] = completedOn }
        }
        return out
    }

    /// Marks a program day done and records the `halaqah` entry for the day it was first marked
    /// (`completedOn`, which for catch-up is later than the program day). Marking again keeps the
    /// first completion date. Returns true when the replica changed (a sync is due).
    @discardableResult
    func completeDay(programId: String, day: Int, completedOn: String, writer: MutabaahEntryWriter, at: Int64) -> Bool {
        let k = Self.key(programId, day)
        if state.progress[k] == nil {
            state.progress[k] = completedOn
            commit()
        }
        let date = state.progress[k] ?? completedOn
        return writer.recordLocalEntry(date: date, itemId: Self.itemId, value: 1, at: at)
    }

    /// Undoes a completion. The mutabaah entry is cleared only when no other session (of any
    /// program) was finished that day. Returns true when the replica changed.
    @discardableResult
    func uncompleteDay(programId: String, day: Int, writer: MutabaahEntryWriter, at: Int64) -> Bool {
        let k = Self.key(programId, day)
        guard let completedOn = state.progress.removeValue(forKey: k) else { return false }
        commit()
        if state.progress.values.contains(completedOn) { return false }
        return writer.recordLocalEntry(date: completedOn, itemId: Self.itemId, value: 0, at: at)
    }

    func reflection(programId: String, day: Int) -> String {
        state.reflections[Self.key(programId, day)] ?? ""
    }

    /// Saves the reflection on this Mac only; empty text deletes it.
    func saveReflection(programId: String, day: Int, text: String) {
        let body = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.maxReflection))
        let k = Self.key(programId, day)
        let current = state.reflections[k]
        if body.isEmpty {
            guard current != nil else { return }
            state.reflections.removeValue(forKey: k)
        } else {
            guard current != body else { return }
            state.reflections[k] = body
        }
        commit()
    }

    private func commit() {
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(state).write(to: fileURL, options: .atomic)
        } catch {
            // The next commit retries; a failed write only delays persistence.
        }
    }
}
