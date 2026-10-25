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

        let params = PrayerMethodParameters.make(
            method: settings.calculationMethod,
            madhab: settings.madhab,
            highLatitudeRule: settings.highLatitudeRule,
            adjustments: PrayerAdjustmentsData(
                fajr: settings.adjustmentFajr,
                sunrise: settings.adjustmentSunrise,
                dhuhr: settings.adjustmentDhuhr,
                asr: settings.adjustmentAsr,
                maghrib: settings.adjustmentMaghrib,
                isha: settings.adjustmentIsha
            )
        )

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

    /// Returns the next upcoming prayer. If past today's Isha, returns tomorrow's Fajr.
    func getNextPrayer() -> PrayerTime? {
        let todayPrayers = calculatePrayerTimes()
        if let next = todayPrayers.first(where: { !$0.hasPassed }) {
            return next
        }
        // Past last prayer today — next prayer is tomorrow's Fajr
        let calendar = Calendar(identifier: .gregorian)
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) else {
            return nil
        }
        let tomorrowPrayers = calculatePrayerTimes(for: tomorrow)
        return tomorrowPrayers.first
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
