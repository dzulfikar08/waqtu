import SwiftUI
import AppKit
import EventKit

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
            BottomButtons()
        }
        .frame(width: 320)
        .background(Color.waqtBackground)
    }
}

// MARK: - Next Prayer Header
struct NextPrayerHeader: View {
    let nextPrayer: PrayerTime?
    let countdown: Int

    var body: some View {
        Group {
            if let next = nextPrayer {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next Prayer")
                        .font(.system(size: 11))
                        .foregroundColor(.waqtMuted)

                    HStack {
                        Text(next.name.displayName)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.waqtText)

                        Spacer()

                        Text(countdownText)
                            .font(.system(size: 14, weight: .semibold))
                            .monospacedDigit()
                            .foregroundColor(.waqtGold)
                    }
                }
                .padding(12)
            } else {
                Text("Loading...")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtMuted)
                    .padding()
            }
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
        VStack(spacing: 4) {
            ForEach(prayers) { prayer in
                PrayerRow(prayer: prayer, isNext: prayer.id == nextPrayerId)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

// MARK: - Prayer Row
struct PrayerRow: View {
    let prayer: PrayerTime
    let isNext: Bool
    @State private var isHovering = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: prayer.name.iconName)
                .font(.system(size: 14))
                .foregroundColor(isNext ? .waqtGold : .waqtMuted)
                .frame(width: 18)

            Text(prayer.name.displayName)
                .font(.system(size: 13, weight: isNext ? .semibold : .regular))
                .foregroundColor(prayer.hasPassed ? .waqtMuted.opacity(0.4) : .waqtText)
                .lineLimit(1)

            Spacer(minLength: 8)

            Text(prayer.time.formatted(date: .omitted, time: .shortened))
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundColor(prayer.hasPassed ? .waqtMuted.opacity(0.4) : (isNext ? .waqtGold : .waqtText))
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(
            isNext ? Color.waqtPrimary.opacity(0.12) : (isHovering ? Color.waqtPrimary.opacity(0.06) : Color.clear)
        )
        .cornerRadius(8)
        .contentShape(Rectangle())
        .onHover { hovering in
            isHovering = hovering
        }
    }
}

// MARK: - Controls Section
struct ControlsSection: View {
    @Binding var overlayEnabled: Bool
    let onTestOverlay: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Overlay toggle - bell, text, and switch on one line
            HStack(spacing: 0) {
                HStack(spacing: 10) {
                    Image(systemName: "bell")
                        .foregroundColor(.waqtGold)
                        .font(.system(size: 12))
                        .frame(width: 18, alignment: .center)
                    Text("Enable Overlay")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtText)
                }
                Spacer(minLength: 8)
                Toggle(isOn: $overlayEnabled) { EmptyView() }
                    .toggleStyle(.switch)
                    .labelsHidden()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

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
            .buttonStyle(ControlRowButtonStyle())
        }
    }
}

// MARK: - Control Row Button Style
struct ControlRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(
                configuration.isPressed
                    ? Color.waqtPrimary.opacity(0.12)
                    : Color.clear
            )
    }
}

// MARK: - Bottom Buttons
struct BottomButtons: View {
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        VStack(spacing: 0) {
            Button(action: {
                NSApp.activate(ignoringOtherApps: true)
                openSettings()
            }) {
                HStack {
                    Text("Settings")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtText)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 28)
                .contentShape(Rectangle())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            .buttonStyle(ControlRowButtonStyle())

            Button {
                NSApplication.shared.terminate(nil)
            } label: {
                HStack {
                    Text("Quit")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtMuted)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 28)
                .contentShape(Rectangle())
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            .buttonStyle(ControlRowButtonStyle())
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @Bindable var settings: AppSettings
    var viewModel: AppViewModel?

    init(settings: AppSettings, viewModel: AppViewModel? = nil) {
        self.settings = settings
        self.viewModel = viewModel
    }

    var body: some View {
        TabView {
            GeneralSettingsTab(settings: settings, viewModel: viewModel)
                .tabItem {
                    Label("General", systemImage: "gearshape.fill")
                }

            LocationSettingsTab(settings: settings)
                .tabItem {
                    Label("Location", systemImage: "location.fill")
                }

            AboutSettingsTab()
                .tabItem {
                    Label("About", systemImage: "info.circle.fill")
                }
        }
        .frame(width: 440, height: 520)
        .background(Color.waqtBackground)
        .onAppear {
            NSApp.activate(ignoringOtherApps: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                NSApp.keyWindow?.makeKeyAndOrderFront(nil)
            }
        }
    }
}

// MARK: - General Settings Tab
struct GeneralSettingsTab: View {
    @Bindable var settings: AppSettings
    var viewModel: AppViewModel?
    @State private var showCalendarExplanation = false
    @State private var showRemoveWaqtEventsAlert = false
    @State private var calendarManager = CalendarManager()
    @State private var calendarsGroupedBySource: [(source: EKSource, calendars: [EKCalendar])] = []

    var body: some View {
        Form {
            Section {
                Toggle("Enable Overlay", isOn: $settings.overlayEnabled)
                Text("Show a full-screen notification when it's time for prayer.")
                    .font(.caption)
                    .foregroundColor(.waqtMuted)

                if settings.overlayEnabled {
                    HStack {
                        Text("Duration")
                        Spacer()
                        Text("\(settings.overlayDuration) min")
                            .foregroundColor(.waqtPrimary)
                            .monospacedDigit()
                        Slider(value: Binding(
                            get: { Double(settings.overlayDuration) },
                            set: { settings.overlayDuration = Int($0) }
                        ), in: 5...15, step: 1)
                        .frame(width: 120)
                        .tint(.waqtPrimary)
                    }
                    Text("How long the overlay stays visible (5–15 minutes).")
                        .font(.caption)
                        .foregroundColor(.waqtMuted)

                    Button("Test Overlay") { showTestOverlay() }
                        .buttonStyle(.bordered)
                        .tint(.waqtPrimary)
                }
            } header: {
                Text("Prayer Reminders")
            }

            CalendarProtectionSection(
                settings: settings,
                calendarsGroupedBySource: calendarsGroupedBySource,
                onEnableFirstTime: {
                    if !settings.hasSeenCalendarProtectionExplanation {
                        showCalendarExplanation = true
                    }
                    viewModel?.requestCalendarAccessAndRegenerate()
                },
                onRemoveAllWaqtEvents: {
                    showRemoveWaqtEventsAlert = true
                }
            )

            Section {
                Toggle("Launch at Login", isOn: $settings.launchAtLogin)
                Text("Start Waqt automatically when you log in.")
                    .font(.caption)
                    .foregroundColor(.waqtMuted)
            } header: {
                Text("Startup")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtBackground)
        .padding()
        .onAppear {
            calendarsGroupedBySource = calendarManager.calendarsGroupedBySource()
        }
        .alert("Calendar Protection", isPresented: $showCalendarExplanation) {
            Button("OK") {
                settings.hasSeenCalendarProtectionExplanation = true
            }
        } message: {
            Text("Waqt will create daily prayer blocks in your calendar so you appear busy during prayer times. Events are recreated every day to match changing prayer times.")
        }
        .alert("Remove All Waqt Events?", isPresented: $showRemoveWaqtEventsAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Remove All", role: .destructive) {
                viewModel?.removeAllWaqtEvents()
            }
        } message: {
            Text("This will delete all prayer block events created by Waqt from your calendar. Your other events are not affected.")
        }
    }

    private func showTestOverlay() {
        let testWindow = OverlayWindow(
            prayerName: .maghrib,
            durationMinutes: settings.overlayDuration
        ) {}
        testWindow.makeKeyAndOrderFront(nil)
    }
}

// MARK: - Calendar Protection Section
struct CalendarProtectionSection: View {
    @Bindable var settings: AppSettings
    let calendarsGroupedBySource: [(source: EKSource, calendars: [EKCalendar])]
    let onEnableFirstTime: () -> Void
    let onRemoveAllWaqtEvents: () -> Void

    private var selectedCalendarTitle: String {
        if settings.calendarProtectionCalendarId.isEmpty { return "Default" }
        let allCalendars = calendarsGroupedBySource.flatMap(\.calendars)
        return allCalendars.first(where: { $0.calendarIdentifier == settings.calendarProtectionCalendarId })?.title ?? "Default"
    }

    var body: some View {
        Section {
            Toggle("Block calendar during prayer", isOn: Binding(
                get: { settings.calendarProtectionEnabled },
                set: { newValue in
                    settings.calendarProtectionEnabled = newValue
                    if newValue { onEnableFirstTime() }
                }
            ))
            Text("Create daily busy blocks for each prayer so Outlook and Teams show you as busy. Events are recreated every day.")
                .font(.caption)
                .foregroundColor(.waqtMuted)

            if settings.calendarProtectionEnabled {
                HStack {
                    Text("Block duration")
                    Spacer()
                    Text("\(settings.calendarBlockDuration) min")
                        .foregroundColor(.waqtPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.calendarBlockDuration) },
                        set: { settings.calendarBlockDuration = Int($0) }
                    ), in: 10...20, step: 1)
                    .frame(width: 120)
                    .tint(.waqtPrimary)
                }
                .onChange(of: settings.calendarBlockDuration) { _, _ in
                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                }
                Text("Length of each prayer block (10–20 minutes).")
                    .font(.caption)
                    .foregroundColor(.waqtMuted)

                Toggle("Add 5 min reminder", isOn: $settings.calendarProtectionReminder)
                    .onChange(of: settings.calendarProtectionReminder) { _, _ in
                        NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                    }
                Text("Alert 5 minutes before each prayer block.")
                    .font(.caption)
                    .foregroundColor(.waqtMuted)

                Menu {
                    Button("Default") {
                        settings.calendarProtectionCalendarId = ""
                        NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                    }
                    ForEach(calendarsGroupedBySource, id: \.source.sourceIdentifier) { group in
                        Section(header: Text(group.source.title)) {
                            ForEach(group.calendars, id: \.calendarIdentifier) { cal in
                                Button(cal.title) {
                                    settings.calendarProtectionCalendarId = cal.calendarIdentifier
                                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                                }
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text("Calendar")
                        Spacer()
                        Text(selectedCalendarTitle)
                            .foregroundColor(.waqtMuted)
                    }
                }
                .onChange(of: settings.calendarProtectionCalendarId) { _, _ in
                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                }

                Button("Remove all Waqt events from calendar", role: .destructive) {
                    onRemoveAllWaqtEvents()
                }
                .font(.caption)
            }
        } header: {
            Text("Calendar Protection")
        }
    }
}

// MARK: - Location Settings Tab
struct LocationSettingsTab: View {
    @Bindable var settings: AppSettings

    var body: some View {
        Form {
            Section {
                Toggle("Auto-detect Location", isOn: $settings.autoDetectLocation)
                Text("Use your Mac's location for accurate prayer times.")
                    .font(.caption)
                    .foregroundColor(.waqtMuted)
            } header: {
                Text("Location Source")
            }

            if !settings.autoDetectLocation {
                Section {
                    HStack {
                        Text("Latitude")
                            .frame(width: 80, alignment: .leading)
                        TextField("", value: $settings.manualLatitude, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 120)
                    }
                    HStack {
                        Text("Longitude")
                            .frame(width: 80, alignment: .leading)
                        TextField("", value: $settings.manualLongitude, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 120)
                    }
                    Button("Apply Location") {
                        NotificationCenter.default.post(name: Notification.Name("locationChanged"), object: nil)
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtPrimary)
                } header: {
                    Text("Manual Coordinates")
                } footer: {
                    Text("Enter coordinates if auto-detect is unavailable. Example: Mecca 21.4225, 39.8262")
                }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtBackground)
        .padding()
    }
}

// MARK: - About Settings Tab
struct AboutSettingsTab: View {
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image("AppLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 80, height: 80)
            Text("Waqt")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.waqtText)
            Text("Prayer times for your day")
                .font(.system(size: 14))
                .foregroundColor(.waqtMuted)

            VStack(alignment: .leading, spacing: 12) {
                Text(AppSettings.quranicQuote)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.waqtText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                Text(AppSettings.quranicReference)
                    .font(.system(size: 13))
                    .foregroundColor(.waqtGold)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .background(Color.waqtDark.opacity(0.4))
            .cornerRadius(12)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .background(Color.waqtBackground)
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
