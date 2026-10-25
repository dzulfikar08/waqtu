//
//  FastingCountdown.swift
//  waqtu
//
//  Ramadhan detection and the sahur/iftar countdown shown in the menu bar title
//  (packages/core/src/ramadhan.ts: isRamadhan, fastingCountdown).
//

import Foundation

enum Ramadhan {
    static let month = 9
    /// Sahur ends at imsak, this many minutes before fajr.
    static let defaultImsakMinutes = 10

    /// True when the civil (Gregorian) day of `date` in `calendar`'s time zone is in Ramadhan under
    /// the Umm al-Qura calendar shifted by `hijriOffset` days (moon-sighting correction; Indonesia
    /// often lags by 1). Only the zone of `calendar` is used, so a non-Gregorian system calendar
    /// does not shift the result.
    static func isRamadhan(on date: Date, hijriOffset: Int = 0, calendar: Calendar = .current) -> Bool {
        let civil = FardhMapping.gregorian(in: calendar).dateComponents([.year, .month, .day], from: date)
        guard let year = civil.year, let monthOfYear = civil.month, let day = civil.day else { return false }
        // Noon UTC avoids any zone edge: only the civil Y-M-D matters.
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let noon = utc.date(from: DateComponents(year: year, month: monthOfYear, day: day, hour: 12)),
              let instant = utc.date(byAdding: .day, value: hijriOffset, to: noon) else { return false }
        var hijri = Calendar(identifier: .islamicUmmAlQura)
        hijri.timeZone = utc.timeZone
        return hijri.component(.month, from: instant) == Ramadhan.month
    }
}

struct FastingCountdown: Equatable {
    enum Target: Equatable {
        /// Sahur ends: eating is allowed until then.
        case imsak
        /// Iftar: the fast ends at maghrib.
        case maghrib
    }

    let target: Target
    let at: Date

    func secondsRemaining(at now: Date) -> Int {
        max(0, Int(at.timeIntervalSince(now).rounded(.up)))
    }

    var label: String {
        switch target {
        case .imsak: return "Imsak"
        case .maghrib: return "Iftar"
        }
    }

    /// Menu bar title, e.g. "Iftar 2h 14m" or "Imsak 14m 05s".
    func title(at now: Date) -> String {
        let total = secondsRemaining(at: now)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        if hours > 0 { return "\(label) \(hours)h \(String(format: "%02d", minutes))m" }
        return "\(label) \(minutes)m \(String(format: "%02d", seconds))s"
    }

    /// What to count down to at `now`: imsak until it passes, then maghrib (iftar), then the next
    /// imsak. Nil outside Ramadhan, and when a needed prayer time does not exist.
    /// - Parameters:
    ///   - todayFajr/todayMaghrib: prayer times of the civil day `now` falls on.
    ///   - tomorrowFajr: fajr of the next civil day.
    ///   - isRamadhanToday/isRamadhanTomorrow: Ramadhan membership of those two days.
    static func compute(
        now: Date,
        todayFajr: Date?,
        todayMaghrib: Date?,
        tomorrowFajr: Date?,
        isRamadhanToday: Bool,
        isRamadhanTomorrow: Bool,
        imsakMinutes: Int = Ramadhan.defaultImsakMinutes
    ) -> FastingCountdown? {
        let offset = TimeInterval(imsakMinutes * 60)
        if isRamadhanToday {
            if let fajr = todayFajr, now < fajr.addingTimeInterval(-offset) {
                return FastingCountdown(target: .imsak, at: fajr.addingTimeInterval(-offset))
            }
            if let maghrib = todayMaghrib, now < maghrib {
                return FastingCountdown(target: .maghrib, at: maghrib)
            }
        } else if let maghrib = todayMaghrib, now < maghrib {
            // Before the first fast starts: nothing to count down to yet.
            return nil
        }
        // After maghrib: the next sahur, only when the next day is a fasting day.
        if isRamadhanTomorrow, let fajr = tomorrowFajr {
            return FastingCountdown(target: .imsak, at: fajr.addingTimeInterval(-offset))
        }
        return nil
    }
}
