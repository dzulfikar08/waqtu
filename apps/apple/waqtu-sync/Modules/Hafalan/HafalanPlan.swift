//
//  HafalanPlan.swift
//  waqtu
//
//  Memorisation plan on the Mac (packages/core/src/hafalan.ts: targets, half-page units, plan
//  validation). The phone keeps its hafalan plan on the device and does not sync it (only the
//  `murojaah` mutabaah entry syncs, apps/mobile/src/hafalan/migrations.ts), so the Mac keeps its own
//  local plan in one JSON file. This first version is read-only practice: no grading, so it writes
//  no mutabaah entry.
//

import Foundation

struct HafalanTarget: Codable, Equatable {
    enum Kind: String, Codable, CaseIterable {
        case surah, juz, pages
    }

    var kind: Kind
    var from: Int
    var to: Int

    private var upperBound: Int {
        switch kind {
        case .surah: return Quran.totalSurahs
        case .juz: return Quran.totalJuz
        case .pages: return Quran.totalPages
        }
    }

    var isValid: Bool { from >= 1 && to <= upperBound && from <= to }

    /// Ayah indexes the target covers; nil for an invalid target.
    var range: AyahRange? {
        guard isValid else { return nil }
        switch kind {
        case .surah: return AyahRange(start: Quran.surahRange(from).start, end: Quran.surahRange(to).end)
        case .juz: return AyahRange(start: Quran.juzRange(from).start, end: Quran.juzRange(to).end)
        case .pages: return AyahRange(start: Quran.pageRange(from).start, end: Quran.pageRange(to).end)
        }
    }
}

/// The unit of memorising: about half a mushaf page, cut between ayahs.
struct HafalanUnit: Equatable {
    /// Position in the plan, 0-based; also the order units are memorised in.
    let index: Int
    /// Global ayah indexes, inclusive.
    let start: Int
    let end: Int
    /// Mushaf page (1..604) the unit lies on.
    let page: Int
    let words: Int

    var range: AyahRange { AyahRange(start: start, end: end) }

    /// A page part with at least this many words is cut in two. Smaller ones stay whole.
    static let splitMinWords = 40

    /// Cuts `range` into units: each mushaf page (clipped to the range) becomes one unit, or two
    /// halves cut at the ayah boundary closest to half of the page's words (core `buildUnits`).
    static func build(_ range: AyahRange, wordCounts: [Int]) -> [HafalanUnit] {
        var parts: [(start: Int, end: Int, page: Int, words: Int)] = []
        func unit(_ start: Int, _ end: Int, _ page: Int) -> (start: Int, end: Int, page: Int, words: Int) {
            (start, end, page, (start...end).reduce(0) { $0 + wordCounts[$1] })
        }
        for page in Quran.page(ofIndex: range.start)...Quran.page(ofIndex: range.end) {
            let p = Quran.pageRange(page)
            let start = Swift.max(p.start, range.start)
            let end = Swift.min(p.end, range.end)
            if end < start { continue }
            let whole = unit(start, end, page)
            if end == start || whole.words < splitMinWords {
                parts.append(whole)
                continue
            }
            var best = start + 1
            var bestGap = Double.infinity
            var before = wordCounts[start]
            for k in (start + 1)...end {
                let gap = abs(Double(before) - Double(whole.words) / 2)
                if gap < bestGap {
                    best = k
                    bestGap = gap
                }
                before += wordCounts[k]
            }
            parts.append(unit(start, best - 1, page))
            parts.append(unit(best, end, page))
        }
        return parts.enumerated().map { i, u in
            HafalanUnit(index: i, start: u.start, end: u.end, page: u.page, words: u.words)
        }
    }
}

struct HafalanPlan: Codable, Equatable {
    enum Problem: Equatable {
        case target, day, deadline
    }

    var target: HafalanTarget
    /// Civil days as `YYYY-MM-DD`.
    var startDay: String
    var deadline: String

    /// Why the plan cannot be made, or nil when it can. The deadline may be the start day itself.
    var problem: Problem? {
        if !target.isValid { return .target }
        guard let start = Self.day(startDay), let end = Self.day(deadline) else { return .day }
        if end < start { return .deadline }
        return nil
    }

    /// Days from start to deadline, counting both ends.
    var totalDays: Int {
        guard let start = Self.day(startDay), let end = Self.day(deadline) else { return 1 }
        return Swift.max(1, Self.days(from: start, to: end) + 1)
    }

    /// New units per day to finish on time (the phone's plan preview).
    func perDay(unitCount: Int) -> Int {
        Int((Double(unitCount) / Double(totalDays)).rounded(.up))
    }

    private static func day(_ key: String) -> CivilDay? {
        let parts = key.split(separator: "-")
        guard key.count == 10, parts.count == 3,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        let day = CivilDay(year: y, month: m, day: d)
        return day.adding(days: 0) == day ? day : nil
    }

    private static func days(from a: CivilDay, to b: CivilDay) -> Int {
        Int((b.noonUTC.timeIntervalSince(a.noonUTC) / 86_400).rounded())
    }
}

/// The Mac's own plan, in `~/Library/Application Support/<bundle id>/hafalan.json`.
final class HafalanPlanStore {
    private(set) var plan: HafalanPlan?
    private let fileURL: URL?

    /// `fileURL == nil` keeps the plan in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL) {
            plan = try? JSONDecoder().decode(HafalanPlan.self, from: data)
        }
    }

    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("hafalan.json")
    }

    /// Stores a valid plan, replacing the current one. Returns false for an invalid plan.
    @discardableResult
    func save(_ next: HafalanPlan) -> Bool {
        guard next.problem == nil else { return false }
        plan = next
        guard let fileURL else { return true }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(next).write(to: fileURL, options: .atomic)
        } catch {
            // Kept in memory; the next save retries.
        }
        return true
    }

    func delete() {
        plan = nil
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
    }
}
