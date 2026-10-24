//
//  TestSupport.swift
//  waqtuTests
//
//  In-memory transport and helpers shared by the sync tests.
//

import Foundation

/// A fake /v1/sync server: rows keyed like the real one, with a revision counter as the cursor.
/// Applies pushes with the same last-write-wins rules as services/api/src/sync.ts.
final class FakeServer: SyncTransport {
    private var rev = 0
    private var entries: [String: (row: SyncEntry, rev: Int)] = [:]
    private var settings: [String: (row: SyncSetting, rev: Int)] = [:]
    private(set) var pushes: [(entries: [SyncEntry], settings: [SyncSetting])] = []
    var pullPageSize = SyncLimits.pullLimit
    var failPush: Error?

    func seed(_ entry: SyncEntry) { applyEntry(entry) }
    func seed(_ setting: SyncSetting) { applySetting(setting) }

    func entry(_ date: String, _ itemId: String) -> SyncEntry? { entries["\(date)|\(itemId)"]?.row }
    func setting(_ key: String) -> SyncSetting? { settings[key]?.row }

    private func applyEntry(_ e: SyncEntry) {
        let key = "\(e.date)|\(e.itemId)"
        if SyncMerge.entryWins(e, over: entries[key]?.row) {
            rev += 1
            entries[key] = (e, rev)
        }
    }

    private func applySetting(_ s: SyncSetting) {
        if SyncMerge.settingWins(s, over: settings[s.key]?.row) {
            rev += 1
            settings[s.key] = (s, rev)
        }
    }

    func pull(since: String, limit: Int) async throws -> SyncPullPage {
        let after = Int(since) ?? 0
        var rows: [(rev: Int, entry: SyncEntry?, setting: SyncSetting?)] = []
        for (_, v) in entries where v.rev > after { rows.append((v.rev, v.row, nil)) }
        for (_, v) in settings where v.rev > after { rows.append((v.rev, nil, v.row)) }
        rows.sort { $0.rev < $1.rev }
        let size = min(limit, pullPageSize)
        let page = Array(rows.prefix(size))
        return SyncPullPage(
            entries: page.compactMap { $0.entry },
            settings: page.compactMap { $0.setting },
            cursor: String(page.last?.rev ?? after),
            hasMore: rows.count > size
        )
    }

    func push(entries newEntries: [SyncEntry], settings newSettings: [SyncSetting]) async throws {
        if let failPush { throw failPush }
        pushes.append((newEntries, newSettings))
        for e in newEntries { applyEntry(e) }
        for s in newSettings { applySetting(s) }
    }
}

func logEntry(_ date: String, _ prayer: String, _ status: PrayerLogEntry.Status, at ms: Int64) -> PrayerLogEntry {
    PrayerLogEntry(date: date, prayer: prayer, status: status, loggedAt: FardhMapping.date(fromMillis: ms))
}
