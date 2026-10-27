//
//  IbadahReader.swift
//  waqtu
//
//  The counters of the adhkar readers, a port of apps/mobile/src/ibadah/reader.ts and suggest.ts:
//  one tap counts one recitation down, progress per session, morning or evening from the part of
//  the day, and the mutabaah item a finished session ticks (`dzikir_pagi` / `dzikir_petang`, the
//  same ids as the phone). Pure; no UI.
//

import Foundation

/// How many times each item (by key) has been recited in this sitting. Missing keys are 0.
typealias ReaderCounts = [String: Int]

/// Part of the day from the prayer times, as in apps/mobile/src/prayer/period.ts.
enum DayPeriod: String, Equatable {
    case fajr, sunrise, dhuhr, asr, maghrib, isha
}

struct ReaderProgress: Equatable {
    /// Recitations done, counting each repetition.
    let done: Int
    let total: Int
    let itemsDone: Int
    let itemsTotal: Int
    /// done / total, 0 to 1.
    let fraction: Double
    let complete: Bool
}

enum IbadahReader {
    static func doneCount(_ counts: ReaderCounts, _ item: ReaderItem) -> Int {
        min(max(0, counts[item.key] ?? 0), item.repeatCount)
    }

    /// What is left of an item: the number on its counter, counting down to 0.
    static func remaining(_ counts: ReaderCounts, _ item: ReaderItem) -> Int {
        item.repeatCount - doneCount(counts, item)
    }

    static func isItemDone(_ counts: ReaderCounts, _ item: ReaderItem) -> Bool {
        remaining(counts, item) == 0
    }

    /// One tap on an item's counter: one recitation done. A finished item stays finished.
    static func tap(_ counts: ReaderCounts, _ item: ReaderItem) -> ReaderCounts {
        if isItemDone(counts, item) { return counts }
        var next = counts
        next[item.key] = doneCount(counts, item) + 1
        return next
    }

    /// Puts an item's counter back to its full count.
    static func reset(_ counts: ReaderCounts, _ item: ReaderItem) -> ReaderCounts {
        if counts[item.key] == nil { return counts }
        var next = counts
        next.removeValue(forKey: item.key)
        return next
    }

    static func progress(_ session: ReaderSession, _ counts: ReaderCounts) -> ReaderProgress {
        var done = 0
        var total = 0
        var itemsDone = 0
        for item in session.items {
            done += doneCount(counts, item)
            total += item.repeatCount
            if isItemDone(counts, item) { itemsDone += 1 }
        }
        return ReaderProgress(
            done: done,
            total: total,
            itemsDone: itemsDone,
            itemsTotal: session.items.count,
            fraction: total > 0 ? Double(done) / Double(total) : 0,
            complete: total > 0 && done == total)
    }

    /// Index of the first unfinished item after `from` (wrapping round), or nil when all are finished.
    static func nextOpenItem(_ session: ReaderSession, _ counts: ReaderCounts, from: Int) -> Int? {
        let n = session.items.count
        guard n > 0 else { return nil }
        for step in 1...n {
            let index = (from + step) % n
            if !isItemDone(counts, session.items[index]) { return index }
        }
        return nil
    }

    // MARK: - Stored progress (this Mac only)

    /// The key the progress of one session is kept under (device-local, never synced).
    static func progressKey(_ id: ReaderSessionID) -> String {
        "ibadah.progress.\(id.rawValue)"
    }

    /// Stored progress → today's counts. Progress from another day, or anything malformed, starts afresh.
    static func parseProgress(_ raw: String?, today: String) -> ReaderCounts {
        guard let raw, let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["day"] as? String == today,
              let stored = object["counts"] as? [String: Any] else { return [:] }
        var counts: ReaderCounts = [:]
        for (key, value) in stored {
            guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { continue }
            let d = n.doubleValue
            if d.isFinite, d == d.rounded(), d > 0, d < 1e9 { counts[key] = n.intValue }
        }
        return counts
    }

    static func serializeProgress(_ counts: ReaderCounts, today: String) -> String {
        let object: [String: Any] = ["day": today, "counts": counts]
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8) else { return "" }
        return string
    }

    // MARK: - Morning or evening

    /// Morning or evening, from the part of the day: from Subuh until Asr the morning adhkar, from
    /// Asr through the night the evening ones.
    static func suggestedTime(_ period: DayPeriod) -> ReaderTime {
        switch period {
        case .fajr, .sunrise, .dhuhr: return .pagi
        case .asr, .maghrib, .isha: return .petang
        }
    }

    /// A rough part of the day from the clock, for when there are no prayer times.
    static func periodForHour(_ hour: Int) -> DayPeriod {
        if hour < 4 { return .isha }
        if hour < 6 { return .fajr }
        if hour < 11 { return .sunrise }
        if hour < 15 { return .dhuhr }
        if hour < 18 { return .asr }
        if hour < 19 { return .maghrib }
        return .isha
    }

    /// Morning or evening adhkar for `now`: by today's prayer times (`marks`: when each part of the
    /// day began) when there are some, else by the clock. Before today's Fajr it is still the night
    /// (Isha to the next Fajr), so evening.
    static func suggestTime(
        marks: [(period: DayPeriod, at: Date)], now: Date, calendar: Calendar = .current
    ) -> ReaderTime {
        guard !marks.isEmpty else {
            return suggestedTime(periodForHour(calendar.component(.hour, from: now)))
        }
        let current = marks.filter { $0.at <= now }.max { $0.at < $1.at }
        return suggestedTime(current?.period ?? .isha)
    }

    /// The mutabaah checklist item a finished morning or evening session can tick.
    static func mutabaahItem(for time: ReaderTime) -> String {
        time == .pagi ? "dzikir_pagi" : "dzikir_petang"
    }
}
