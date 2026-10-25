//
//  MutabaahStreakModel.swift
//  waqtu
//
//  The streak the Mac shows, computed from the synced replica exactly as the phone computes it
//  (apps/mobile/src/db/model.ts: entries recorded in the last 730 days, the `items` list, the
//  `streak` setting, MutabaahStreak rules with grace days and pauses), so both devices show the
//  same number. Also the 7-day strip for the menu bar and the widgets.
//

import Foundation

enum MutabaahStreakModel {
    /// How far back the streak looks; the phone's `STREAK_HISTORY_DAYS`.
    static let historyDays = 730

    static func config(in replica: MutabaahReplica) -> StreakConfig {
        MutabaahStreak.parseStreakConfig(replica.settingValue(MutabaahSettingKey.streak))
    }

    /// Stores edited streak settings (grace, minimum, pauses) in the phone's JSON. False when unchanged.
    @discardableResult
    static func setConfig(_ config: StreakConfig, in replica: MutabaahReplica, at: Int64) -> Bool {
        replica.recordLocalSetting(
            key: MutabaahSettingKey.streak, value: MutabaahStreak.serializeStreakConfig(config), at: at)
    }

    /// Entries with a value above 0 on or after `from` (the phone's `getRecordedSince`).
    static func recorded(since from: String, in replica: MutabaahReplica) -> [MutabaahEntryValue] {
        replica.state.entries.compactMap { key, row -> MutabaahEntryValue? in
            guard let sep = key.firstIndex(of: "|"), let value = Int(row.value), value > 0 else { return nil }
            let date = String(key[key.startIndex..<sep])
            guard date >= from else { return nil }
            return MutabaahEntryValue(date: date, itemId: String(key[key.index(after: sep)...]), value: value)
        }
    }

    static func streak(today: String, in replica: MutabaahReplica) -> StreakResult {
        let config = config(in: replica)
        let recorded = recorded(since: DayKeys.addDays(today, -historyDays), in: replica)
        let counted = MutabaahStreak.countedDays(
            recorded, items: MutabaahChecklist.items(in: replica), minDone: config.minDone)
        return MutabaahStreak.computeStreak(counted, today: today, config: config)
    }

    struct Day: Equatable {
        let date: String
        /// Enough items recorded for the day to count toward the streak.
        let counted: Bool
        /// Items of the list done that day.
        let done: Int
        /// Fardhu marked done that day (0...5), whatever the list holds.
        let fardhDone: Int
        let paused: Bool
        let isToday: Bool
    }

    /// The 7 days ending today, oldest first.
    static func week(today: String, in replica: MutabaahReplica) -> [Day] {
        let items = MutabaahChecklist.items(in: replica)
        let config = config(in: replica)
        let from = DayKeys.addDays(today, -6)
        let recorded = recorded(since: from, in: replica).filter { $0.date <= today }
        let counted = MutabaahStreak.countedDays(recorded, items: items, minDone: config.minDone)
        return (0..<7).map { i in
            let date = DayKeys.addDays(from, i)
            return Day(
                date: date,
                counted: counted.contains(date),
                done: MutabaahChecklist.doneCount(items: items, date: date, in: replica),
                fardhDone: Fardh.allCases.filter {
                    MutabaahItems.isDone(.fardh, replica.entryValue(date: date, itemId: $0.rawValue) ?? 0)
                }.count,
                paused: MutabaahStreak.isPaused(date, config.pauses),
                isToday: date == today
            )
        }
    }

    /// English short weekday of a day key ("Mon"), as the shared streak summary labels its dots.
    static func englishWeekday(_ day: String) -> String {
        // 1970-01-01 was a Thursday.
        let names = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"]
        let n = DayKeys.diffDays(day, "1970-01-01") % 7
        return names[(n + 7) % 7]
    }
}
