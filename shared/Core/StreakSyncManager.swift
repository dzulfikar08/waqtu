import Foundation

/// Shared streak data model for iCloud sync between macOS and iOS.
/// Uses NSUbiquitousKeyValueStore for lightweight key-value sync.
public struct StreakData: Codable {
    public var currentStreak: Int
    public var bestStreak: Int
    public var todayPrayed: Int
    public var todayTotal: Int
    public var weeklyGrid: [DayDot]
    public var lastUpdated: Date

    public init(
        currentStreak: Int = 0,
        bestStreak: Int = 0,
        todayPrayed: Int = 0,
        todayTotal: Int = 5,
        weeklyGrid: [DayDot] = [],
        lastUpdated: Date = Date()
    ) {
        self.currentStreak = currentStreak
        self.bestStreak = bestStreak
        self.todayPrayed = todayPrayed
        self.todayTotal = todayTotal
        self.weeklyGrid = weeklyGrid
        self.lastUpdated = lastUpdated
    }

    /// A single day's dot in the weekly grid.
    public struct DayDot: Codable, Identifiable {
        public var id: String { "\(date)-\(status)" }
        public let date: String      // yyyy-MM-dd
        public let label: String     // "Mon", "Tue", etc.
        public let status: DotStatus
        public let isToday: Bool

        public enum DotStatus: String, Codable {
            case complete   // ● all 5 prayed
            case partial    // ◐ some prayed
            case missed     // ○ none prayed
            case empty      // · no data (past) / space (today)
        }

        public var symbol: String {
            switch status {
            case .complete: return "●"
            case .partial: return "◐"
            case .missed: return "○"
            case .empty: return "·"
            }
        }
    }
}

/// Manages iCloud sync of streak data between macOS and iOS.
/// Uses NSUbiquitousKeyValueStore — lightweight, no CloudKit container needed.
@Observable
public final class StreakSyncManager {
    private let store = NSUbiquitousKeyValueStore.default
    private let streakKey = "sharedStreakData"

    public var streakData: StreakData {
        didSet { pushToCloud() }
    }

    public init() {
        self.streakData = Self.loadFromCloud(store: store, key: streakKey)
        setupCloudObserver()
    }

    /// Update from local PrayerStreakManager (call on macOS after streak changes).
    public func updateFromLocal(
        currentStreak: Int,
        bestStreak: Int,
        todayPrayed: Int,
        weeklyGrid: [StreakData.DayDot]
    ) {
        streakData = StreakData(
            currentStreak: currentStreak,
            bestStreak: bestStreak,
            todayPrayed: todayPrayed,
            todayTotal: 5,
            weeklyGrid: weeklyGrid,
            lastUpdated: Date()
        )
    }

    // MARK: - Private

    private func pushToCloud() {
        guard let data = try? JSONEncoder().encode(streakData) else { return }
        store.set(data, forKey: streakKey)
        store.synchronize()
    }

    private static func loadFromCloud(store: NSUbiquitousKeyValueStore, key: String) -> StreakData {
        guard let data = store.data(forKey: key),
              let decoded = try? JSONDecoder().decode(StreakData.self, from: data) else {
            return StreakData()
        }
        return decoded
    }

    private func setupCloudObserver() {
        NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store,
            queue: .main
        ) { [weak self] notification in
            guard let self,
                  let reason = notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int else { return }

            // Only reload on server change or initial sync
            if reason == NSUbiquitousKeyValueStoreServerChange ||
               reason == NSUbiquitousKeyValueStoreInitialSyncChange {
                self.streakData = Self.loadFromCloud(store: self.store, key: self.streakKey)
            }
        }
    }
}
