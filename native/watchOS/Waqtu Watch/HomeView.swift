import SwiftUI
import WaqtuCore

struct HomeView: View {
    @State private var now = Date()
    @State private var locating = false
    private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            Group {
                if SharedPrayerSettings.coordinates == nil {
                    noLocationPrompt
                } else {
                    timesList
                }
            }
            .navigationTitle("Waqtu")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        WatchSettingsView()
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .onReceive(timer) { now = $0 }
        }
    }

    private var noLocationPrompt: some View {
        VStack(spacing: 8) {
            Image(systemName: "location.slash")
                .font(.title2)
            Text("Location needed for prayer times. Calculated on device only.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button {
                locate()
            } label: {
                Label(locating ? "Locating…" : "Use my location", systemImage: "location")
            }
        }
        .padding(.horizontal)
    }

    private var timesList: some View {
        List {
            if let times = SharedPrayerSettings.prayerTimes(on: now) {
                let current = SharedPrayerSettings.minutesSinceMidnight(of: now)
                let next = times.nextPrayer(currentMinutes: current)
                Section {
                    VStack(spacing: 2) {
                        Text(next.prayer.displayName)
                            .font(.headline)
                        Text(countdown(minutesUntil: next.minutesUntil))
                            .font(.title2.monospacedDigit())
                            .foregroundStyle(.tint)
                        Text(times.clockText(for: next.prayer))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
                .listRowBackground(Color.clear)
                Section {
                    ForEach(Prayer.allCases) { prayer in
                        HStack {
                            Text(prayer.displayName)
                            Spacer()
                            Text(times.clockText(for: prayer))
                                .foregroundStyle(
                                    prayer == next.prayer ? Color.accentColor : .secondary
                                )
                        }
                        .font(.callout)
                    }
                }
            }
        }
    }

    private func countdown(minutesUntil remaining: Int) -> String {
        let h = remaining / 60
        let m = remaining % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    private func locate() {
        locating = true
        Task {
            defer { locating = false }
            if let coordinates = try? await WatchLocationProvider().requestCoordinates() {
                SharedPrayerSettings.store(coordinates: coordinates)
            }
        }
    }
}

struct WatchSettingsView: View {
    @AppStorage("calculationMethod") private var methodRaw = CalculationMethod.muslimWorldLeague.rawValue
    @AppStorage("madhab") private var madhabRaw = Madhab.shafi.rawValue

    var body: some View {
        Form {
            Picker("Method", selection: $methodRaw) {
                ForEach(CalculationMethod.allCases) { method in
                    Text(method.displayName).tag(method.rawValue)
                }
            }
            Picker("Asr", selection: $madhabRaw) {
                ForEach(Madhab.allCases) { madhab in
                    Text(madhab.displayName).tag(madhab.rawValue)
                }
            }
        }
        .navigationTitle("Settings")
    }
}
