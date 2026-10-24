import SwiftUI
import WidgetKit

// MARK: - Complication Entry

struct ComplicationEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let countdown: String
    let nextPrayerTime: Date
    let locationLabel: String
}

// MARK: - Provider

struct ComplicationProvider: TimelineProvider {
    private let defaults = UserDefaults(suiteName: "group.com.waqtu.shared") ?? UserDefaults.standard

    func placeholder(in context: Context) -> ComplicationEntry {
        ComplicationEntry(
            date: Date(),
            prayerName: "Dhuhr",
            countdown: "1:00",
            nextPrayerTime: Date().addingTimeInterval(3600),
            locationLabel: "Waqtu"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void) {
        let entry = loadEntry()

        // Refresh at next prayer time or in 30 minutes, whichever is sooner
        let nextPrayerTime = entry.nextPrayerTime
        let fallback = Date().addingTimeInterval(30 * 60)
        let refreshDate = min(nextPrayerTime > Date() ? nextPrayerTime : fallback, fallback)

        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }

    private func loadEntry() -> ComplicationEntry {
        let name = defaults.string(forKey: "complication_nextPrayerName") ?? "Fajr"
        let countdown = defaults.string(forKey: "complication_countdown") ?? "--"
        let timeInterval = defaults.double(forKey: "complication_nextPrayerTime")
        let location = defaults.string(forKey: "complication_location") ?? "Waqtu"

        return ComplicationEntry(
            date: Date(),
            prayerName: name,
            countdown: countdown,
            nextPrayerTime: timeInterval > 0 ? Date(timeIntervalSince1970: timeInterval) : Date(),
            locationLabel: location
        )
    }
}

// MARK: - Complication Views

struct WaqtuComplications: Widget {
    let kind = "com.waqtu.watch.complications"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: ComplicationProvider()
        ) { entry in
            ComplicationView(entry: entry)
        }
        .configurationDisplayName("Waqtu Prayer Times")
        .description("Next prayer time and countdown on your watch face.")
        .supportedFamilies([
            .accessoryCorner,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: - Complication Rendering

struct ComplicationView: View {
    let entry: ComplicationEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryCorner:
            accessoryCorner
        case .accessoryCircular:
            accessoryCircular
        case .accessoryRectangular:
            accessoryRectangular
        case .accessoryInline:
            accessoryInline
        default:
            accessoryInline
        }
    }

    // MARK: - Accessory Corner (prayer name + icon)
    private var accessoryCorner: some View {
        Text(entry.prayerName.prefix(4).uppercased())
            .font(.caption2.weight(.semibold))
            .widgetLabel {
                Image(systemName: complicationIcon)
            }
    }

    // MARK: - Accessory Circular (icon + countdown)
    private var accessoryCircular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: complicationIcon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.waqtuTeal)
                Text(entry.countdown)
                    .font(.system(size: 9, weight: .regular))
            }
        }
    }

    // MARK: - Accessory Rectangular (icon + detail row)
    private var accessoryRectangular: some View {
        HStack(spacing: 4) {
            Image(systemName: complicationIcon)
                .font(.caption)
                .foregroundStyle(Color.waqtuTeal)
            VStack(alignment: .leading, spacing: 0) {
                Text(entry.prayerName)
                    .font(.caption.weight(.semibold))
                Text(entry.countdown)
                    .font(.caption2)
                    .foregroundStyle(Color.secondary)
            }
            Spacer()
        }
    }

    // MARK: - Accessory Inline (single text line)
    private var accessoryInline: some View {
        HStack(spacing: 2) {
            Image(systemName: complicationIcon)
            Text("\(entry.prayerName) \(entry.countdown)")
        }
    }

    // MARK: - Helpers

    private var complicationIcon: String {
        switch entry.prayerName.lowercased() {
        case "fajr": return "sun.and.horizon.fill"
        case "dhuhr": return "sun.max.fill"
        case "asr": return "sun.min.fill"
        case "maghrib": return "sunset.fill"
        case "isha": return "moon.stars.fill"
        default: return "clock.fill"
        }
    }
}
