import Foundation

/// Pushes prayer times and streak data from the macOS app to the shared
/// app group container for iOS companion, macOS widgets, and watch complications.
///
/// Call this from AppViewModel whenever prayers are calculated or streaks change.
@Observable
public final class SharedDataBridge {
    private let defaults = UserDefaults(suiteName: "group.com.waqtu.shared") ?? UserDefaults.standard

    public init() {}

    /// Push the latest prayer times to the shared container.
    public func pushPrayerTimes(
        prayers: [PrayerTime],
        locationLabel: String,
        calculationMethod: String
    ) {
        let payload = PrayerTimesPayload(
            prayers: prayers,
            locationLabel: locationLabel,
            calculationMethod: calculationMethod
        )

        if let data = try? JSONEncoder().encode(payload) {
            defaults.set(data, forKey: "cachedPrayerPayload")
        }

        defaults.set(locationLabel, forKey: "locationLabel")
        defaults.synchronize()
    }

    /// Push streak data to the shared container.
    public func pushStreakData(
        currentStreak: Int,
        bestStreak: Int,
        todayPrayed: Int,
        weeklyGrid: [StreakData.DayDot]
    ) {
        let streakData = StreakData(
            currentStreak: currentStreak,
            bestStreak: bestStreak,
            todayPrayed: todayPrayed,
            todayTotal: 5,
            weeklyGrid: weeklyGrid,
            lastUpdated: Date()
        )

        if let data = try? JSONEncoder().encode(streakData) {
            defaults.set(data, forKey: "sharedStreakData")
        }

        defaults.set(todayPrayed, forKey: "todayPrayed")
        defaults.synchronize()
    }

    /// Push watch complication data.
    public func pushWatchComplicationData(
        nextPrayer: PrayerTime?,
        locationLabel: String
    ) {
        guard let next = nextPrayer else { return }

        defaults.set(next.name.rawValue, forKey: "complication_nextPrayerName")
        defaults.set(next.shortCountdown, forKey: "complication_countdown")
        defaults.set(next.time.timeIntervalSince1970, forKey: "complication_nextPrayerTime")
        defaults.set(locationLabel, forKey: "complication_location")
        defaults.synchronize()

        // Trigger widget timeline reload
        #if os(macOS)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }
}

// MARK: - WidgetCenter wrapper (conditional import)

#if canImport(WidgetKit)
import WidgetKit
#endif
