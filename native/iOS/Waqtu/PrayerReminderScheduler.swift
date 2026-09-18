import Foundation
import UserNotifications
import WaqtuCore

/// Schedules one local reminder per prayer for today (Fajr through Isha),
/// mirroring the macOS app's calm reminders. Times are recomputed whenever the
/// app comes to the foreground or settings change; nothing leaves the device.
@Observable
@MainActor
final class PrayerReminderScheduler {
    private static let dayKey = "remindersScheduledForDay"

    private var scheduledDayKey: String?

    init() {
        scheduledDayKey = UserDefaults.standard.string(forKey: Self.dayKey)
    }

    func requestAuthorizationIfNeeded() {
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .notDetermined else { return }
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
        }
    }

    /// (Re)schedules today's reminders. Cheap enough to call on every foreground.
    func scheduleIfNeeded(settings: AppSettings) {
        requestAuthorizationIfNeeded()
        let now = Date()
        guard let times = settings.prayerTimes(on: now) else { return }
        let dayKey = Self.dayKeyFormatter.string(from: now)
        let center = UNUserNotificationCenter.current()

        Task {
            center.removeAllPendingNotificationRequests()
            let calendar = Calendar.current
            for prayer in Prayer.allCases where prayer != .sunrise {
                guard let fireDate = settings.date(minutes: times.minutes(for: prayer), sameDayAs: now) else { continue }
                guard fireDate > now else { continue }
                let content = UNMutableNotificationContent()
                content.title = prayer.displayName
                content.body = "It's time for \(prayer.displayName)."
                content.sound = .default
                let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
                let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                let request = UNNotificationRequest(identifier: "waqtu.\(prayer.rawValue).\(dayKey)", content: content, trigger: trigger)
                try? await center.add(request)
            }
            UserDefaults.standard.set(dayKey, forKey: Self.dayKey)
        }
    }

    private static let dayKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
