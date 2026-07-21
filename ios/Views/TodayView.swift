import SwiftUI

/// Today's prayer times view — the main screen of the iOS companion app.
struct TodayView: View {
    @Bindable var viewModel: IOSAppViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header: location + date
                    headerSection

                    // Next prayer countdown card
                    if let next = viewModel.nextPrayer {
                        nextPrayerCard(next)
                    }

                    // All prayer times list
                    prayerTimesList
                }
                .padding()
            }
            .background(Color.waqtuSurface)
            .navigationTitle("Prayer Times")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.refresh()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .refreshable {
                viewModel.refresh()
            }
        }
    }

    // MARK: - Subviews

    private var headerSection: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: "location.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(viewModel.locationLabel)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Text(todayFormatted)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private func nextPrayerCard(_ prayer: PrayerTime) -> some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: prayer.name.symbolName)
                    .font(.title2)
                    .foregroundStyle(.waqtuTeal)
                Text(prayer.name.displayName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)
            }

            Text("in \(viewModel.countdown)")
                .font(.system(.largeTitle, design: .rounded).weight(.bold))
                .foregroundStyle(.waqtuTeal)
                .contentTransition(.numericText())

            Text(prayer.time.formatted(date: .omitted, time: .shortened))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(.waqtuSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 10, y: 4)
    }

    private var prayerTimesList: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.todayPrayers) { prayer in
                PrayerTimeRow(
                    prayer: prayer,
                    isNext: prayer.name == viewModel.nextPrayer?.name && !prayer.hasPassed,
                    isPassed: prayer.hasPassed
                )

                if prayer != viewModel.todayPrayers.last {
                    Divider()
                        .padding(.leading, 52)
                }
            }

            if viewModel.todayPrayers.isEmpty {
                ContentUnavailableView(
                    "No Prayer Times",
                    systemImage: "clock.badge.questionmark",
                    description: Text("Pull to refresh or check your location settings.")
                )
            }
        }
        .background(.waqtuSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var todayFormatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d, yyyy"
        return formatter.string(from: Date())
    }
}

// MARK: - Prayer Time Row

struct PrayerTimeRow: View {
    let prayer: PrayerTime
    let isNext: Bool
    let isPassed: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: prayer.name.symbolName)
                .font(.title3)
                .frame(width: 28)
                .foregroundStyle(isNext ? Color.waqtuTeal : .secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(prayer.name.displayName)
                    .font(.body.weight(isNext ? .semibold : .regular))
                    .foregroundStyle(isPassed ? .secondary : .primary)

                if isNext {
                    Text("Next prayer")
                        .font(.caption2)
                        .foregroundStyle(.waqtuTeal)
                }
            }

            Spacer()

            Text(prayer.time.formatted(date: .omitted, time: .shortened))
                .font(.body.monospacedDigit())
                .foregroundStyle(isPassed ? Color.secondary : Color.primary)
                .strikethrough(isPassed, color: .secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(isNext ? Color.waqtuTeal.opacity(0.08) : .clear)
    }
}
