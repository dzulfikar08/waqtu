//
//  Muhasabah.swift
//  waqtu
//
//  The muhasabah journal, a port of apps/mobile/src/ibadah/muhasabah.ts: a daily self-reflection
//  (two open questions, four 1–10 ratings, an intention for tomorrow). Local to this Mac: one JSON
//  file in Application Support, never written to the sync replica. It reaches a server only when
//  the user turns on "Sync muhasabah to the cloud" (MuhasabahCloud.swift). Day keys are
//  `YYYY-MM-DD` like the rest of the app. Main-thread use only.
//

import Foundation

enum MuhasabahAspect: String, CaseIterable, Equatable {
    case taqwa, gratitude, energy, willingness
}

enum MuhasabahTextField: String, CaseIterable, Equatable {
    case feelings, newAction, continueTomorrow
}

/// One of the seven questions, in the order the Mutabaah app asks them.
enum MuhasabahQuestion: Equatable {
    case text(MuhasabahTextField)
    case rating(MuhasabahAspect)
}

struct MuhasabahEntry: Codable, Equatable {
    var date: String
    var feelings: String?
    var newAction: String?
    var taqwa: Int?
    var gratitude: Int?
    var energy: Int?
    var willingness: Int?
    var continueTomorrow: String?

    init(date: String) {
        self.date = date
    }

    func text(_ field: MuhasabahTextField) -> String? {
        switch field {
        case .feelings: return feelings
        case .newAction: return newAction
        case .continueTomorrow: return continueTomorrow
        }
    }

    func rating(_ aspect: MuhasabahAspect) -> Int? {
        switch aspect {
        case .taqwa: return taqwa
        case .gratitude: return gratitude
        case .energy: return energy
        case .willingness: return willingness
        }
    }

    mutating func set(_ field: MuhasabahTextField, _ value: String?) {
        switch field {
        case .feelings: feelings = value
        case .newAction: newAction = value
        case .continueTomorrow: continueTomorrow = value
        }
    }

    mutating func set(_ aspect: MuhasabahAspect, _ value: Int?) {
        switch aspect {
        case .taqwa: taqwa = value
        case .gratitude: gratitude = value
        case .energy: energy = value
        case .willingness: willingness = value
        }
    }
}

struct MuhasabahTrendDay: Equatable {
    let date: String
    /// Mean rating of the day, nil for a day without ratings.
    let average: Double?
}

struct MuhasabahTrendSummary: Equatable {
    /// Days in the window with an entry.
    let daysWritten: Int
    /// Mean of the daily means, nil without ratings.
    let average: Double?
    /// Mean per aspect over the window.
    let aspects: [MuhasabahAspect: Double]
    /// Mean of the later half minus the earlier half; nil unless both halves have ratings.
    let change: Double?
}

enum Muhasabah {
    static let ratingMin = 1
    static let ratingMax = 10
    static let maxText = 4000

    static let questions: [MuhasabahQuestion] = [
        .text(.feelings), .text(.newAction),
        .rating(.taqwa), .rating(.gratitude), .rating(.energy), .rating(.willingness),
        .text(.continueTomorrow),
    ]

    /// Emoji per rating 1–10 and aspect, from the Mutabaah app's rating scales.
    static func emoji(_ aspect: MuhasabahAspect) -> [String] {
        switch aspect {
        case .taqwa: return ["😔", "😞", "😐", "🙂", "😊", "😌", "🤲", "✨", "🌟", "💫"]
        case .gratitude: return ["😞", "😐", "🙂", "😊", "😌", "🙏", "🤲", "✨", "🌟", "💫"]
        case .energy: return ["😴", "😪", "😑", "😐", "🙂", "😊", "😄", "😃", "⚡", "🔥"]
        case .willingness: return ["😔", "😞", "😐", "🤔", "🙂", "😊", "😄", "😃", "🔥", "💪"]
        }
    }

    // MARK: - Answers

    /// A rating within 1–10, or nil.
    static func cleanRating(_ value: Int?) -> Int? {
        guard let value, value >= ratingMin, value <= ratingMax else { return nil }
        return value
    }

    /// Trimmed text, capped; blank is nil.
    static func cleanText(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : String(trimmed.prefix(maxText))
    }

    static func clean(_ entry: MuhasabahEntry) -> MuhasabahEntry {
        var out = MuhasabahEntry(date: entry.date)
        for field in MuhasabahTextField.allCases { out.set(field, cleanText(entry.text(field))) }
        for aspect in MuhasabahAspect.allCases { out.set(aspect, cleanRating(entry.rating(aspect))) }
        return out
    }

    static func hasContent(_ entry: MuhasabahEntry) -> Bool {
        MuhasabahTextField.allCases.contains { cleanText(entry.text($0)) != nil }
            || MuhasabahAspect.allCases.contains { cleanRating(entry.rating($0)) != nil }
    }

    /// How many of the seven questions are answered, 0 to 1.
    static func completion(_ entry: MuhasabahEntry) -> Double {
        let answered = MuhasabahTextField.allCases.filter { cleanText(entry.text($0)) != nil }.count
            + MuhasabahAspect.allCases.filter { cleanRating(entry.rating($0)) != nil }.count
        return Double(answered) / Double(questions.count)
    }

    /// Mean of the ratings given, or nil when none is.
    static func averageRating(_ entry: MuhasabahEntry) -> Double? {
        let ratings = MuhasabahAspect.allCases.compactMap { cleanRating(entry.rating($0)) }
        return mean(ratings.map(Double.init))
    }

    private static func mean(_ values: [Double]) -> Double? {
        values.isEmpty ? nil : values.reduce(0, +) / Double(values.count)
    }

    // MARK: - Calendar

    /// The weeks of a calendar month, Monday first: each week is seven cells, a day key or nil for
    /// the padding before the 1st and after the last day. `month` is 1–12.
    static func monthWeeks(year: Int, month: Int) -> [[String?]] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let first = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let days = calendar.range(of: .day, in: .month, for: first)?.count else { return [] }
        // Calendar weekdays: 1 Sunday ... 7 Saturday; Monday first.
        let lead = (calendar.component(.weekday, from: first) + 5) % 7
        var cells: [String?] = Array(repeating: nil, count: lead)
        for d in 1...days {
            cells.append(String(format: "%04d-%02d-%02d", year, month, d))
        }
        while cells.count % 7 != 0 { cells.append(nil) }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<$0 + 7]) }
    }

    /// The month `delta` months after `year`/`month` (1–12).
    static func shiftMonth(year: Int, month: Int, delta: Int) -> (year: Int, month: Int) {
        let index = year * 12 + (month - 1) + delta
        let y = index >= 0 ? index / 12 : -((-index + 11) / 12)
        return (y, index - y * 12 + 1)
    }

    // MARK: - Trends

    /// The `count` days ending `end`, oldest first.
    static func lastDays(_ end: String, _ count: Int) -> [String] {
        (0..<count).map { DayKeys.addDays(end, $0 - (count - 1)) }
    }

    /// The `days` days ending `today`, oldest first, each with its mean rating.
    static func ratingTrend(_ entries: [MuhasabahEntry], today: String, days: Int) -> [MuhasabahTrendDay] {
        var byDate: [String: MuhasabahEntry] = [:]
        for entry in entries { byDate[entry.date] = entry }
        return lastDays(today, days).map { date in
            MuhasabahTrendDay(date: date, average: byDate[date].flatMap { averageRating($0) })
        }
    }

    static func summarizeTrend(_ entries: [MuhasabahEntry], today: String, days: Int) -> MuhasabahTrendSummary {
        let window = Set(lastDays(today, days))
        let inWindow = entries.filter { window.contains($0.date) && hasContent($0) }
        let averages = ratingTrend(inWindow, today: today, days: days).map(\.average)
        let half = days / 2
        let earlier = mean(averages.prefix(half).compactMap { $0 })
        let later = mean(averages.dropFirst(half).compactMap { $0 })
        var aspects: [MuhasabahAspect: Double] = [:]
        for aspect in MuhasabahAspect.allCases {
            if let m = mean(inWindow.compactMap { cleanRating($0.rating(aspect)) }.map(Double.init)) {
                aspects[aspect] = m
            }
        }
        var change: Double?
        if let earlier, let later { change = later - earlier }
        return MuhasabahTrendSummary(
            daysWritten: inWindow.count,
            average: mean(averages.compactMap { $0 }),
            aspects: aspects,
            change: change)
    }
}

/// The journal's file. One record per day; a day with nothing in it is deleted, not stored blank.
/// A deleted day stays in the file as a record without an entry (a tombstone), so that turning on
/// cloud sync carries the deletion to the other devices too. `dirty` marks what the cloud copy has
/// not seen yet. The store never talks to a server: MuhasabahCloud.swift does, and only for a user
/// who turned "Sync muhasabah to the cloud" on.
final class MuhasabahStore {
    private struct Record: Codable, Equatable {
        /// nil: the day was deleted.
        var entry: MuhasabahEntry?
        var createdAt: Int64
        var updatedAt: Int64
        /// Nil in files from before cloud sync existed: those days were never uploaded.
        var dirty: Bool?

        var isDirty: Bool { dirty ?? true }
    }

    private var records: [String: Record]
    private let fileURL: URL?

    /// `fileURL == nil` keeps everything in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: Record].self, from: data) {
            records = decoded
        } else {
            records = [:]
        }
    }

    /// `~/Library/Application Support/<bundle id>/muhasabah.json`.
    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("muhasabah.json")
    }

    func entry(_ date: String) -> MuhasabahEntry? { records[date]?.entry }

    /// Entries for the days in `[from, to]` (day keys sort as text), oldest first.
    func entries(from: String, to: String) -> [MuhasabahEntry] {
        records.values.compactMap(\.entry).filter { $0.date >= from && $0.date <= to }.sorted { $0.date < $1.date }
    }

    /// Every day written (deleted days are not), newest first.
    var allDates: [String] {
        records.filter { $0.value.entry != nil }.keys.sorted(by: >)
    }

    /// Saves a day's reflection (cleaned); an entry with nothing in it deletes the day instead.
    /// Returns what was kept. An update keeps the first creation time.
    @discardableResult
    func save(_ entry: MuhasabahEntry, now: Int64) -> MuhasabahEntry? {
        let cleaned = Muhasabah.clean(entry)
        guard Muhasabah.hasContent(cleaned) else {
            delete(entry.date, now: now)
            return nil
        }
        let created = records[cleaned.date]?.createdAt ?? now
        records[cleaned.date] = Record(entry: cleaned, createdAt: created, updatedAt: now, dirty: true)
        commit()
        return cleaned
    }

    func delete(_ date: String, now: Int64) {
        guard let record = records[date], record.entry != nil else { return }
        records[date] = Record(entry: nil, createdAt: record.createdAt, updatedAt: now, dirty: true)
        commit()
    }

    // MARK: - Cloud copy (used only while the user has cloud sync on)

    /// Days the cloud copy has not seen yet, oldest edit first; deleted days carry no entry.
    func dirtyWires() -> [MuhasabahWire] {
        var out: [MuhasabahWire] = []
        for (date, record) in records where record.isDirty {
            var body: MuhasabahWireEntry?
            if let entry = record.entry { body = MuhasabahWireEntry(entry) }
            out.append(MuhasabahWire(date: date, updatedAt: record.updatedAt, entry: body))
        }
        out.sort { left, right in
            if left.updatedAt != right.updatedAt { return left.updatedAt < right.updatedAt }
            return left.date < right.date
        }
        return out
    }

    /// Clears the dirty flag only for days still at the pushed `updatedAt`, so an edit made while
    /// the push was in flight stays queued.
    func markClean(_ wires: [MuhasabahWire]) {
        var changed = false
        for wire in wires {
            guard var record = records[wire.date], record.updatedAt == wire.updatedAt, record.isDirty else { continue }
            record.dirty = false
            records[wire.date] = record
            changed = true
        }
        if changed { commit() }
    }

    /// Queues every day for upload (cloud sync was just turned on, so the whole journal goes up).
    func markAllDirty() {
        var changed = false
        for date in Array(records.keys) {
            guard var record = records[date], !record.isDirty else { continue }
            record.dirty = true
            records[date] = record
            changed = true
        }
        if changed { commit() }
    }

    /// Merges a page of the cloud copy, last write wins per day: a day replaces ours only when its
    /// edit is strictly newer, an equal timestamp keeps the local day. What it stores is clean.
    /// Returns the days that changed here.
    @discardableResult
    func merge(remote wires: [MuhasabahWire]) -> [String] {
        var changed: [String] = []
        for wire in wires {
            let current = records[wire.date]
            if let current, current.updatedAt >= wire.updatedAt { continue }
            var kept: MuhasabahEntry?
            if let body = wire.entry {
                let cleaned = Muhasabah.clean(body.entry(date: wire.date))
                if Muhasabah.hasContent(cleaned) { kept = cleaned }
            }
            records[wire.date] = Record(
                entry: kept, createdAt: current?.createdAt ?? wire.updatedAt, updatedAt: wire.updatedAt, dirty: false)
            changed.append(wire.date)
        }
        if !changed.isEmpty { commit() }
        return changed
    }

    private func commit() {
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(records).write(to: fileURL, options: .atomic)
        } catch {
            // Keep working in memory; the next change tries again.
        }
    }
}
