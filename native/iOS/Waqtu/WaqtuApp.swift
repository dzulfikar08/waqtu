import SwiftUI
import WaqtuCore

@main
struct WaqtuApp: App {
    @State private var settings = AppSettings()
    @State private var reminders = PrayerReminderScheduler()

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environment(settings)
                .environment(reminders)
                .task {
                    reminders.scheduleIfNeeded(settings: settings)
                }
        }
    }
}
