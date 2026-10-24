//
//  PrayerStreakManager.swift
//  waqtu
//
//  Prayer habit tracking: prayed/missed per prayer, daily/weekly/monthly streaks.
//  Stored in UserDefaults as a simple JSON dictionary.
//

import Foundation

// `PrayerLogEntry` and `PrayerLogChange` live in waqtu-sync/PrayerLog.swift (shared with the sync tests).

@Observable
final class PrayerStreakManager {
    private let defaults = UserDefaults.standard
    private let logKey = "prayerLogEntries"

    private(set) var entries: [PrayerLogEntry] = []

    /// Called after every edit made on this Mac (not for pulled changes), so it can reach the account.
    @ObservationIgnored var onLocalChange: ((PrayerLogChange) -> Void)?

    init() {
        load()
    }

    // MARK: - Logging

    func logPrayer(prayer: String, status: PrayerLogEntry.Status, date: Date = Date()) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

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
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)
        let before = entries.count
        entries.removeAll { $0.date == dateString && $0.prayer == prayer }
        guard entries.count != before else { return }
        save()
        onLocalChange?(PrayerLogChange(date: dateString, prayer: prayer, status: nil, at: Date()))
    }

    /// Applies a change pulled from the account: stored as-is, without `onLocalChange`.
    func applyRemote(_ change: PrayerLogChange) {
        entries.removeAll { $0.date == change.date && $0.prayer == change.prayer }
        if let status = change.status {
            entries.append(PrayerLogEntry(date: change.date, prayer: change.prayer, status: status, loggedAt: change.at))
        }
        save()
    }

    // MARK: - Queries

    /// Get today's log entries.
    var todayEntries: [PrayerLogEntry] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())
        return entries.filter { $0.date == today }
    }

    /// How many prayers were prayed today.
    var todayPrayedCount: Int {
        todayEntries.filter { $0.status == .prayed || $0.status == .late }.count
    }

    /// Current streak: consecutive days where all 5 prayers were prayed.
    var currentStreak: Int {
        calculateStreak(endingAt: Date())
    }

    /// Best streak ever recorded.
    var bestStreak: Int {
        let allDates = uniqueDates()
        var best = 0
        for date in allDates {
            let streak = calculateStreak(endingAt: date)
            best = max(best, streak)
        }
        return best
    }

    /// Weekly stats: prayers prayed this week (Mon–Sun).
    var weeklyStats: (prayed: Int, missed: Int, total: Int) {
        let calendar = Calendar.current
        guard let weekStart = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) else {
            return (0, 0, 0)
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        var prayed = 0, missed = 0
        let today = Date()
        var current = weekStart
        while current <= today {
            let dateStr = formatter.string(from: current)
            let dayEntries = entries.filter { $0.date == dateStr }
            prayed += dayEntries.filter { $0.status == .prayed || $0.status == .late }.count
            missed += dayEntries.filter { $0.status == .missed }.count
            current = calendar.date(byAdding: .day, value: 1, to: current) ?? today
        }
        let totalDays = max(1, calendar.dateComponents([.day], from: weekStart, to: today).day ?? 0 + 1)
        return (prayed, missed, totalDays * 5)
    }

    /// Monthly stats for the given month.
    func monthlyStats(for date: Date = Date()) -> (prayed: Int, missed: Int, completionRate: Double) {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: date)
        guard let monthStart = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: monthStart) else {
            return (0, 0, 0)
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        var prayed = 0, missed = 0
        for day in 1...range.count {
            guard let dayDate = calendar.date(byAdding: .day, value: day - 1, to: monthStart),
                  dayDate <= Date() else { break }
            let dateStr = formatter.string(from: dayDate)
            let dayEntries = entries.filter { $0.date == dateStr }
            prayed += dayEntries.filter { $0.status == .prayed || $0.status == .late }.count
            missed += dayEntries.filter { $0.status == .missed }.count
        }

        let total = prayed + missed
        let rate = total > 0 ? Double(prayed) / Double(total) * 100 : 0
        return (prayed, missed, rate)
    }

    /// Has the user logged this prayer today?
    func hasLogged(prayer: String, date: Date = Date()) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        return entries.contains { $0.date == dateStr && $0.prayer == prayer }
    }

    /// Get status for a specific prayer today.
    func statusFor(prayer: String, date: Date = Date()) -> PrayerLogEntry.Status? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        return entries.first { $0.date == dateStr && $0.prayer == prayer }?.status
    }

    // MARK: - Private

    private func uniqueDates() -> [Date] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        var seen = Set<String>()
        return entries.compactMap { entry -> Date? in
            guard seen.insert(entry.date).inserted else { return nil }
            return formatter.date(from: entry.date)
        }.sorted(by: >)
    }

    private func calculateStreak(endingAt endDate: Date) -> Int {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        var streak = 0
        var current = calendar.startOfDay(for: endDate)

        while true {
            let dateStr = formatter.string(from: current)
            let dayEntries = entries.filter { $0.date == dateStr }
            let prayedCount = dayEntries.filter { $0.status == .prayed || $0.status == .late }.count

            // A day counts if all 5 prayers were prayed
            guard prayedCount >= 5 else { break }

            streak += 1
            guard let previous = calendar.date(byAdding: .day, value: -1, to: current) else { break }
            current = previous
        }

        return streak
    }

    private func load() {
        guard let data = defaults.data(forKey: logKey),
              let decoded = try? JSONDecoder().decode([PrayerLogEntry].self, from: data) else {
            entries = []
            return
        }
        entries = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        defaults.set(data, forKey: logKey)
    }

    /// A compact grid of the last 7 days for the streak report.
    /// Returns an array of (dayLabel, statusIcon, isToday) tuples.
    var weeklyGrid: [(label: String, status: String, isToday: Bool)] {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let today = Date()
        let todayStr = formatter.string(from: today)
        let dayNamesFormatter = DateFormatter()
        dayNamesFormatter.dateFormat = "E"

        return (0..<7).compactMap { offset -> (String, String, Bool)? in
            guard let date = calendar.date(byAdding: .day, value: -(6 - offset), to: today) else { return nil }
            let dateStr = formatter.string(from: date)
            let dayEntries = entries.filter { $0.date == dateStr }
            let prayed = dayEntries.filter { $0.status == .prayed || $0.status == .late }.count
            let isToday = dateStr == todayStr

            let status: String
            if dayEntries.isEmpty {
                status = isToday ? " " : "·"
            } else if prayed >= 5 {
                status = "●"
            } else if prayed > 0 {
                status = "◐"
            } else {
                status = "○"
            }

            let weekday = Calendar.current.component(.weekday, from: date)
            let label = dayNames[weekday - 1]
            return (label, status, isToday)
        }
    }

    /// Remove all log data.
    func resetAll() {
        entries = []
        defaults.removeObject(forKey: logKey)
    }
}
