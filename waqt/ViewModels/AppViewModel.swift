import Foundation
import Combine
import AppKit

@Observable
final class AppViewModel {
    var settings: AppSettings
    let calculator: PrayerTimeCalculator
    let locationManager: LocationManager

    private var timer: Timer?
    private var shownPrayers: Set<String> = []

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: Int = 0
    var overlayWindow: NSWindow?

    private var cancellables = Set<AnyCancellable>()

    init() {
        let settings = AppSettings()
        self.settings = settings
        self.calculator = PrayerTimeCalculator(settings: settings)
        self.locationManager = LocationManager()
        setupLocationUpdates()
        calculatePrayers()
        setupTimer()
    }

    private func setupLocationUpdates() {
        locationManager.requestPermission()
        locationManager.$coordinates
            .compactMap { $0 }
            .sink { [weak self] coordinates in
                self?.calculator.setCurrentCoordinates(coordinates)
                self?.calculatePrayers()
            }
            .store(in: &cancellables)
    }

    func calculatePrayers() {
        todayPrayers = calculator.calculatePrayerTimes()
        nextPrayer = calculator.getNextPrayer()
        updateCountdown()
    }

    private func setupTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateCountdown()
            self?.checkPrayerTime()
        }
    }

    private func updateCountdown() {
        guard let next = nextPrayer else {
            countdown = 0
            return
        }
        let now = Date()
        let diff = next.time.timeIntervalSince(now)
        if diff > 0 {
            countdown = Int(diff)
        } else {
            calculatePrayers()
        }
    }

    private func checkPrayerTime() {
        guard settings.overlayEnabled,
              let next = nextPrayer else { return }
        let now = Date()
        let diff = abs(now.timeIntervalSince(next.time))
        if diff < 10 && !hasShownPrayer(next) {
            showOverlay(for: next)
            markPrayerAsShown(next)
        }
    }

    private func hasShownPrayer(_ prayer: PrayerTime) -> Bool {
        let key = prayerKey(for: prayer)
        return shownPrayers.contains(key)
    }

    private func markPrayerAsShown(_ prayer: PrayerTime) {
        let key = prayerKey(for: prayer)
        shownPrayers.insert(key)
    }

    private func prayerKey(for prayer: PrayerTime) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return "\(formatter.string(from: prayer.time))-\(prayer.name.rawValue)"
    }

    private func showOverlay(for prayer: PrayerTime) {
        overlayWindow = OverlayWindow(durationMinutes: settings.overlayDuration) { [weak self] in
            self?.overlayWindow = nil
        }
        overlayWindow?.makeKeyAndOrderFront(nil)
    }

    func resetShownPrayers() {
        shownPrayers.removeAll()
    }
}
