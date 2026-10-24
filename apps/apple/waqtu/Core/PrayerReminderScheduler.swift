import Foundation
import UserNotifications

/// Schedules local notifications like "Asr in 5 minutes" before each prayer.
final class PrayerReminderScheduler {
    private let settings: AppSettings

    init(settings: AppSettings) {
        self.settings = settings
    }

    private static let prayerIds = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

    func scheduleReminders(for prayers: [PrayerTime]) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: Self.prayerIds.map { "prayer-reminder-\($0)" })

        guard settings.reminderNotificationEnabled else { return }

        func doSchedule() {
            addReminderRequests(for: prayers)
        }

        UNUserNotificationCenter.current().getNotificationSettings { authSettings in
            if authSettings.authorizationStatus == .authorized {
                DispatchQueue.main.async { doSchedule() }
            } else {
                UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    guard granted else { return }
                    DispatchQueue.main.async { doSchedule() }
                }
            }
        }
    }

    private func addReminderRequests(for prayers: [PrayerTime]) {
        let minutes = settings.reminderMinutesBefore
        let now = Date()

        for prayer in prayers {
            let reminderDate = prayer.time.addingTimeInterval(-Double(minutes * 60))
            guard reminderDate > now else { continue }

            let content = UNMutableNotificationContent()
            content.title = "\(prayer.name.displayName) in \(minutes) min"
            content.body = "Prayer time at \(formatTime(prayer.time))"
            content.sound = .default

            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: reminderDate
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let id = "prayer-reminder-\(prayer.name.rawValue)"
            let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
            UNUserNotificationCenter.current().add(request)
        }
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: Self.prayerIds.map { "prayer-reminder-\($0)" })
    }
}
