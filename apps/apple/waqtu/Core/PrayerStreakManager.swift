//
//  PrayerStreakManager.swift
//  waqtu
//
//  The Mac's prayer log: prayed / late / missed per prayer (overlay, "I am going to pray").
//  Stored in UserDefaults as JSON. The streak is computed from the synced checklist
//  (waqtu-sync/MutabaahStreakModel.swift), with the phone's rules, not from this log.
//

import Foundation

// `PrayerLogEntry` and `PrayerLogChange` live in waqtu-sync/PrayerLog.swift (shared with the sync tests).

@Observable
final class PrayerStreakManager {
    private let defaults = UserDefaults.standard
    private let logKey = "prayerLogEntries"

    private(set) var entries: [PrayerLogEntry] = []

    /// When each prayer was cleared on this Mac (`FardhMapping.clearKey`), until the clear has been
    /// handed to the account. Lets a clear made while signed out reach the account after sign-in.
    @ObservationIgnored private(set) var clearedAt: [String: Date] = [:]
    private let clearedKey = "prayerLogClearedAt"

    /// Called after every edit made on this Mac (not for pulled changes), so it can reach the account.
    @ObservationIgnored var onLocalChange: ((PrayerLogChange) -> Void)?

    init() {
        load()
    }

    // MARK: - Logging

    func logPrayer(prayer: String, status: PrayerLogEntry.Status, date: Date = Date()) {
        let dateString = FardhMapping.dayKey(for: date)

        // Remove any existing entry for this prayer+date
        entries.removeAll { $0.date == dateString && $0.prayer == prayer }

        let entry = PrayerLogEntry(
            date: dateString,
            prayer: prayer,
            status: status,
            loggedAt: Date()
        )
        entries.append(entry)
        save()
        forgetCleared(date: dateString, prayer: prayer)
        onLocalChange?(PrayerLogChange(date: dateString, prayer: prayer, status: status, at: entry.loggedAt))
    }

    func markPrayed(prayer: String, date: Date = Date()) {
        logPrayer(prayer: prayer, status: .prayed, date: date)
    }

    func markMissed(prayer: String, date: Date = Date()) {
        logPrayer(prayer: prayer, status: .missed, date: date)
    }

    /// Removes the log entry of a prayer (unticking it in the menu).
    func clearPrayer(prayer: String, date: Date = Date()) {
        let dateString = FardhMapping.dayKey(for: date)
        let before = entries.count
        entries.removeAll { $0.date == dateString && $0.prayer == prayer }
        guard entries.count != before else { return }
        save()
        let now = Date()
        clearedAt[FardhMapping.clearKey(date: dateString, prayer: prayer)] = now
        saveCleared()
        onLocalChange?(PrayerLogChange(date: dateString, prayer: prayer, status: nil, at: now))
    }

    /// Applies a change pulled from the account: stored as-is, without `onLocalChange`.
    func applyRemote(_ change: PrayerLogChange) {
        entries.removeAll { $0.date == change.date && $0.prayer == change.prayer }
        if let status = change.status {
            entries.append(PrayerLogEntry(date: change.date, prayer: change.prayer, status: status, loggedAt: change.at))
        }
        save()
        forgetCleared(date: change.date, prayer: change.prayer)
    }

    /// The account has been told about every clear recorded so far.
    func clearHandedOverMarks() {
        guard !clearedAt.isEmpty else { return }
        clearedAt = [:]
        saveCleared()
    }

    private func forgetCleared(date: String, prayer: String) {
        if clearedAt.removeValue(forKey: FardhMapping.clearKey(date: date, prayer: prayer)) != nil {
            saveCleared()
        }
    }

    private func saveCleared() {
        let raw = clearedAt.mapValues { $0.timeIntervalSince1970 }
        if raw.isEmpty {
            defaults.removeObject(forKey: clearedKey)
        } else if let data = try? JSONEncoder().encode(raw) {
            defaults.set(data, forKey: clearedKey)
        }
    }

    private func load() {
        guard let data = defaults.data(forKey: logKey),
              let decoded = try? JSONDecoder().decode([PrayerLogEntry].self, from: data) else {
            entries = []
            loadCleared()
            return
        }
        entries = decoded
        loadCleared()
    }

    private func loadCleared() {
        guard let data = defaults.data(forKey: clearedKey),
              let raw = try? JSONDecoder().decode([String: Double].self, from: data) else {
            clearedAt = [:]
            return
        }
        clearedAt = raw.mapValues { Date(timeIntervalSince1970: $0) }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        defaults.set(data, forKey: logKey)
    }

    /// Remove all log data.
    func resetAll() {
        entries = []
        defaults.removeObject(forKey: logKey)
        clearedAt = [:]
        defaults.removeObject(forKey: clearedKey)
    }
}
