import SwiftUI

/// Weekly heatmap and streak stats view.
struct StreakView: View {
    @Bindable var viewModel: IOSAppViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Streak stats cards
                    HStack(spacing: 12) {
                        streakCard(
                            title: "Current Streak",
                            value: "\(viewModel.currentStreak)",
                            subtitle: "days",
                            icon: "flame.fill",
                            color: .orange
                        )

                        streakCard(
                            title: "Best Streak",
                            value: "\(viewModel.bestStreak)",
                            subtitle: "days",
                            icon: "trophy.fill",
                            color: .yellow
                        )
                    }

                    // Today's progress
                    todayProgressCard

                    // Weekly grid
                    weeklyGridView

                    Spacer()
                }
                .padding()
            }
            .background(Color.waqtuSurface)
            .navigationTitle("Streaks")
        }
    }

    // MARK: - Streak Card

    private func streakCard(
        title: String,
        value: String,
        subtitle: String,
        icon: String,
        color: Color
    ) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)

            Text(value)
                .font(.system(.largeTitle, design: .rounded).weight(.bold))
                .foregroundStyle(.primary)

            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(title)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(.waqtuSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Today Progress

    private var todayProgressCard: some View {
        VStack(spacing: 8) {
            Text("Today's Progress")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

            HStack(spacing: 4) {
                Text("\(viewModel.todayProgress.prayed)")
                    .font(.title.weight(.bold))
                    .foregroundStyle(.waqtuTeal)
                Text("/ \(viewModel.todayProgress.total)")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("prayers")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.waqtuTeal.opacity(0.15))
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.waqtuTeal)
                        .frame(
                            width: geometry.size.width * progressFraction,
                            height: 8
                        )
                }
            }
            .frame(height: 8)
        }
        .padding(20)
        .background(.waqtuSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var progressFraction: CGFloat {
        guard viewModel.todayProgress.total > 0 else { return 0 }
        return min(CGFloat(viewModel.todayProgress.prayed) / CGFloat(viewModel.todayProgress.total), 1)
    }

    // MARK: - Weekly Grid

    private var weeklyGridView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("This Week")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

            if viewModel.weeklyGrid.isEmpty {
                Text("Prayer data will appear here when synced from the Mac app.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                HStack(spacing: 0) {
                    ForEach(viewModel.weeklyGrid) { dot in
                        VStack(spacing: 8) {
                            Text(dot.symbol)
                                .font(.title2.monospaced())
                                .foregroundStyle(dotColor(for: dot))

                            Text(dot.label)
                                .font(.caption2)
                                .foregroundStyle(dot.isToday ? Color.waqtuTeal : Color.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(20)
        .background(.waqtuSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func dotColor(for dot: StreakData.DayDot) -> Color {
        switch dot.status {
        case .complete: return .waqtuTeal
        case .partial: return .orange
        case .missed: return .red.opacity(0.6)
        case .empty: return Color.secondary
        }
    }
}
