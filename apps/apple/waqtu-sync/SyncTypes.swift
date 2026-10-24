//
//  SyncTypes.swift
//  waqtu
//
//  Wire types and last-write-wins rules of /v1/sync (services/api/src/sync.ts).
//  Mirrors apps/mobile/src/mutabaah/merge.ts so every replica converges.
//

import Foundation

/// One checklist cell: a (day, item) pair. For the five fardhu, `value` holds `FardhFlag` bits.
struct SyncEntry: Codable, Equatable, Hashable {
    var date: String
    var itemId: String
    var value: Int
    /// Epoch milliseconds of the last edit.
    var updatedAt: Int64
}

/// One synced account setting; the value is always a string.
struct SyncSetting: Codable, Equatable, Hashable {
    var key: String
    var value: String
    /// Epoch milliseconds of the last edit.
    var updatedAt: Int64
}

struct SyncPullPage: Decodable, Equatable {
    var entries: [SyncEntry]
    var settings: [SyncSetting]
    var cursor: String
    var hasMore: Bool
}

enum SyncLimits {
    /// Server caps per request (services/api/src/validate.ts).
    static let pushEntries = 500
    static let pushSettings = 100
    static let pullLimit = 500
}

enum SyncMerge {
    /// Bytewise UTF-8 comparison: what SQLite does on the server for `value > value`.
    static func utf8Greater(_ a: String, _ b: String) -> Bool {
        Array(b.utf8).lexicographicallyPrecedes(Array(a.utf8))
    }

    /// True when `incoming` should replace `current` (nil = no row yet). Identical rows do not replace.
    static func entryWins(_ incoming: SyncEntry, over current: SyncEntry?) -> Bool {
        guard let current else { return true }
        if incoming.updatedAt != current.updatedAt { return incoming.updatedAt > current.updatedAt }
        return incoming.value > current.value
    }

    static func settingWins(_ incoming: SyncSetting, over current: SyncSetting?) -> Bool {
        guard let current else { return true }
        if incoming.updatedAt != current.updatedAt { return incoming.updatedAt > current.updatedAt }
        return utf8Greater(incoming.value, current.value)
    }

    static func chunk<T>(_ items: [T], size: Int) -> [[T]] {
        guard size > 0 else { return [items] }
        var out: [[T]] = []
        var index = 0
        while index < items.count {
            out.append(Array(items[index..<min(index + size, items.count)]))
            index += size
        }
        return out
    }
}
