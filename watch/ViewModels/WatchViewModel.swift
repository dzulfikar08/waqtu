import SwiftUI
import WatchKit

/// Watch ViewModel — loads cached prayer times, refreshes once daily.
@Observable
final class WatchViewModel {
    private let defaults = UserDefaults(suiteName: "group.com.waqtu.shared") ?? UserDefaults.standard
    private let settings = SharedSettings()
    private let streakSync = StreakSyncManager()

    var prayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: String = "--"
    var locationLabel: String = "Unknown"
    var todayProgress: (prayed: Int, total: Int) = (0, 5)

    private var timer: Timer?

    init() {
        loadCachedData()
        scheduleRefresh()
    }

    // MARK: - Data Loading

    /// Load cached prayer times from shared app group (set by iOS companion or transferred via WatchConnectivity).
    func loadCachedData() {
        // Try cached payload first
        if let data = defaults.data(forKey: "cachedPrayerPayload"),
           let payload = try? JSONDecoder().decode(PrayerTimesPayload.self, from: data),
           !payload.isStale {
            prayers = payload.toPrayerTimes()
        } else {
            // Fall back to local calculation using shared settings
            recalculateLocally()
        }

        nextPrayer = SharedPrayerCalculator.nextPrayer(from: prayers)
        locationLabel = defaults.string(forKey: "locationLabel") ?? settings.locationLabel
        updateCountdown()
        updateProgress()

        // Push latest state to complications
        pushToComplications()
    }

    /// Recalculate prayer times locally on the watch (Adhan may not be available, so this is fallback only).
    private func recalculateLocally() {
        let lat = defaults.double(forKey: "manualLatitude")
        let lon = defaults.double(forKey: "manualLongitude")

        let adjustments = PrayerAdjustmentsData(
            fajr: settings.adjustmentFajr,
            sunrise: 0,
            dhuhr: settings.adjustmentDhuhr,
            asr: settings.adjustmentAsr,
            maghrib: settings.adjustmentMaghrib,
            isha: settings.adjustmentIsha
        )

        prayers = SharedPrayerCalculator.calculate(
            latitude: lat != 0 ? lat : 21.4225,
            longitude: lon != 0 ? lon : 39.8262,
            method: settings.calculationMethod,
            madhab: settings.madhab,
            highLatitudeRule: settings.highLatitudeRule,
            adjustments: adjustments
        )
    }

    // MARK: - Timer

    private func scheduleRefresh() {
        timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    private func tick() {
        updateCountdown()

        // If we've passed the next prayer, recalculate
        if let next = nextPrayer, next.hasPassed {
            nextPrayer = SharedPrayerCalculator.nextPrayer(from: prayers)
            updateProgress()
            pushToComplications()
        }

        // If all prayers passed for today, recalculate at midnight
        if nextPrayer == nil {
            recalculateLocally()
            nextPrayer = SharedPrayerCalculator.nextPrayer(from: prayers)
            pushToComplications()
        }
    }

    private func updateCountdown() {
        guard let next = nextPrayer else {
            countdown = "--:--"
            return
        }
        countdown = next.shortCountdown
    }

    private func updateProgress() {
        todayProgress.prayed = streakSync.streakData.todayPrayed
        todayProgress.total = streakSync.streakData.todayTotal
    }

    // MARK: - Complications

    /// Push updated prayer data to watch complications via shared UserDefaults.
    private func pushToComplications() {
        guard let next = nextPrayer else { return }

        defaults.set(next.name.rawValue, forKey: "complication_nextPrayerName")
        defaults.set(next.shortCountdown, forKey: "complication_countdown")
        defaults.set(next.time.timeIntervalSince1970, forKey: "complication_nextPrayerTime")
        defaults.set(locationLabel, forKey: "complication_location")

        // Trigger complication refresh
        #if os(watchOS)
        WKInterfaceDevice.current().play(.click)
        #endif
    }

    deinit {
        timer?.invalidate()
    }
}
