import Foundation
import Adhan

final class PrayerTimeCalculator {
    private let settings: AppSettings
    private var currentCoordinates: Coordinates?

    init(settings: AppSettings) {
        self.settings = settings
    }

    func calculatePrayerTimes(for date: Date = Date()) -> [PrayerTime] {
        let coordinates = getCoordinates()
        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents([.year, .month, .day], from: date)

        var params = CalculationMethod.muslimWorldLeague.params
        params.madhab = .shafi

        let prayerTimes = PrayerTimes(
            coordinates: coordinates,
            date: components,
            calculationParameters: params
        )

        var times: [PrayerTime] = []

        if let fajr = prayerTimes?.fajr {
            times.append(PrayerTime(name: .fajr, time: fajr))
        }
        if let dhuhr = prayerTimes?.dhuhr {
            times.append(PrayerTime(name: .dhuhr, time: dhuhr))
        }
        if let asr = prayerTimes?.asr {
            times.append(PrayerTime(name: .asr, time: asr))
        }
        if let maghrib = prayerTimes?.maghrib {
            times.append(PrayerTime(name: .maghrib, time: maghrib))
        }
        if let isha = prayerTimes?.isha {
            times.append(PrayerTime(name: .isha, time: isha))
        }

        return times
    }

    func getNextPrayer() -> PrayerTime? {
        let prayers = calculatePrayerTimes()
        return prayers.first { !$0.hasPassed }
    }

    private func getCoordinates() -> Coordinates {
        if settings.autoDetectLocation {
            return currentCoordinates ?? Coordinates(
                latitude: settings.manualLatitude,
                longitude: settings.manualLongitude
            )
        } else {
            return Coordinates(
                latitude: settings.manualLatitude,
                longitude: settings.manualLongitude
            )
        }
    }

    func setCurrentCoordinates(_ coordinates: Coordinates?) {
        currentCoordinates = coordinates
    }
}
