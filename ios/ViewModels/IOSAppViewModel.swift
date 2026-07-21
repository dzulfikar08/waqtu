import Foundation
import SwiftUI
import CoreLocation

/// iOS ViewModel — manages prayer times, streaks, and settings synced via iCloud.
/// Uses on-device Core Location once for accurate times, falls back to iCloud-synced location.
@Observable
final class IOSAppViewModel: NSObject, CLLocationManagerDelegate {
    let settings = SharedSettings()
    let streakSync = StreakSyncManager()

    var todayPrayers: [PrayerTime] = []
    var nextPrayer: PrayerTime?
    var countdown: String = "--"

    // Location
    private let locationManager = CLLocationManager()
    private var lastKnownLocation: CLLocation?
    var locationLabel: String = "Locating..."
    var isLocating: Bool = true

    /// Current streak from synced data.
    var currentStreak: Int {
        streakSync.streakData.currentStreak
    }

    /// Best streak from synced data.
    var bestStreak: Int {
        streakSync.streakData.bestStreak
    }

    /// Today's progress (prayed/total).
    var todayProgress: (prayed: Int, total: Int) {
        let d = streakSync.streakData
        return (d.todayPrayed, d.todayTotal)
    }

    /// Weekly grid dots.
    var weeklyGrid: [StreakData.DayDot] {
        streakSync.streakData.weeklyGrid
    }

    private var timer: Timer?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
        locationManager.requestWhenInUseAuthorization()
        locationManager.requestLocation()
        calculatePrayers()
        scheduleRefreshTimer()
    }

    // MARK: - Location

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        lastKnownLocation = location
        isLocating = false
        geocodeAndCalculate(location)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        isLocating = false
        // Fall back to shared settings (iCloud from Mac) or manual coords
        let lat = settings.manualLatitude != 0 ? settings.manualLatitude : 21.4225
        let lon = settings.manualLongitude != 0 ? settings.manualLongitude : 39.8262
        let loc = CLLocation(latitude: lat, longitude: lon)
        geocodeAndCalculate(loc)
    }

    private func geocodeAndCalculate(_ location: CLLocation) {
        // Show coordinates immediately as fallback
        let lat = location.coordinate.latitude
        let lon = location.coordinate.longitude
        self.locationLabel = String(format: "%.2f°N, %.2f°E", abs(lat), abs(lon))
        self.calculatePrayers(at: location)
        
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(location) { [weak self] places, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                if let place = places?.first {
                    self.locationLabel = place.locality ?? place.country ?? self.locationLabel
                    self.settings.locationLabel = self.locationLabel
                }
            }
        }
    }

    // MARK: - Calculation

    func calculatePrayers(at location: CLLocation? = nil) {
        let loc = location ?? lastKnownLocation
        let lat: Double, lon: Double

        if let loc {
            lat = loc.coordinate.latitude
            lon = loc.coordinate.longitude
        } else if settings.manualLatitude != 0 {
            lat = settings.manualLatitude
            lon = settings.manualLongitude
        } else {
            lat = 21.4225
            lon = 39.8262
        }

        let adjustments = PrayerAdjustmentsData(
            fajr: settings.adjustmentFajr,
            sunrise: 0,
            dhuhr: settings.adjustmentDhuhr,
            asr: settings.adjustmentAsr,
            maghrib: settings.adjustmentMaghrib,
            isha: settings.adjustmentIsha
        )

        todayPrayers = SharedPrayerCalculator.calculate(
            latitude: lat,
            longitude: lon,
            method: settings.calculationMethod,
            madhab: settings.madhab,
            highLatitudeRule: settings.highLatitudeRule,
            adjustments: adjustments
        )
        nextPrayer = SharedPrayerCalculator.nextPrayer(from: todayPrayers)
        updateCountdown()
    }

    func refresh() {
        isLocating = true
        locationManager.requestLocation()
    }

    // MARK: - Timer

    private func scheduleRefreshTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.updateCountdown()
        }
    }

    private func updateCountdown() {
        guard let next = nextPrayer else {
            countdown = "--:--"
            return
        }
        let diff = next.time.timeIntervalSinceNow
        if diff <= 0 {
            calculatePrayers()
            return
        }
        countdown = next.shortCountdown
    }

    deinit {
        timer?.invalidate()
    }
}
