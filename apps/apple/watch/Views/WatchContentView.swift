import SwiftUI

/// Main watch app view — shows next prayer countdown and prayer list.
struct WatchContentView: View {
    @Bindable var viewModel: WatchViewModel

    var body: some View {
        NavigationStack {
            List {
                // Next prayer card
                if let next = viewModel.nextPrayer {
                    nextPrayerSection(next)
                }

                // All prayers
                Section("Today's Prayers") {
                    ForEach(viewModel.prayers) { prayer in
                        WatchPrayerRow(
                            prayer: prayer,
                            isNext: prayer.name == viewModel.nextPrayer?.name,
                            isPassed: prayer.hasPassed
                        )
                    }
                }
            }
            .navigationTitle(viewModel.locationLabel)
        }
        .onAppear {
            viewModel.loadCachedData()
        }
    }

    private func nextPrayerSection(_ prayer: PrayerTime) -> some View {
        Section {
            VStack(spacing: 6) {
                HStack(spacing: 4) {
                    Image(systemName: prayer.name.symbolName)
                        .foregroundStyle(.waqtuTeal)
                    Text(prayer.name.displayName)
                        .fontWeight(.semibold)
                }

                Text(viewModel.countdown)
                    .font(.system(.title, design: .rounded).weight(.bold))
                    .foregroundStyle(.waqtuTeal)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
    }
}

// MARK: - Prayer Row

struct WatchPrayerRow: View {
    let prayer: PrayerTime
    let isNext: Bool
    let isPassed: Bool

    var body: some View {
        HStack {
            Image(systemName: prayer.name.symbolName)
                .font(.caption)
                .foregroundStyle(isNext ? .waqtuTeal : .secondary)
                .frame(width: 20)

            Text(prayer.name.displayName)
                .font(.caption)
                .foregroundStyle(isPassed ? .secondary : .primary)
                .strikethrough(isPassed)

            Spacer()

            Text(prayer.time.formatted(date: .omitted, time: .shortened))
                .font(.caption.monospacedDigit())
                .foregroundStyle(isPassed ? Color.secondary : (isNext ? Color.waqtuTeal : Color.primary))
        }
    }
}
