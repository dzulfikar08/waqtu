import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct PrayerEntry: TimelineEntry {
    let date: Date
    let nextPrayerName: String
    let nextPrayerTime: Date
    let countdownMinutes: Int
    let locationLabel: String
    let todayPrayed: Int
}

// MARK: - Provider

struct PrayerTimelineProvider: TimelineProvider {
    private let store = NSUbiquitousKeyValueStore.default

    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(
            date: Date(),
            nextPrayerName: "Dhuhr",
            nextPrayerTime: Date().addingTimeInterval(3600),
            countdownMinutes: 60,
            locationLabel: "Loading...",
            todayPrayed: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let entry = loadCurrentEntry()
        // Refresh every 15 minutes (widgets can't refresh more frequently)
        let nextRefresh = Date().addingTimeInterval(15 * 60)
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    private func loadCurrentEntry() -> PrayerEntry {
        // Load cached prayer times from app group
        let defaults = UserDefaults(suiteName: "group.com.waqtu.shared")
        let prayersData = defaults?.data(forKey: "cachedPrayerPayload")
        let payload = prayersData.flatMap { try? JSONDecoder().decode(PrayerTimesPayload.self, from: $0) }
        let times = payload?.toPrayerTimes() ?? []
        let next = SharedPrayerCalculator.nextPrayer(from: times)

        return PrayerEntry(
            date: Date(),
            nextPrayerName: next?.name.displayName ?? "--",
            nextPrayerTime: next?.time ?? Date(),
            countdownMinutes: next?.minutesUntil ?? 0,
            locationLabel: store.string(forKey: "locationLabel") ?? "Unknown",
            todayPrayed: defaults?.integer(forKey: "todayPrayed") ?? 0
        )
    }
}

// MARK: - Widget Views

struct PrayerWidgetEntryView: View {
    var entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            accessoryCircular
        case .accessoryRectangular:
            accessoryRectangular
        case .accessoryInline:
            accessoryInline
        default:
            systemSmall
        }
    }

    // MARK: - Lock Screen / Accessories

    private var accessoryCircular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: prayerIcon(entry.nextPrayerName))
                    .font(.system(size: 16, weight: .medium))
                Text(entry.nextPrayerName.prefix(3).uppercased())
                    .font(.system(size: 8, weight: .bold))
                Text(countdownShort)
                    .font(.system(size: 10, weight: .regular))
            }
        }
    }

    private var accessoryRectangular: some View {
        HStack(spacing: 8) {
            Image(systemName: prayerIcon(entry.nextPrayerName))
                .font(.title3)
            VStack(alignment: .leading, spacing: 0) {
                Text(entry.nextPrayerName)
                    .font(.headline)
                Text("in \(countdownShort)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private var accessoryInline: some View {
        HStack {
            Image(systemName: prayerIcon(entry.nextPrayerName))
            Text("\(entry.nextPrayerName) in \(countdownShort)")
        }
    }

    // MARK: - Home Screen

    private var systemSmall: some View {
        VStack(spacing: 4) {
            Image(systemName: prayerIcon(entry.nextPrayerName))
                .font(.title)
                .foregroundStyle(.waqtuTeal)

            Text(entry.nextPrayerName)
                .font(.caption.weight(.medium))

            Text(countdownShort)
                .font(.title2.monospacedDigit().weight(.bold))
                .foregroundStyle(.waqtuTeal)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }

    // MARK: - Helpers

    private var countdownShort: String {
        let m = entry.countdownMinutes
        guard m > 0 else { return "now" }
        if m >= 60 {
            return "\(m / 60)h \(m % 60)m"
        }
        return "\(m)m"
    }

    private func prayerIcon(_ name: String) -> String {
        switch name.lowercased() {
        case "fajr": return "sun.and.horizon.fill"
        case "dhuhr": return "sun.max.fill"
        case "asr": return "sun.min.fill"
        case "maghrib": return "sunset.fill"
        case "isha": return "moon.stars.fill"
        default: return "clock.fill"
        }
    }
}

// MARK: - Widget Definition

struct PrayerWidget: Widget {
    let kind = "com.waqtu.PrayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: PrayerTimelineProvider()
        ) { entry in
            PrayerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Next Prayer")
        .description("Shows the next prayer time and countdown.")
        .supportedFamilies([
            .systemSmall,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: - Widget Bundle

@main
struct WaqtuWidgets: WidgetBundle {
    var body: some Widget {
        PrayerWidget()
    }
}
