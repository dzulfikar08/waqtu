import SwiftUI
import WaqtuCore

struct TodayView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(PrayerReminderScheduler.self) private var reminders
    @State private var now = Date()
    @State private var locationError: String?
    @State private var locating = false
    private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            Group {
                if let times = settings.prayerTimes(on: now) {
                    List {
                        Section {
                            NextPrayerHeader(times: times, now: now)
                                .listRowBackground(Color.clear)
                        }
                        Section("Today") {
                            ForEach(Prayer.allCases) { prayer in
                                PrayerRow(
                                    prayer: prayer,
                                    clockText: times.clockText(for: prayer),
                                    isNext: times.nextPrayer(currentMinutes: settings.minutesSinceMidnight(of: now)).prayer == prayer
                                )
                            }
                        }
                    }
                } else {
                    ContentUnavailableView {
                        Label("No location yet", systemImage: "location.slash")
                    } description: {
                        Text("Waqtu calculates prayer times on device from your location. Your location is never sent anywhere.")
                    } actions: {
                        Button {
                            locate()
                        } label: {
                            Label(locating ? "Locating…" : "Use my location", systemImage: "location")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("Waqtu")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .alert("Could not get location", isPresented: Binding(
                get: { locationError != nil },
                set: { _ in locationError = nil }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(locationError ?? "")
            }
            .onReceive(timer) { now = $0 }
            .onChange(of: settings.coordinates) {
                reminders.scheduleIfNeeded(settings: settings)
            }
        }
    }

    private func locate() {
        locating = true
        Task {
            defer { locating = false }
            do {
                settings.coordinates = try await LocationProvider().requestCoordinates()
            } catch {
                locationError = error.localizedDescription
            }
        }
    }
}

private struct NextPrayerHeader: View {
    let times: PrayerTimes
    let now: Date
    @Environment(AppSettings.self) private var settings

    var body: some View {
        let current = settings.minutesSinceMidnight(of: now)
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
        let tomorrowTimes = settings.prayerTimes(on: tomorrow)
        let next = times.nextPrayer(
            currentMinutes: current,
            nextDayFajrMinutes: tomorrowTimes?.minutes(for: .fajr)
        )
        let wrapped = next.prayer == .fajr && current > times.minutes(for: .isha)
        let displayTimes = wrapped ? tomorrowTimes : times
        VStack(spacing: 6) {
            Text("Up next")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(next.prayer.displayName)
                .font(.largeTitle.bold())
                .contentTransition(.numericText())
            Text(countdownText(minutesUntil: next.minutesUntil))
                .font(.title3.monospacedDigit())
                .foregroundStyle(.tint)
            if let displayTimes {
                Text(displayTimes.clockText(for: next.prayer))
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    private func countdownText(minutesUntil remaining: Int) -> String {
        let h = remaining / 60
        let m = remaining % 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }
}

private struct PrayerRow: View {
    let prayer: Prayer
    let clockText: String
    let isNext: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(prayer.displayName)
                    .fontWeight(isNext ? .semibold : .regular)
                Text(prayer.arabicName)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(clockText)
                .monospacedDigit()
                .fontWeight(isNext ? .semibold : .regular)
            if isNext {
                Image(systemName: "bell.fill")
                    .font(.footnote)
                    .foregroundStyle(.tint)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(prayer.displayName) at \(clockText)")
    }
}

#Preview {
    TodayView().environment(AppSettings())
}
