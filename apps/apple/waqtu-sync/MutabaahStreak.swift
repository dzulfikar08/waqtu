//
//  MutabaahStreak.swift
//  waqtu
//
//  Mutabaah streak with grace days and pauses, a port of apps/mobile/src/mutabaah/streak.ts
//  and the day-key helpers of apps/mobile/src/mutabaah/dates.ts. The `streak` setting is stored
//  as the same JSON the phone writes.
//

import Foundation

/// `YYYY-MM-DD` civil day keys. Pure proleptic Gregorian arithmetic, no time zone involved.
enum DayKeys {
    private static func civil(_ key: String) -> (year: Int, month: Int, day: Int)? {
        let u = Array(key.utf8)
        guard u.count == 10, u[4] == 0x2D, u[7] == 0x2D else { return nil }
        func digits(_ r: Range<Int>) -> Int? {
            var v = 0
            for i in r {
                guard (0x30...0x39).contains(u[i]) else { return nil }
                v = v * 10 + Int(u[i] - 0x30)
            }
            return v
        }
        guard let y = digits(0..<4), let m = digits(5..<7), let d = digits(8..<10) else { return nil }
        return (y, m, d)
    }

    /// Days since 1970-01-01 (Howard Hinnant's days_from_civil).
    private static func ordinal(year: Int, month: Int, day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    private static func format(_ days: Int) -> String {
        let z = days + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        let y = yoe + era * 400 + (m <= 2 ? 1 : 0)
        return String(format: "%04d-%02d-%02d", y, m, d)
    }

    private static func ordinal(_ key: String) -> Int {
        guard let c = civil(key) else { preconditionFailure("Invalid day key: \(key)") }
        return ordinal(year: c.year, month: c.month, day: c.day)
    }

    /// A well-formed key naming a real calendar day.
    static func isDayKey(_ key: String) -> Bool {
        guard let c = civil(key), (1...12).contains(c.month), c.day >= 1 else { return false }
        return format(ordinal(year: c.year, month: c.month, day: c.day)) == key
    }

    /// `day` shifted by `n` days. `day` must be a valid key.
    static func addDays(_ day: String, _ n: Int) -> String {
        format(ordinal(day) + n)
    }

    /// `a - b` in whole days. Both must be valid keys.
    static func diffDays(_ a: String, _ b: String) -> Int {
        ordinal(a) - ordinal(b)
    }
}

struct PauseRange: Equatable {
    let from: String
    /// Inclusive; nil while the pause is still running.
    let to: String?
}

struct StreakConfig: Equatable {
    /// Missed days forgiven per rolling 7 days without breaking the streak.
    var graceDays: Int
    /// Items to record on a day for it to count.
    var minDone: Int
    var pauses: [PauseRange]
}

struct StreakResult: Equatable {
    /// Days counted in the running streak. Forgiven and paused days do not add, and do not break.
    let current: Int
    let best: Int
    /// Misses forgiven inside the running streak.
    let forgiven: Int
    /// Misses still available in the 7 days ending today.
    let graceLeft: Int
    let paused: Bool
    let countedToday: Bool
}

/// One recorded value, as stored per (day, item).
struct MutabaahEntryValue: Equatable {
    let date: String
    let itemId: String
    let value: Int
}

enum MutabaahStreak {
    static let defaultConfig = StreakConfig(graceDays: 1, minDone: 3, pauses: [])
    static let maxGraceDays = 3
    static let graceWindowDays = 7
    static let maxPauses = 50

    /// Days with at least `minDone` of the enabled items recorded (never more than the number enabled).
    static func countedDays(_ entries: [MutabaahEntryValue], items: [ItemDef], minDone: Int) -> Set<String> {
        var kinds: [String: ItemKind] = [:]
        for item in items { kinds[item.id] = item.kind }
        let need = max(1, min(minDone, items.count))
        var perDay: [String: Int] = [:]
        for entry in entries {
            if let kind = kinds[entry.itemId], MutabaahItems.isDone(kind, entry.value) {
                perDay[entry.date, default: 0] += 1
            }
        }
        return Set(perDay.filter { $0.value >= need }.keys)
    }

    static func isPaused(_ day: String, _ pauses: [PauseRange]) -> Bool {
        pauses.contains { day >= $0.from && ($0.to.map { day <= $0 } ?? true) }
    }

    static func computeStreak(_ counted: Set<String>, today: String, config: StreakConfig) -> StreakResult {
        let countedToday = counted.contains(today)
        let paused = isPaused(today, config.pauses)
        guard let first = counted.filter({ $0 <= today }).min() else {
            return StreakResult(current: 0, best: 0, forgiven: 0, graceLeft: config.graceDays, paused: paused, countedToday: countedToday)
        }

        var current = 0
        var best = 0
        var forgiven: [String] = []
        let span = DayKeys.diffDays(today, first)
        if span >= 0 {
            for i in 0...span {
                let day = DayKeys.addDays(first, i)
                if isPaused(day, config.pauses) { continue }
                if counted.contains(day) {
                    current += 1
                    best = max(best, current)
                } else if day == today {
                    // Today is still open: not a miss yet.
                } else if current > 0 {
                    let recent = forgiven.filter { DayKeys.diffDays(day, $0) < graceWindowDays }.count
                    if recent < config.graceDays {
                        forgiven.append(day)
                    } else {
                        current = 0
                        forgiven = []
                    }
                }
            }
        }

        let used = forgiven.filter { DayKeys.diffDays(today, $0) < graceWindowDays }.count
        return StreakResult(
            current: current,
            best: best,
            forgiven: forgiven.count,
            graceLeft: max(0, config.graceDays - used),
            paused: paused,
            countedToday: countedToday
        )
    }

    static func startPause(_ config: StreakConfig, today: String) -> StreakConfig {
        if isPaused(today, config.pauses) { return config }
        var next = config
        next.pauses = Array((config.pauses + [PauseRange(from: today, to: nil)]).suffix(maxPauses))
        return next
    }

    /// Resume from `today`: the pause covers up to yesterday, and a pause that began today vanishes.
    static func endPause(_ config: StreakConfig, today: String) -> StreakConfig {
        let yesterday = DayKeys.addDays(today, -1)
        var pauses: [PauseRange] = []
        for p in config.pauses {
            let running = p.to.map { $0 >= today } ?? true
            if !running || p.from > today {
                pauses.append(p)
            } else if p.from <= yesterday {
                pauses.append(PauseRange(from: p.from, to: yesterday))
            }
        }
        var next = config
        next.pauses = pauses
        return next
    }

    static func parseStreakConfig(_ raw: String?) -> StreakConfig {
        guard let raw, !raw.isEmpty, case .object(let data)? = MutabaahJSON.parse(raw) else { return defaultConfig }
        func int(_ v: MutabaahJSON.Value?, _ lo: Int, _ hi: Int, _ fallback: Int) -> Int {
            guard case .number(let n)? = v, n.rounded(.towardZero) == n, n >= Double(lo), n <= Double(hi) else { return fallback }
            return Int(n)
        }
        var ranges: [PauseRange] = []
        if case .array(let pauses)? = data["pauses"] {
            for p in pauses {
                guard case .object(let fields) = p, case .string(let from)? = fields["from"], DayKeys.isDayKey(from) else { continue }
                switch fields["to"] {
                case .null?:
                    ranges.append(PauseRange(from: from, to: nil))
                case .string(let to)? where DayKeys.isDayKey(to) && to >= from:
                    ranges.append(PauseRange(from: from, to: to))
                default:
                    break
                }
            }
        }
        return StreakConfig(
            graceDays: int(data["graceDays"], 0, maxGraceDays, defaultConfig.graceDays),
            minDone: int(data["minDone"], 1, 99, defaultConfig.minDone),
            pauses: Array(ranges.suffix(maxPauses))
        )
    }

    /// Same bytes as the phone's `JSON.stringify(config)`.
    static func serializeStreakConfig(_ config: StreakConfig) -> String {
        let pauses = config.pauses.map { p in
            "{\"from\":" + MutabaahJSON.quote(p.from) + ",\"to\":" + (p.to.map(MutabaahJSON.quote) ?? "null") + "}"
        }
        return "{\"graceDays\":\(config.graceDays),\"minDone\":\(config.minDone),\"pauses\":[" + pauses.joined(separator: ",") + "]}"
    }
}
