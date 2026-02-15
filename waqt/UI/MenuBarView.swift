import SwiftUI
import AppKit

// MARK: - Mutabaah-inspired Colors
extension Color {
    static let waqtPrimary = Color(hex: "#4A8B6F")
    static let waqtLight = Color(hex: "#6BA888")
    static let waqtDark = Color(hex: "#2D5F4C")
    static let waqtBackground = Color(hex: "#1A2E25")
    static let waqtGold = Color(hex: "#D4A574")
    static let waqtText = Color(hex: "#E8F0ED")
    static let waqtMuted = Color(hex: "#A8C9B8")
}

struct MenuBarView: View {
    @Bindable var viewModel: AppViewModel
    @State private var showingSettings = false

    init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    var body: some View {
        VStack(spacing: 0) {
            // Next prayer header
            NextPrayerHeader(
                nextPrayer: viewModel.nextPrayer,
                countdown: viewModel.countdown
            )

            Divider()

            // Prayer times list
            PrayerTimesList(
                prayers: viewModel.todayPrayers,
                nextPrayerId: viewModel.nextPrayer?.id
            )

            Divider()

            // Controls
            ControlsSection(
                overlayEnabled: $viewModel.settings.overlayEnabled,
                onTestOverlay: { viewModel.showTestOverlay() }
            )

            Divider()

            // Bottom buttons
            BottomButtons(
                onSettings: { showingSettings = true }
            )
        }
        .frame(width: 280)
        .background(Color.waqtBackground)
        .sheet(isPresented: $showingSettings) {
            SettingsView(settings: viewModel.settings)
        }
    }
}

// MARK: - Next Prayer Header
struct NextPrayerHeader: View {
    let nextPrayer: PrayerTime?
    let countdown: Int

    var body: some View {
        Group {
            if let next = nextPrayer {
                HStack {
                    Image(systemName: next.name.iconName)
                        .foregroundColor(.waqtGold)
                        .font(.system(size: 14))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(next.name.displayName.uppercased())
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.waqtMuted)

                        Text(next.time, style: .time)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.waqtText)
                    }

                    Spacer()

                    CountdownView(countdown: countdown)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color.waqtDark.opacity(0.5))
            } else {
                Text("Loading...")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtMuted)
                    .padding()
            }
        }
    }
}

// MARK: - Countdown View
struct CountdownView: View {
    let countdown: Int

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("in")
                .font(.system(size: 9))
                .foregroundColor(.waqtMuted)

            Text(countdownText)
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .foregroundColor(.waqtPrimary)
        }
    }

    private var countdownText: String {
        let hours = countdown / 3600
        let minutes = (countdown % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }
}

// MARK: - Prayer Times List
struct PrayerTimesList: View {
    let prayers: [PrayerTime]
    let nextPrayerId: UUID?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(prayers) { prayer in
                PrayerRow(prayer: prayer, isNext: prayer.id == nextPrayerId)
                if prayer.id != prayers.last?.id {
                    Divider().padding(.leading, 36)
                }
            }
        }
    }
}

// MARK: - Prayer Row
struct PrayerRow: View {
    let prayer: PrayerTime
    let isNext: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: prayer.hasPassed ? "circle" : "circle.fill")
                .foregroundColor(prayer.hasPassed ? .waqtMuted : .waqtPrimary)
                .font(.system(size: 10))

            Text(prayer.name.displayName)
                .font(.system(size: 13))
                .foregroundColor(prayer.hasPassed ? .waqtMuted.opacity(0.7) : .waqtText)

            Spacer()

            Text(prayer.time, style: .time)
                .font(.system(size: 12))
                .foregroundColor(prayer.hasPassed ? .waqtMuted.opacity(0.7) : .waqtText)

            if isNext {
                Image(systemName: "circle.fill")
                    .font(.system(size: 4))
                    .foregroundColor(.waqtGold)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(isNext ? Color.waqtPrimary.opacity(0.1) : Color.clear)
    }
}

// MARK: - Controls Section
struct ControlsSection: View {
    @Binding var overlayEnabled: Bool
    let onTestOverlay: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Overlay toggle
            HStack {
                Image(systemName: "bell")
                    .foregroundColor(.waqtGold)
                    .font(.system(size: 12))
                Text("Enable Overlay")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtText)
                Spacer()
                Toggle("", isOn: $overlayEnabled)
                    .toggleStyle(.switch)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()

            // Test overlay button
            Button(action: onTestOverlay) {
                HStack {
                    Image(systemName: "play.circle")
                        .foregroundColor(.waqtPrimary)
                        .font(.system(size: 12))
                    Text("Test Overlay")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtText)
                    Spacer()
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.waqtPrimary.opacity(0.1))
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Bottom Buttons
struct BottomButtons: View {
    let onSettings: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onSettings) {
                HStack {
                    Text("Settings")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtText)
                    Spacer()
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.waqtPrimary.opacity(0.1))
            .buttonStyle(.plain)

            Divider()

            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                HStack {
                    Text("Quit")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtMuted)
                    Spacer()
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @Bindable var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            // Header
            HStack {
                Image(systemName: "gearshape")
                    .foregroundColor(.waqtGold)
                    .font(.system(size: 20))
                Text("Settings")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.waqtText)
                Spacer()
            }
            .padding(.bottom, 8)

            // Overlay settings
            SettingsSection(title: "OVERLAY", icon: "bell") {
                Toggle("Enable Overlay", isOn: $settings.overlayEnabled)
                    .font(.system(size: 14))
                    .foregroundColor(.waqtText)
                    .toggleStyle(.switch)

                Button("Test Overlay") {
                    showTestOverlay()
                }
                .buttonStyle(.bordered)
                .tint(.waqtPrimary)

                DurationSlider(settings: settings)
            }

            Divider()

            // Location settings
            SettingsSection(title: "LOCATION", icon: "location") {
                Toggle("Auto-detect", isOn: $settings.autoDetectLocation)
                    .font(.system(size: 14))
                    .foregroundColor(.waqtText)
                    .toggleStyle(.switch)

                if !settings.autoDetectLocation {
                    LocationInputs(settings: settings)
                }
            }

            Divider()

            // Launch at login
            HStack {
                Image(systemName: "power")
                    .foregroundColor(.waqtGold)
                    .font(.system(size: 14))
                Toggle("Launch at Login", isOn: $settings.launchAtLogin)
                    .font(.system(size: 14))
                    .foregroundColor(.waqtText)
                    .toggleStyle(.switch)
            }

            Divider()

            // Quranic quote
            QuoteSection()

            Spacer()

            // Done button
            HStack {
                Spacer()
                Button("Done") { dismiss() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 12)
                    .background(
                        LinearGradient(
                            colors: [.waqtPrimary, .waqtLight],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(8)
            }
        }
        .padding(24)
        .frame(width: 400, height: 520)
        .background(Color.waqtBackground)
    }

    private func showTestOverlay() {
        let testWindow = OverlayWindow(
            prayerName: .maghrib,
            durationMinutes: settings.overlayDuration
        ) {}
        testWindow.makeKeyAndOrderFront(nil)
    }
}

// MARK: - Settings Components
struct SettingsSection<Content: View>: View {
    let title: String
    let icon: String
    let content: Content

    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.waqtGold)
                    .font(.system(size: 14))
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.waqtMuted)
                    .tracking(1)
            }

            content
        }
    }
}

struct DurationSlider: View {
    @Bindable var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Duration")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtText)
                Spacer()
                Text("\(settings.overlayDuration) min")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.waqtPrimary)
            }

            Slider(value: Binding(
                get: { Double(settings.overlayDuration) },
                set: { settings.overlayDuration = Int($0) }
            ), in: 5...15, step: 1)
            .tint(.waqtPrimary)

            HStack {
                Text("5")
                    .font(.system(size: 11))
                    .foregroundColor(.waqtMuted)
                Spacer()
                Text("15")
                    .font(.system(size: 11))
                    .foregroundColor(.waqtMuted)
            }
        }
        .padding(.leading, 24)
    }
}

struct LocationInputs: View {
    @Bindable var settings: AppSettings

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Latitude")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtMuted)
                    .frame(width: 60, alignment: .leading)
                TextField("", value: $settings.manualLatitude, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 100)
            }

            HStack {
                Text("Longitude")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtMuted)
                    .frame(width: 60, alignment: .leading)
                TextField("", value: $settings.manualLongitude, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 100)
            }

            Button("Apply Location") {
                NotificationCenter.default.post(name: Notification.Name("locationChanged"), object: nil)
            }
            .buttonStyle(.bordered)
            .tint(.waqtPrimary)
        }
    }
}

struct QuoteSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "quote.opening")
                    .foregroundColor(.waqtGold)
                    .font(.system(size: 12))
                Text("DAILY REMINDER")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.waqtMuted)
                    .tracking(1)
            }

            Text(AppSettings.quranicQuote)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.waqtText)
                .padding(.leading, 20)

            Text(AppSettings.quranicReference)
                .font(.system(size: 12))
                .foregroundColor(.waqtGold)
                .padding(.leading, 20)
        }
    }
}

// MARK: - Color Extension
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
