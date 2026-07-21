import SwiftUI
import WidgetKit

// MARK: - macOS Widget Entry

struct MacPrayerEntry: TimelineEntry {
    let date: Date
    let nextPrayer: String
    let nextTime: Date
    let countdown: String
    let allPrayers: [MacPrayerData]
    let currentStreak: Int
    let bestStreak: Int
    let weeklyGrid: [DayDotData]
}

struct MacPrayerData: Codable {
    let name: String
    let time: Date
    let hasPassed: Bool
}

struct DayDotData: Codable {
    let label: String
    let symbol: String
    let isToday: Bool
}

// MARK: - Provider

struct MacPrayerTimelineProvider: TimelineProvider {
    private let defaults = UserDefaults(suiteName: "group.com.waqtu.shared") ?? UserDefaults.standard

    func placeholder(in context: Context) -> MacPrayerEntry {
        MacPrayerEntry(
            date: Date(),
            nextPrayer: "Dhuhr",
            nextTime: Date().addingTimeInterval(3600),
            countdown: "1h 0m",
            allPrayers: samplePrayers(),
            currentStreak: 7,
            bestStreak: 30,
            weeklyGrid: sampleGrid()
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (MacPrayerEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MacPrayerEntry>) -> Void) {
        let entry = loadEntry()
        let nextRefresh = Date().addingTimeInterval(15 * 60)
        let timeline = Timeline(entries: [entry], policy: .after(nextRefresh))
        completion(timeline)
    }

    private func loadEntry() -> MacPrayerEntry {
        // Load from shared container
        let defaults = UserDefaults(suiteName: "group.com.waqtu.shared") ?? UserDefaults.standard

        let prayersData = defaults.data(forKey: "cachedPrayerPayload")
        let payload = prayersData.flatMap { try? JSONDecoder().decode(PrayerTimesPayload.self, from: $0) }
        let times = payload?.toPrayerTimes() ?? []

        let next = SharedPrayerCalculator.nextPrayer(from: times)

        let allPrayers: [MacPrayerData] = times.map {
            MacPrayerData(name: $0.name.displayName, time: $0.time, hasPassed: $0.hasPassed)
        }

        // Load streak data
        let streakData = defaults.data(forKey: "sharedStreakData")
            .flatMap { try? JSONDecoder().decode(StreakData.self, from: $0) }

        let grid: [DayDotData] = streakData?.weeklyGrid.map {
            DayDotData(label: $0.label, symbol: $0.symbol, isToday: $0.isToday)
        } ?? sampleGrid()

        return MacPrayerEntry(
            date: Date(),
            nextPrayer: next?.name.displayName ?? "--",
            nextTime: next?.time ?? Date(),
            countdown: next?.countdownText ?? "--",
            allPrayers: allPrayers,
            currentStreak: streakData?.currentStreak ?? 0,
            bestStreak: streakData?.bestStreak ?? 0,
            weeklyGrid: grid
        )
    }

    private func samplePrayers() -> [MacPrayerData] { [] }
    private func sampleGrid() -> [DayDotData] { [] }
}

// MARK: - Widget Views

struct MacPrayerWidgetView: View {
    let entry: MacPrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallWidget
        case .systemMedium:
            mediumWidget
        case .systemLarge:
            largeWidget
        default:
            smallWidget
        }
    }

    // MARK: - Small: Next prayer countdown

    private var smallWidget: some View {
        VStack(spacing: 8) {
            Image(systemName: prayerIcon(entry.nextPrayer))
                .font(.title2)
                .foregroundStyle(.waqtuTeal)

            Text(entry.nextPrayer)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)

            Text(entry.countdown)
                .font(.title2.monospacedDigit().weight(.bold))
                .foregroundStyle(.waqtuTeal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(.clear, for: .widget)
    }

    // MARK: - Medium: Today's prayer timeline

    private var mediumWidget: some View {
        HStack(spacing: 0) {
            // Left: next prayer countdown
            VStack(spacing: 6) {
                Image(systemName: prayerIcon(entry.nextPrayer))
                    .font(.title3)
                    .foregroundStyle(.waqtuTeal)
                Text(entry.nextPrayer)
                    .font(.caption.weight(.medium))
                Text(entry.countdown)
                    .font(.title3.monospacedDigit().weight(.bold))
                    .foregroundStyle(.waqtuTeal)
            }
            .frame(width: 100)

            Divider()
                .padding(.vertical, 12)

            // Right: prayer timeline
            VStack(alignment: .leading, spacing: 4) {
                ForEach(entry.allPrayers, id: \.name) { prayer in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(prayer.hasPassed ? Color.gray.opacity(0.3) : Color.waqtuTeal)
                            .frame(width: 6, height: 6)

                        Text(prayer.name)
                            .font(.caption2)
                            .foregroundStyle(prayer.hasPassed ? Color.secondary : Color.primary)

                        Spacer()

                        Text(prayer.time.formatted(date: .omitted, time: .shortened))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(prayer.hasPassed ? Color.secondary : Color.secondary)
                    }
                }
            }
        }
        .padding()
        .containerBackground(.clear, for: .widget)
    }

    // MARK: - Large: Weekly streak + prayer timeline

    private var largeWidget: some View {
        VStack(spacing: 16) {
            // Next prayer header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next: \(entry.nextPrayer)")
                        .font(.headline)
                    Text("in \(entry.countdown)")
                        .font(.caption)
                        .foregroundStyle(.waqtuTeal)
                }
                Spacer()
            }

            // Streak stats
            HStack(spacing: 16) {
                streakBadge(
                    value: "\(entry.currentStreak)",
                    label: "Current",
                    color: .orange
                )
                streakBadge(
                    value: "\(entry.bestStreak)",
                    label: "Best",
                    color: .yellow
                )

                // Weekly grid
                VStack(alignment: .leading, spacing: 4) {
                    Text("This Week")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        ForEach(entry.weeklyGrid, id: \.label) { dot in
                            VStack(spacing: 2) {
                                Text(dot.symbol)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(dotColor(dot.symbol))
                                Text(dot.label)
                                    .font(.system(size: 8))
                                    .foregroundStyle(dot.isToday ? Color.waqtuTeal : Color.secondary)
                            }
                        }
                    }
                }
            }

            // Prayer timeline
            VStack(spacing: 8) {
                ForEach(entry.allPrayers, id: \.name) { prayer in
                    HStack(spacing: 10) {
                        Image(systemName: prayerIcon(prayer.name))
                            .font(.caption)
                            .foregroundStyle(prayer.hasPassed ? Color.secondary : Color.waqtuTeal)
                            .frame(width: 20)

                        Text(prayer.name)
                            .font(.caption)
                            .foregroundStyle(prayer.hasPassed ? Color.secondary : Color.primary)

                        Spacer()

                        Text(prayer.time.formatted(date: .omitted, time: .shortened))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(prayer.hasPassed ? Color.secondary : Color.secondary)
                            .strikethrough(prayer.hasPassed)
                    }
                }
            }
        }
        .padding()
        .containerBackground(.clear, for: .widget)
    }

    // MARK: - Helpers

    private func streakBadge(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
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

    private func dotColor(_ symbol: String) -> Color {
        switch symbol {
        case "●": return .waqtuTeal
        case "◐": return .orange
        case "○": return .red.opacity(0.6)
        default: return Color.secondary
        }
    }
}

// MARK: - Widget Definition

struct MacPrayerWidget: Widget {
    let kind = "com.waqtu.mac.widget"

    var body: some WidgetConfiguration {
        StaticConfiguration(
            kind: kind,
            provider: MacPrayerTimelineProvider()
        ) { entry in
            MacPrayerWidgetView(entry: entry)
        }
        .configurationDisplayName("Waqtu Prayer Times")
        .description("Next prayer countdown, daily timeline, and weekly streak.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Widget Bundle (macOS)

@main
struct MacWaqtuWidgets: WidgetBundle {
    var body: some Widget {
        MacPrayerWidget()
    }
}
