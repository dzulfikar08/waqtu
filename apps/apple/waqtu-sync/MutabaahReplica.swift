//
//  MutabaahReplica.swift
//  waqtu
//
//  On-device copy of the account's mutabaah entries and synced settings, with the dirty flags and
//  cursor the sync engine needs (the Mac counterpart of apps/mobile/src/sync/sqliteStore.ts).
//  Persisted as one JSON file. Main-thread use only.
//

import Foundation

struct ReplicaRow: Codable, Equatable {
    var value: String
    var updatedAt: Int64
    var dirty: Bool
}

struct ReplicaState: Codable, Equatable {
    /// Account the rows belong to; nil before the first sign-in.
    var userId: String?
    var cursor: String = "0"
    /// `date|itemId` → row; the value is the integer of the entry as a decimal string.
    var entries: [String: ReplicaRow] = [:]
    var settings: [String: ReplicaRow] = [:]
}

enum AccountSwitch: Equatable {
    /// Same account as before: nothing changes.
    case unchanged
    /// First sign-in on this device: what was recorded offline is kept and uploaded.
    case firstSignIn
    /// A different account: the previous account's rows and cursor were cleared.
    case replaced
}

final class MutabaahReplica: SyncStore {
    private(set) var state: ReplicaState
    private let fileURL: URL?

    /// `fileURL == nil` keeps everything in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(ReplicaState.self, from: data) {
            state = decoded
        } else {
            state = ReplicaState()
        }
    }

    /// `~/Library/Application Support/<bundle id>/mutabaah-sync.json`.
    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("mutabaah-sync.json")
    }

    private static func key(_ date: String, _ itemId: String) -> String { "\(date)|\(itemId)" }

    // MARK: - Account

    /// Local data follows the account on this device, except when a different account signs in:
    /// then the previous account's rows and the cursor are cleared (they live on its server copy,
    /// and switching back re-pulls them in full) so nothing is uploaded to the wrong account.
    @discardableResult
    func prepareAccount(userId: String) -> AccountSwitch {
        if state.userId == userId { return .unchanged }
        let hadAccount = state.userId != nil
        state.cursor = "0"
        if hadAccount {
            state.entries = [:]
            state.settings = [:]
        }
        state.userId = userId
        commit()
        return hadAccount ? .replaced : .firstSignIn
    }

    // MARK: - Reads

    func entryValue(date: String, itemId: String) -> Int? {
        entry(date: date, itemId: itemId)?.value
    }

    func settingValue(_ key: String) -> String? {
        state.settings[key]?.value
    }

    var hasDirtyRows: Bool {
        state.entries.values.contains { $0.dirty } || state.settings.values.contains { $0.dirty }
    }

    /// Every stored fardh/checklist entry of `date`, by item id.
    func entries(on date: String) -> [String: SyncEntry] {
        var out: [String: SyncEntry] = [:]
        let prefix = date + "|"
        for (key, row) in state.entries where key.hasPrefix(prefix) {
            let itemId = String(key.dropFirst(prefix.count))
            if let e = Self.entry(date: date, itemId: itemId, row: row) { out[itemId] = e }
        }
        return out
    }

    // MARK: - Local edits

    /// Records a user edit. The edit wins over whatever is stored: its timestamp is at least one
    /// millisecond after the stored row's, so a phone with a fast clock cannot silently undo it.
    /// A no-op edit (same value, or clearing a cell that was never recorded) writes nothing.
    @discardableResult
    func recordLocalEntry(date: String, itemId: String, value: Int, at: Int64) -> Bool {
        let k = Self.key(date, itemId)
        let current = state.entries[k]
        if let current {
            if current.value == String(value) { return false }
        } else if value == 0 {
            return false
        }
        let stamp = max(at, (current?.updatedAt ?? Int64.min) + 1)
        state.entries[k] = ReplicaRow(value: String(value), updatedAt: stamp, dirty: true)
        commit()
        return true
    }

    @discardableResult
    func recordLocalSetting(key: String, value: String, at: Int64) -> Bool {
        let current = state.settings[key]
        if current?.value == value { return false }
        let stamp = max(at, (current?.updatedAt ?? Int64.min) + 1)
        state.settings[key] = ReplicaRow(value: value, updatedAt: stamp, dirty: true)
        commit()
        return true
    }

    // MARK: - SyncStore

    func cursor() -> String { state.cursor }

    func setCursor(_ cursor: String) { state.cursor = cursor }

    func entry(date: String, itemId: String) -> SyncEntry? {
        guard let row = state.entries[Self.key(date, itemId)] else { return nil }
        return Self.entry(date: date, itemId: itemId, row: row)
    }

    func setting(key: String) -> SyncSetting? {
        guard let row = state.settings[key] else { return nil }
        return SyncSetting(key: key, value: row.value, updatedAt: row.updatedAt)
    }

    func putRemoteEntry(_ entry: SyncEntry) {
        state.entries[Self.key(entry.date, entry.itemId)] = ReplicaRow(
            value: String(entry.value), updatedAt: entry.updatedAt, dirty: false)
    }

    func putRemoteSetting(_ setting: SyncSetting) {
        guard SettingsSyncMapping.isSyncedKey(setting.key) else { return }
        state.settings[setting.key] = ReplicaRow(value: setting.value, updatedAt: setting.updatedAt, dirty: false)
    }

    func dirtyEntries() -> [SyncEntry] {
        state.entries.compactMap { key, row -> SyncEntry? in
            guard row.dirty, let sep = key.firstIndex(of: "|") else { return nil }
            return Self.entry(
                date: String(key[key.startIndex..<sep]),
                itemId: String(key[key.index(after: sep)...]),
                row: row)
        }
        .sorted { ($0.updatedAt, $0.date, $0.itemId) < ($1.updatedAt, $1.date, $1.itemId) }
    }

    func dirtySettings() -> [SyncSetting] {
        state.settings.compactMap { key, row -> SyncSetting? in
            guard row.dirty, SettingsSyncMapping.isSyncedKey(key) else { return nil }
            return SyncSetting(key: key, value: row.value, updatedAt: row.updatedAt)
        }
        .sorted { ($0.updatedAt, $0.key) < ($1.updatedAt, $1.key) }
    }

    func markEntriesClean(_ entries: [SyncEntry]) {
        for e in entries {
            let k = Self.key(e.date, e.itemId)
            if var row = state.entries[k], row.updatedAt == e.updatedAt {
                row.dirty = false
                state.entries[k] = row
            }
        }
    }

    func markSettingsClean(_ settings: [SyncSetting]) {
        for s in settings {
            if var row = state.settings[s.key], row.updatedAt == s.updatedAt {
                row.dirty = false
                state.settings[s.key] = row
            }
        }
    }

    func commit() {
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

    /// Drops every row and the account binding (used when the account is deleted or reset).
    func reset() {
        state = ReplicaState()
        commit()
    }

    private static func entry(date: String, itemId: String, row: ReplicaRow) -> SyncEntry? {
        guard let value = Int(row.value) else { return nil }
        return SyncEntry(date: date, itemId: itemId, value: value, updatedAt: row.updatedAt)
    }
}
