import WidgetKit
import SwiftUI
import WaqtuCore

@main
struct PrayerComplicationBundle: WidgetBundle {
    var body: some Widget {
        CircularNextPrayerWidget()
        RectangularNextPrayerWidget()
        InlineNextPrayerWidget()
    }
}

// MARK: - Timeline

struct NextPrayerEntry: TimelineEntry {
    let date: Date
    /// `nil` while the complication has no stored location yet.
    let snapshot: PrayerSnapshot?
}

/// Everything the widget views render, computed once per entry.
struct PrayerSnapshot {
    let prayer: Prayer
    let clockText: String
    let minutesUntil: Int
}

struct NextPrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPrayerEntry {
        NextPrayerEntry(date: Date(), snapshot: PrayerSnapshot(prayer: .asr, clockText: "15:40", minutesUntil: 96))
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPrayerEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPrayerEntry>) -> Void) {
        let now = Date()
        var entries = [entry(at: now)]
        // Refresh at each prayer boundary so the countdown stays live without
        // the extension running in the background.
        let calendar = Calendar.current
        if let times = SharedPrayerSettings.prayerTimes(on: now) {
            for prayer in Prayer.allCases {
                let minutes = times.minutes(for: prayer)
                if let date = calendar.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: now),
                   date > now {
                    entries.append(entry(at: date))
                }
            }
        }
        // Rebuild once a day even if nothing else fires.
        let nextRebuild = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: entries, policy: .after(nextRebuild)))
    }

    private func entry(at date: Date) -> NextPrayerEntry {
        guard let times = SharedPrayerSettings.prayerTimes(on: date) else {
            return NextPrayerEntry(date: date, snapshot: nil)
        }
        let next = times.nextPrayer(
            currentMinutes: SharedPrayerSettings.minutesSinceMidnight(of: date),
            nextDayFajrMinutes: nil
        )
        return NextPrayerEntry(
            date: date,
            snapshot: PrayerSnapshot(
                prayer: next.prayer,
                clockText: times.clockText(for: next.prayer),
                minutesUntil: next.minutesUntil
            )
        )
    }
}

// MARK: - Views

private func countdownText(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    return h > 0 ? "\(h)h \(m)m" : "\(m)m"
}

struct CircularNextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WaqtuCircularNextPrayer", provider: NextPrayerProvider()) { entry in
            if let snapshot = entry.snapshot {
                VStack(spacing: 0) {
                    Image(systemName: "moon.stars.fill")
                        .font(.caption2)
                        .foregroundStyle(.tint)
                    Text(countdownText(snapshot.minutesUntil))
                        .font(.system(size: 15, weight: .semibold).monospacedDigit())
                        .minimumScaleFactor(0.6)
                        .widgetLabel {
                            Text("\(snapshot.prayer.displayName) \(snapshot.clockText)")
                        }
                }
            } else {
                Image(systemName: "location.slash")
            }
        }
        .containerBackgroundRemovable()
        .configurationDisplayName("Next Prayer")
        .description("Countdown to the next prayer, calculated on watch.")
        .supportedFamilies([.accessoryCircular])
    }
}

struct RectangularNextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WaqtuRectangularNextPrayer", provider: NextPrayerProvider()) { entry in
            if let snapshot = entry.snapshot {
                VStack(alignment: .leading, spacing: 0) {
                    Text(snapshot.prayer.displayName)
                        .font(.headline)
                    Text(snapshot.clockText)
                        .foregroundStyle(.secondary)
                    Text("in \(countdownText(snapshot.minutesUntil))")
                        .font(.caption)
                        .foregroundStyle(.tint)
                }
            } else {
                Text("Open Waqtu to set location")
                    .font(.caption)
            }
        }
        .containerBackgroundRemovable()
        .configurationDisplayName("Next Prayer")
        .description("Prayer name, time, and countdown.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct InlineNextPrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WaqtuInlineNextPrayer", provider: NextPrayerProvider()) { entry in
            if let snapshot = entry.snapshot {
                Text("\(snapshot.prayer.displayName) \(snapshot.clockText) · \(countdownText(snapshot.minutesUntil))")
            } else {
                Text("Waqtu: set location")
            }
        }
        .containerBackgroundRemovable()
        .configurationDisplayName("Next Prayer")
        .description("One-line countdown.")
        .supportedFamilies([.accessoryInline])
    }
}
