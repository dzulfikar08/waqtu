import Foundation

struct PrayerTime: Identifiable, Comparable {
    let id = UUID()
    let name: PrayerName
    let time: Date

    var hasPassed: Bool {
        time < Date()
    }

    static func < (lhs: PrayerTime, rhs: PrayerTime) -> Bool {
        lhs.time < rhs.time
    }
}
