//
//  SyncEngine.swift
//  waqtu
//
//  Pull-then-push sync, a port of apps/mobile/src/mutabaah/syncEngine.ts.
//

import Foundation

protocol SyncTransport {
    func pull(since: String, limit: Int) async throws -> SyncPullPage
    func push(entries: [SyncEntry], settings: [SyncSetting]) async throws
}

/// Local storage the engine syncs. Rows written by the user stay dirty until the server has them.
/// Not thread-safe: call it from one actor (the main actor in the app).
protocol SyncStore: AnyObject {
    func cursor() -> String
    func setCursor(_ cursor: String)
    func entry(date: String, itemId: String) -> SyncEntry?
    func setting(key: String) -> SyncSetting?
    /// Stores a row that came from the server (clean).
    func putRemoteEntry(_ entry: SyncEntry)
    func putRemoteSetting(_ setting: SyncSetting)
    func dirtyEntries() -> [SyncEntry]
    func dirtySettings() -> [SyncSetting]
    /// Clears `dirty` only for rows still at the pushed `updatedAt`, so an edit made mid-sync stays queued.
    func markEntriesClean(_ entries: [SyncEntry])
    func markSettingsClean(_ settings: [SyncSetting])
    /// Persist everything written so far.
    func commit()
}

struct SyncReport: Equatable {
    /// Rows that won the merge and were stored locally, in server order.
    var pulledEntries: [SyncEntry] = []
    var pulledSettings: [SyncSetting] = []
    var pushed: Int = 0

    var pulled: Int { pulledEntries.count + pulledSettings.count }
}

/// Pull everything since the stored cursor (merging last-write-wins), then push local changes.
/// Pull first, so a stale local edit loses to a newer remote one before it is ever sent. Safe to
/// run twice in a row: the second run pushes nothing. Runs on the main actor because the store is
/// only touched from there; the transport awaits off it.
@MainActor
func runSync(store: SyncStore, transport: SyncTransport) async throws -> SyncReport {
    var report = SyncReport()
    var cursor = store.cursor()
    while true {
        let page = try await transport.pull(since: cursor, limit: SyncLimits.pullLimit)
        for incoming in page.entries {
            if SyncMerge.entryWins(incoming, over: store.entry(date: incoming.date, itemId: incoming.itemId)) {
                store.putRemoteEntry(incoming)
                report.pulledEntries.append(incoming)
            }
        }
        for incoming in page.settings {
            if SyncMerge.settingWins(incoming, over: store.setting(key: incoming.key)) {
                store.putRemoteSetting(incoming)
                report.pulledSettings.append(incoming)
            }
        }
        store.setCursor(page.cursor)
        store.commit()
        // A server that claims more but does not advance would loop forever.
        if !page.hasMore || page.cursor == cursor { break }
        cursor = page.cursor
    }

    let entries = SyncMerge.chunk(store.dirtyEntries(), size: SyncLimits.pushEntries)
    let settings = SyncMerge.chunk(store.dirtySettings(), size: SyncLimits.pushSettings)
    let rounds = max(entries.count, settings.count)
    for i in 0..<rounds {
        let e = i < entries.count ? entries[i] : []
        let s = i < settings.count ? settings[i] : []
        try await transport.push(entries: e, settings: s)
        store.markEntriesClean(e)
        store.markSettingsClean(s)
        store.commit()
        report.pushed += e.count + s.count
    }
    return report
}
