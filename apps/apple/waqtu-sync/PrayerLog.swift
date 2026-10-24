//
//  PrayerLog.swift
//  waqtu
//
//  The Mac's prayer log row and the mapping to mutabaah entries (apps/mobile/src/mutabaah/items.ts).
//

import Foundation

/// A single prayer log entry for a specific date and prayer.
struct PrayerLogEntry: Codable, Identifiable {
    var id: String { "\(date)-\(prayer)" }
    let date: String       // yyyy-MM-dd
    let prayer: String     // Fajr, Dhuhr, Asr, Maghrib, Isha
    let status: Status
    let loggedAt: Date

    enum Status: String, Codable {
        case prayed
        case missed
        case late  // prayed but late
    }
}

/// A local edit of the prayer log; `status == nil` means the entry was cleared.
struct PrayerLogChange: Equatable {
    let date: String
    let prayer: String
    let status: PrayerLogEntry.Status?
    let at: Date
}

/// Bit flags of a `fardh` mutabaah entry value (0 = nothing recorded).
enum FardhFlag {
    static let done = 1
    static let onTime = 2
    static let jamaah = 4
    static let qadha = 8
}

/// The five obligatory prayers, with the ids the account's checklist uses.
enum Fardh: String, CaseIterable {
    case fajr, dhuhr, asr, maghrib, isha

    /// Name used by the Mac prayer log ("Fajr", "Dhuhr", ...).
    var logName: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }

    init?(logName: String) {
        self.init(rawValue: logName.lowercased())
    }
}

enum FardhMapping {
    /// Local day key, like the prayer log's: `yyyy-MM-dd` in the device zone.
    static func dayKey(for date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }

    static func isDayKey(_ s: String) -> Bool {
        let parts = s.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              m >= 1, m <= 12, d >= 1 else { return false }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let range = utc.range(of: .day, in: .month, for: utc.date(from: DateComponents(year: y, month: m, day: 1)) ?? Date(timeIntervalSince1970: 0)) else {
            return false
        }
        return range.contains(d)
    }

    /// Key of a clear mark: day and prayer name as the Mac prayer log spells them.
    static func clearKey(date: String, prayer: String) -> String { "\(date)|\(prayer)" }

    static func millis(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1000).rounded())
    }

    static func date(fromMillis ms: Int64) -> Date {
        Date(timeIntervalSince1970: Double(ms) / 1000)
    }

    /// Mutabaah value for a log status. Prayed is done on time; late is done but not on time
    /// (what the phone records for a prayer marked after its window); missed is "nothing recorded".
    static func value(for status: PrayerLogEntry.Status) -> Int {
        switch status {
        case .prayed: return FardhFlag.done | FardhFlag.onTime
        case .late: return FardhFlag.done
        case .missed: return 0
        }
    }

    /// Log status for a mutabaah value; nil when nothing is recorded. The jamaah and qadha flags
    /// have no Mac equivalent and are kept in the replica, untouched.
    static func status(forValue value: Int) -> PrayerLogEntry.Status? {
        guard value & FardhFlag.done != 0 else { return nil }
        return value & FardhFlag.onTime != 0 ? .prayed : .late
    }

    /// The mutabaah entry for a log row; nil when it is not a fardh or its date is malformed.
    static func entry(for log: PrayerLogEntry) -> SyncEntry? {
        guard let fardh = Fardh(logName: log.prayer), isDayKey(log.date) else { return nil }
        return SyncEntry(
            date: log.date,
            itemId: fardh.rawValue,
            value: value(for: log.status),
            updatedAt: millis(log.loggedAt)
        )
    }

    /// The log edit that makes the local log match a pulled entry; nil for non-fardh items.
    static func change(for entry: SyncEntry) -> PrayerLogChange? {
        guard let fardh = Fardh(rawValue: entry.itemId), isDayKey(entry.date) else { return nil }
        return PrayerLogChange(
            date: entry.date,
            prayer: fardh.logName,
            status: status(forValue: entry.value),
            at: date(fromMillis: entry.updatedAt)
        )
    }
}

/// Moves the Mac prayer log into the account replica.
enum LogSync {
    /// Writes one local log edit into the replica. Skipped when the replica already holds an
    /// equivalent state, so the phone's extra flags (jamaah, qadha) survive a re-save on the Mac.
    @discardableResult
    static func record(_ change: PrayerLogChange, in replica: MutabaahReplica) -> Bool {
        guard let fardh = Fardh(logName: change.prayer), FardhMapping.isDayKey(change.date) else { return false }
        let wanted = change.status.map(FardhMapping.value(for:)) ?? 0
        if let current = replica.entryValue(date: change.date, itemId: fardh.rawValue),
           FardhMapping.status(forValue: current) == FardhMapping.status(forValue: wanted) {
            return false
        }
        return replica.recordLocalEntry(
            date: change.date, itemId: fardh.rawValue, value: wanted, at: FardhMapping.millis(change.at))
    }

    /// Brings log rows the replica has not seen yet into it: everything logged before the first
    /// sign-in, and edits made while the app could not record them. Rows the replica already has
    /// at a newer timestamp are left alone. Returns how many entries were queued for upload.
    ///
    /// `cleared` holds the prayers the user cleared on this Mac, with the time of the clear. A clear
    /// made while signed out never reached the replica; when the log has no entry for it any more
    /// and the replica still has the prayer done, a 0 is recorded at the time of the clear. Rows
    /// missing from the log without such a mark are left alone: they may be rows a pull stored
    /// that the app was closed before applying to the log.
    @discardableResult
    static func reconcile(
        log: [PrayerLogEntry],
        cleared: [String: Date] = [:],
        into replica: MutabaahReplica
    ) -> Int {
        var queued = 0
        var logged = Set<String>()
        for row in log { logged.insert(FardhMapping.clearKey(date: row.date, prayer: row.prayer)) }
        for (key, at) in cleared.sorted(by: { $0.key < $1.key }) where !logged.contains(key) {
            let parts = key.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2, let fardh = Fardh(logName: String(parts[1])), FardhMapping.isDayKey(String(parts[0])),
                  let current = replica.entryValue(date: String(parts[0]), itemId: fardh.rawValue), current != 0
            else { continue }
            if replica.recordLocalEntry(date: String(parts[0]), itemId: fardh.rawValue, value: 0, at: FardhMapping.millis(at)) {
                queued += 1
            }
        }
        for row in log {
            guard let entry = FardhMapping.entry(for: row) else { continue }
            if let current = replica.entry(date: entry.date, itemId: entry.itemId) {
                guard entry.updatedAt > current.updatedAt,
                      FardhMapping.status(forValue: current.value) != FardhMapping.status(forValue: entry.value)
                else { continue }
            }
            if replica.recordLocalEntry(date: entry.date, itemId: entry.itemId, value: entry.value, at: entry.updatedAt) {
                queued += 1
            }
        }
        return queued
    }
}
