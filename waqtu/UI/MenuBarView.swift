import SwiftUI
import AppKit
import EventKit

// MARK: - Mutabaah-inspired Colors
extension Color {
    static let waqtuPrimary = Color(hex: "#4A8B6F")
    static let waqtuLight = Color(hex: "#6BA888")
    static let waqtuDark = Color(hex: "#2D5F4C")
    static let waqtuBackground = Color(hex: "#1A2E25")
    static let waqtuGold = Color(hex: "#D4A574")
    static let waqtuText = Color(hex: "#E8F0ED")
    static let waqtuMuted = Color(hex: "#A8C9B8")
}

struct MenuBarView: View {
    @Bindable var viewModel: AppViewModel
    @State private var showTrialEndingSoonModal = false

    init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    var body: some View {
        if viewModel.hasAccess {
            menuBarContent
        } else {
            TrialExpiredMenuView()
        }
    }

    private var menuBarContent: some View {
        VStack(spacing: 0) {
            // Trial banner only when not licensed
            if !viewModel.licenseManager.isLicensed, viewModel.trialManager.trialDaysRemaining >= 2 {
                TrialBannerView(daysRemaining: viewModel.trialManager.trialDaysRemaining)
            }

            // Next prayer header
            NextPrayerHeader(
                nextPrayer: viewModel.nextPrayer,
                countdown: viewModel.countdown
            )

            // Location used for prayer times
            LocationDisplayView(
                locationDisplay: viewModel.locationDisplay,
                showLocateMe: viewModel.settings.autoDetectLocation,
                isRefreshing: viewModel.isRefreshingLocation,
                onLocateMe: { viewModel.refreshLocation() }
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
        .background(Color.waqtuBackground)
        .onAppear {
            if viewModel.trialManager.shouldShowTrialEndingSoonModal {
                showTrialEndingSoonModal = true
            }
        }
        .sheet(isPresented: $showTrialEndingSoonModal) {
            TrialEndingSoonModal(trialManager: viewModel.trialManager) {
                viewModel.trialManager.recordTrialEndingSoonModalShown()
                showTrialEndingSoonModal = false
            }
        }
    }
}

// MARK: - Trial banner (Day 1–5: subtle)
struct TrialBannerView: View {
    let daysRemaining: Int

    var body: some View {
        Text("\(daysRemaining) day\(daysRemaining == 1 ? "" : "s") remaining")
            .font(.system(size: 11))
            .foregroundColor(.waqtuMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(Color.waqtuDark.opacity(0.4))
    }
}

// MARK: - Day 6: Trial ending soon modal
struct TrialEndingSoonModal: View {
    let trialManager: TrialManager
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Trial ending soon")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.waqtuText)
            Text("Your trial ends tomorrow. Upgrade anytime to keep using Waqtu.")
                .font(.system(size: 14))
                .foregroundColor(.waqtuMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button("Got it", action: onDismiss)
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
        }
        .frame(width: 320)
        .padding(28)
        .background(Color.waqtuBackground)
    }
}

// MARK: - Day 7: Trial expired (menu bar → Upgrade)
struct TrialExpiredMenuView: View {
    var body: some View {
        VStack(spacing: 14) {
            Text("Upgrade to keep using Waqtu.")
                .font(.system(size: 13))
                .foregroundColor(.waqtuText)
                .multilineTextAlignment(.center)
            Button("Upgrade") {
                openUpgradeWindow()
            }
            .buttonStyle(.borderedProminent)
            .tint(.waqtuPrimary)
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .font(.system(size: 12))
            .foregroundColor(.waqtuMuted)
        }
        .frame(width: 260)
        .padding(20)
        .background(Color.waqtuBackground)
    }

    private func openUpgradeWindow() {
        NSApp.activate(ignoringOtherApps: true)
        if NSApp.responds(to: Selector(("showSettingsWindow:"))) {
            NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
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
                VStack(alignment: .leading, spacing: 2) {
                    Text("Next Prayer")
                        .font(.system(size: 11))
                        .foregroundColor(.waqtuMuted)

                    HStack {
                        Text(next.name.displayName)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.waqtuText)

                        Spacer()

                        Text(countdownText)
                            .font(.system(size: 14, weight: .semibold))
                            .monospacedDigit()
                            .foregroundColor(.waqtuGold)
                    }
                }
                .padding(12)
            } else {
                Text("Loading...")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtuMuted)
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

// MARK: - Location Display
struct LocationDisplayView: View {
    let locationDisplay: String
    var showLocateMe: Bool = false
    var isRefreshing: Bool = false
    var onLocateMe: (() -> Void)?

    private var hijriDateString: String {
        let calendar = Calendar(identifier: .islamicUmmAlQura)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.dateFormat = "d MMMM yyyy"
        formatter.locale = Locale(identifier: "en")
        return formatter.string(from: Date())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "location.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.waqtuMuted)
                Text(locationDisplay)
                    .font(.system(size: 11))
                    .foregroundColor(.waqtuMuted)
                    .lineLimit(1)

                if showLocateMe, let onLocateMe {
                    Spacer(minLength: 4)
                    Button(action: onLocateMe) {
                        Image(systemName: isRefreshing ? "arrow.clockwise" : "location.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.waqtuPrimary)
                            .symbolEffect(.rotate, value: isRefreshing)
                    }
                    .buttonStyle(.plain)
                    .disabled(isRefreshing)
                }
            }

            Text(hijriDateString)
                .font(.system(size: 10))
                .foregroundColor(.waqtuMuted.opacity(0.9))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
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
                .foregroundColor(isNext ? .waqtuGold : .waqtuMuted)
                .frame(width: 18)

            Text(prayer.name.displayName)
                .font(.system(size: 13, weight: isNext ? .semibold : .regular))
                .foregroundColor(prayer.hasPassed ? .waqtuMuted.opacity(0.4) : .waqtuText)
                .lineLimit(1)

            Spacer(minLength: 8)

            Text(prayer.time.formatted(date: .omitted, time: .shortened))
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundColor(prayer.hasPassed ? .waqtuMuted.opacity(0.4) : (isNext ? .waqtuGold : .waqtuText))
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(
            isNext ? Color.waqtuPrimary.opacity(0.12) : (isHovering ? Color.waqtuPrimary.opacity(0.06) : Color.clear)
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
                        .foregroundColor(.waqtuGold)
                        .font(.system(size: 12))
                        .frame(width: 18, alignment: .center)
                    Text("Enable Overlay")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtuText)
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
                        .foregroundColor(.waqtuPrimary)
                        .font(.system(size: 12))
                    Text("Test Overlay")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtuText)
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
                    ? Color.waqtuPrimary.opacity(0.12)
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
                        .foregroundColor(.waqtuText)
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
                        .foregroundColor(.waqtuMuted)
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
    var onCheckForUpdates: (() -> Void)?

    init(settings: AppSettings, viewModel: AppViewModel? = nil, onCheckForUpdates: (() -> Void)? = nil) {
        self.settings = settings
        self.viewModel = viewModel
        self.onCheckForUpdates = onCheckForUpdates
    }

    var body: some View {
        Group {
            if let vm = viewModel, !vm.hasAccess {
                UpgradeFullScreenView(trialManager: vm.trialManager, licenseManager: vm.licenseManager)
            } else {
                settingsTabs
            }
        }
        .frame(width: 440, height: 520)
        .background(Color.waqtuBackground)
        .onAppear {
            NSApp.activate(ignoringOtherApps: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                NSApp.keyWindow?.makeKeyAndOrderFront(nil)
            }
        }
    }

    private var settingsTabs: some View {
        VStack(spacing: 0) {
            if let vm = viewModel, !vm.licenseManager.isLicensed, vm.trialManager.trialDaysRemaining >= 2 {
                TrialBannerView(daysRemaining: vm.trialManager.trialDaysRemaining)
            }
            TabView {
                GeneralSettingsTab(settings: settings, viewModel: viewModel)
                    .tabItem {
                        Label("General", systemImage: "gearshape.fill")
                    }

                PrayerTimesSettingsTab(settings: settings, viewModel: viewModel)
                    .tabItem {
                        Label("Prayer Times", systemImage: "clock.fill")
                    }

                LocationSettingsTab(settings: settings, viewModel: viewModel)
                    .tabItem {
                        Label("Location", systemImage: "location.fill")
                    }

                if let vm = viewModel {
                    UpgradeSettingsTab(trialManager: vm.trialManager, licenseManager: vm.licenseManager)
                        .tabItem {
                            Label("Upgrade", systemImage: "crown.fill")
                        }
                }

                AboutSettingsTab(trialManager: viewModel?.trialManager, isLicensed: viewModel?.licenseManager.isLicensed ?? false, onCheckForUpdates: onCheckForUpdates, onResetWaqtu: viewModel.map { vm in { vm.resetAllAndQuit() } })
                    .tabItem {
                        Label("About", systemImage: "info.circle.fill")
                    }
            }
        }
    }
}

// MARK: - Upgrade tab in Settings (visible before and after trial)
struct UpgradeSettingsTab: View {
    @Bindable var trialManager: TrialManager
    @Bindable var licenseManager: LicenseManager
    @State private var licenseKeyInput = ""
    @State private var isActivating = false
    @State private var activationError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if licenseManager.isLicensed {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.waqtuPrimary)
                        Text("You have lifetime access on this Mac.")
                            .font(.system(size: 14))
                            .foregroundColor(.waqtuText)
                    }
                    .padding(.vertical, 8)
                } else {
                    if trialManager.isTrialActive, trialManager.trialDaysRemaining > 0 {
                        Text("\(trialManager.trialDaysRemaining) day\(trialManager.trialDaysRemaining == 1 ? "" : "s") left in trial. Upgrade anytime to keep access.")
                            .font(.system(size: 13))
                            .foregroundColor(.waqtuMuted)
                    }
                    Text("Buy once at getwaqtu.com — you’ll get a license key by email. Enter it below to activate this Mac.")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtuMuted)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("License key")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.waqtuMuted)
                        TextField("Paste key from Polar email", text: $licenseKeyInput)
                            .textFieldStyle(.roundedBorder)
                            .onChange(of: licenseKeyInput) { _, _ in activationError = nil }
                        if let err = activationError {
                            Text(err)
                                .font(.system(size: 11))
                                .foregroundColor(.red)
                        }
                        Button(isActivating ? "Activating…" : "Activate this device") {
                            activateLicense()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.waqtuPrimary)
                        .disabled(isActivating || licenseKeyInput.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    Button("Open getwaqtu.com to purchase") {
                        if let url = URL(string: "https://getwaqtu.com") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
    }

    private func activateLicense() {
        activationError = nil
        isActivating = true
        Task { @MainActor in
            let result = await licenseManager.activate(key: licenseKeyInput)
            isActivating = false
            switch result {
            case .success:
                licenseKeyInput = ""
            case .failure(.message(let msg)):
                activationError = msg
            }
        }
    }
}

// MARK: - Day 7: Full-screen upgrade (Settings)
struct UpgradeFullScreenView: View {
    @Bindable var trialManager: TrialManager
    @Bindable var licenseManager: LicenseManager
    @State private var licenseKeyInput = ""
    @State private var isActivating = false
    @State private var activationError: String?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("Upgrade")
                .font(.system(size: 26, weight: .semibold))
                .foregroundColor(.waqtuText)
            Text("Your trial has ended. Buy lifetime access at getwaqtu.com — you’ll get a license key by email. Enter it below to activate this Mac.")
                .font(.system(size: 14))
                .foregroundColor(.waqtuMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 8) {
                Text("License key")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.waqtuMuted)
                TextField("Paste key from Polar email", text: $licenseKeyInput)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: licenseKeyInput) { _, _ in activationError = nil }
                if let err = activationError {
                    Text(err)
                        .font(.system(size: 11))
                        .foregroundColor(.red)
                }
                Button(isActivating ? "Activating…" : "Activate this device") {
                    activateLicense()
                }
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
                .disabled(isActivating || licenseKeyInput.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .frame(width: 280)

            Button("Open getwaqtu.com to purchase") {
                openStore()
            }
            .buttonStyle(.bordered)
            .tint(.waqtuPrimary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func activateLicense() {
        activationError = nil
        isActivating = true
        Task { @MainActor in
            let result = await licenseManager.activate(key: licenseKeyInput)
            isActivating = false
            switch result {
            case .success:
                licenseKeyInput = ""
            case .failure(.message(let msg)):
                activationError = msg
            }
        }
    }

    private func openStore() {
        if let url = URL(string: "https://getwaqtu.com") {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - Prayer Times Settings Tab
struct PrayerTimesSettingsTab: View {
    @Bindable var settings: AppSettings
    var viewModel: AppViewModel?

    private static let calculationMethods: [(id: String, label: String)] = [
        ("muslimWorldLeague", "Muslim World League"),
        ("moonsightingCommittee", "Moonsighting Committee (North America, UK)"),
        ("northAmerica", "ISNA (North America)"),
        ("egyptian", "Egyptian General Authority"),
        ("karachi", "University of Islamic Sciences, Karachi"),
        ("ummAlQura", "Umm al-Qura (Makkah)"),
        ("dubai", "Dubai (UAE)"),
        ("qatar", "Qatar"),
        ("kuwait", "Kuwait"),
        ("singapore", "Singapore / Malaysia / Indonesia"),
        ("tehran", "Tehran"),
        ("turkey", "Turkey (Diyanet)"),
        ("other", "Custom (angles)"),
    ]

    private static let highLatitudeRules: [(id: String, label: String)] = [
        ("auto", "Auto (recommended for location)"),
        ("middleOfTheNight", "Middle of the night"),
        ("seventhOfTheNight", "Seventh of the night (above 48° latitude)"),
        ("twilightAngle", "Twilight angle"),
    ]

    var body: some View {
        Form {
            Section {
                Picker("Calculation method", selection: $settings.calculationMethod) {
                    ForEach(Self.calculationMethods, id: \.id) { m in
                        Text(m.label).tag(m.id)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: settings.calculationMethod) { _, _ in notifyPrayerSettingsChanged() }
                Text("Choose the method used by your local mosque or region.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Picker("Asr calculation", selection: $settings.madhab) {
                    Text("Shafi (earlier)").tag("shafi")
                    Text("Hanafi (later)").tag("hanafi")
                }
                .pickerStyle(.menu)
                .onChange(of: settings.madhab) { _, _ in notifyPrayerSettingsChanged() }
                Text("Shafi, Maliki, Hanbali use earlier Asr; Hanafi uses later.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Picker("High latitude rule", selection: $settings.highLatitudeRule) {
                    ForEach(Self.highLatitudeRules, id: \.id) { r in
                        Text(r.label).tag(r.id)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: settings.highLatitudeRule) { _, _ in notifyPrayerSettingsChanged() }
                Text("For locations above ~48° latitude. Auto picks based on your location.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
            } header: {
                Text("Calculation")
            }

            Section {
                AdjustmentRow(label: "Fajr", value: Binding(
                    get: { settings.adjustmentFajr },
                    set: { settings.adjustmentFajr = $0 }
                ), onChange: notifyPrayerSettingsChanged)
                AdjustmentRow(label: "Sunrise", value: Binding(
                    get: { settings.adjustmentSunrise },
                    set: { settings.adjustmentSunrise = $0 }
                ), onChange: notifyPrayerSettingsChanged)
                AdjustmentRow(label: "Dhuhr", value: Binding(
                    get: { settings.adjustmentDhuhr },
                    set: { settings.adjustmentDhuhr = $0 }
                ), onChange: notifyPrayerSettingsChanged)
                AdjustmentRow(label: "Asr", value: Binding(
                    get: { settings.adjustmentAsr },
                    set: { settings.adjustmentAsr = $0 }
                ), onChange: notifyPrayerSettingsChanged)
                AdjustmentRow(label: "Maghrib", value: Binding(
                    get: { settings.adjustmentMaghrib },
                    set: { settings.adjustmentMaghrib = $0 }
                ), onChange: notifyPrayerSettingsChanged)
                AdjustmentRow(label: "Isha", value: Binding(
                    get: { settings.adjustmentIsha },
                    set: { settings.adjustmentIsha = $0 }
                ), onChange: notifyPrayerSettingsChanged)
            } header: {
                Text("Minute corrections")
            } footer: {
                Text("Add or subtract minutes per prayer. Useful if your local times differ slightly from the calculation.")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
    }

    private func notifyPrayerSettingsChanged() {
        NotificationCenter.default.post(name: Notification.Name("prayerTimeSettingsChanged"), object: nil)
    }
}

// MARK: - Adjustment Row (stepper for -60 to +60)
struct AdjustmentRow: View {
    let label: String
    @Binding var value: Int
    var onChange: (() -> Void)?

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 70, alignment: .leading)
            Spacer()
            HStack(spacing: 8) {
                Button("-") {
                    value = max(-60, value - 1)
                    onChange?()
                }
                .buttonStyle(.bordered)
                .frame(width: 28)
                .disabled(value <= -60)
                Text("\(value >= 0 ? "+" : "")\(value)")
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.waqtuPrimary)
                    .frame(width: 36, alignment: .center)
                Button("+") {
                    value = min(60, value + 1)
                    onChange?()
                }
                .buttonStyle(.bordered)
                .frame(width: 28)
                .disabled(value >= 60)
            }
        }
    }
}

// MARK: - General Settings Tab
struct GeneralSettingsTab: View {
    @Bindable var settings: AppSettings
    var viewModel: AppViewModel?
    @State private var showCalendarExplanation = false
    @State private var showRemoveWaqtuEventsAlert = false
    @State private var calendarManager = CalendarManager()
    @State private var calendarsGroupedBySource: [(source: EKSource, calendars: [EKCalendar])] = []

    var body: some View {
        Form {
            Section {
                Toggle("Enable Overlay", isOn: $settings.overlayEnabled)
                Text("Show a full-screen notification when it's time for prayer.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                if settings.overlayEnabled {
                    HStack {
                        Text("Duration")
                        Spacer()
                        Text("\(settings.overlayDuration) min")
                            .foregroundColor(.waqtuPrimary)
                            .monospacedDigit()
                        Slider(value: Binding(
                            get: { Double(settings.overlayDuration) },
                            set: { settings.overlayDuration = Int($0) }
                        ), in: 5...15, step: 1)
                        .frame(width: 120)
                        .tint(.waqtuPrimary)
                    }
                    Text("How long the overlay stays visible (5–15 minutes).")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)

                    Toggle("Play Adhan sound", isOn: $settings.overlayPlayAdhanSound)
                    Text("Play the Adhan when the overlay appears.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)

                    Button("Test Overlay") { showTestOverlay() }
                        .buttonStyle(.bordered)
                        .tint(.waqtuPrimary)
                }

                Divider()
                    .padding(.vertical, 4)

                Toggle("Reminder notifications", isOn: $settings.reminderNotificationEnabled)
                    .onChange(of: settings.reminderNotificationEnabled) { _, _ in
                        viewModel?.rescheduleReminderNotifications()
                    }
                Text("Notify you before each prayer (e.g. \"Asr in 5 minutes\").")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                if settings.reminderNotificationEnabled {
                    Picker("Notify before", selection: $settings.reminderMinutesBefore) {
                        Text("5 minutes").tag(5)
                        Text("10 minutes").tag(10)
                        Text("15 minutes").tag(15)
                        Text("30 minutes").tag(30)
                    }
                    .pickerStyle(.menu)
                    .onChange(of: settings.reminderMinutesBefore) { _, _ in
                        viewModel?.rescheduleReminderNotifications()
                    }
                }
            } header: {
                Text("Prayer Reminders")
            }

            CalendarProtectionSection(
                settings: settings,
                calendarsGroupedBySource: calendarsGroupedBySource,
                hasCalendarAccess: viewModel?.calendarManager.hasAccess ?? false,
                isRefreshingCalendarAccess: viewModel?.isRefreshingCalendarAccess ?? false,
                onEnableFirstTime: {
                    if !settings.hasSeenCalendarProtectionExplanation {
                        showCalendarExplanation = true
                    }
                    viewModel?.requestCalendarAccessAndRegenerate {
                        calendarsGroupedBySource = (viewModel?.calendarManager ?? calendarManager).calendarsGroupedBySource()
                    }
                },
                onRefreshCalendarAccess: {
                    viewModel?.refreshCalendarAccess {
                        calendarsGroupedBySource = (viewModel?.calendarManager ?? calendarManager).calendarsGroupedBySource()
                    }
                },
                onRemoveAllWaqtuEvents: {
                    showRemoveWaqtuEventsAlert = true
                }
            )

            Section {
                Toggle("Launch at Login", isOn: $settings.launchAtLogin)
                    .onChange(of: settings.launchAtLogin) { _, enabled in
                        if !AppDelegate.applyLaunchAtLogin(enabled) {
                            settings.launchAtLogin = false
                        }
                    }
                Text("Start Waqtu automatically when you log in.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
            } header: {
                Text("Startup")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
        .onAppear {
            // On macOS 14+, EventKit returns no calendars until we've requested full access. Request first, then refresh the list.
            let manager = viewModel?.calendarManager ?? calendarManager
            if let viewModel {
                viewModel.requestCalendarAccessForListing {
                    calendarsGroupedBySource = manager.calendarsGroupedBySource()
                }
            } else {
                Task {
                    try? await manager.requestAccess()
                    await MainActor.run {
                        calendarsGroupedBySource = manager.calendarsGroupedBySource()
                    }
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            // Re-request access and refresh list when user returns (e.g. after granting in System Settings)
            Task {
                try? await (viewModel?.calendarManager ?? calendarManager).requestAccess()
                await MainActor.run {
                    calendarsGroupedBySource = (viewModel?.calendarManager ?? calendarManager).calendarsGroupedBySource()
                }
            }
        }
        .alert("Calendar Protection", isPresented: $showCalendarExplanation) {
            Button("OK") {
                settings.hasSeenCalendarProtectionExplanation = true
            }
        } message: {
            Text("Waqtu will create daily prayer blocks in your calendar so you appear busy during prayer times. Events are recreated every day to match changing prayer times.")
        }
        .alert("Remove All Waqtu Events?", isPresented: $showRemoveWaqtuEventsAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Remove All", role: .destructive) {
                viewModel?.removeAllWaqtuEvents()
            }
        } message: {
            Text("This will delete all prayer block events created by Waqtu from your calendar. Your other events are not affected.")
        }
    }

    private func showTestOverlay() {
        if let viewModel {
            viewModel.showTestOverlay()
        } else {
            let testWindow = OverlayWindow(
                prayerName: .maghrib,
                durationMinutes: settings.overlayDuration,
                playAdhanSound: settings.overlayPlayAdhanSound,
                onDismiss: {}
            )
            testWindow.makeKeyAndOrderFront(nil)
        }
    }
}

// MARK: - Calendar Protection Section
struct CalendarProtectionSection: View {
    @Bindable var settings: AppSettings
    let calendarsGroupedBySource: [(source: EKSource, calendars: [EKCalendar])]
    let hasCalendarAccess: Bool
    var isRefreshingCalendarAccess: Bool = false
    let onEnableFirstTime: () -> Void
    var onRefreshCalendarAccess: (() -> Void)?
    let onRemoveAllWaqtuEvents: () -> Void

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
                .foregroundColor(.waqtuMuted)

            if settings.calendarProtectionEnabled {
                let hasCalendars = !calendarsGroupedBySource.flatMap(\.calendars).isEmpty
                let effectiveAccess = hasCalendarAccess || hasCalendars
                HStack(spacing: 6) {
                    Image(systemName: effectiveAccess ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                        .foregroundColor(effectiveAccess ? .waqtuPrimary : .waqtuGold)
                    Text(effectiveAccess ? "Calendar access granted" : "Calendar access denied — enable in System Settings → Privacy & Security → Calendars")
                        .font(.caption)
                        .foregroundColor(effectiveAccess ? .waqtuMuted : .waqtuGold)
                }
                if !effectiveAccess {
                    Button("Open Calendar Settings") {
                        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars") {
                            NSWorkspace.shared.open(url)
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                    Text("If System Settings already shows Full Access, toggle Waqtu off then on to refresh. Restart Mac if it still fails.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                }
                if let onRefresh = onRefreshCalendarAccess {
                    Button {
                        onRefresh()
                    } label: {
                        HStack {
                            if isRefreshingCalendarAccess {
                                ProgressView()
                                    .scaleEffect(0.7)
                            } else {
                                Image(systemName: "arrow.clockwise.circle.fill")
                            }
                            Text("Refresh calendar access")
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                    .disabled(isRefreshingCalendarAccess)
                    Text("Re-request full access and reload calendars. Use if your Outlook or other calendars don't appear. If they still don't show, quit and reopen Waqtu.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                }
                HStack {
                    Text("Block duration")
                    Spacer()
                    Text("\(settings.calendarBlockDuration) min")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.calendarBlockDuration) },
                        set: { settings.calendarBlockDuration = Int($0) }
                    ), in: 10...20, step: 1)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }
                .onChange(of: settings.calendarBlockDuration) { _, _ in
                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                }
                Text("Length of each prayer block (10–20 minutes).")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Toggle("Add 5 min reminder", isOn: $settings.calendarProtectionReminder)
                    .onChange(of: settings.calendarProtectionReminder) { _, _ in
                        NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                    }
                Text("Alert 5 minutes before each prayer block.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

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
                            .foregroundColor(.waqtuMuted)
                    }
                }
                .onChange(of: settings.calendarProtectionCalendarId) { _, _ in
                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                }

                Button("Remove all Waqtu events from calendar", role: .destructive) {
                    onRemoveAllWaqtuEvents()
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
    var viewModel: AppViewModel?

    var body: some View {
        Form {
            Section {
                Toggle("Auto-detect Location", isOn: $settings.autoDetectLocation)
                Text("Use your Mac's location for accurate prayer times.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                if settings.autoDetectLocation, let vm = viewModel {
                    Button {
                        vm.refreshLocation()
                    } label: {
                        HStack {
                            if vm.isRefreshingLocation {
                                ProgressView()
                                    .scaleEffect(0.7)
                            } else {
                                Image(systemName: "location.circle.fill")
                            }
                            Text("Locate Me")
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                    .disabled(vm.isRefreshingLocation)
                    Text("Refresh your current location for accurate prayer times.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                }
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
                    .tint(.waqtuPrimary)
                } header: {
                    Text("Manual Coordinates")
                } footer: {
                    Text("Enter coordinates if auto-detect is unavailable. Example: Mecca 21.4225, 39.8262")
                }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
    }
}

// MARK: - About Settings Tab
struct AboutSettingsTab: View {
    var trialManager: TrialManager?
    var isLicensed: Bool = false
    var onCheckForUpdates: (() -> Void)?
    var onResetWaqtu: (() -> Void)?
    @State private var showResetConfirmation = false

    private var versionString: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "Version \(short) (\(build))"
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image("AppLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 80, height: 80)
            Text("Waqtu")
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(.waqtuText)
            Text("Prayer times for your day")
                .font(.system(size: 14))
                .foregroundColor(.waqtuMuted)

            Text(versionString)
                .font(.system(size: 12))
                .foregroundColor(.waqtuMuted)

            accessBadge

            if let onCheck = onCheckForUpdates {
                Button("Check for Updates…", action: onCheck)
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
            }

            Button {
                if let url = URL(string: "https://getwaqtu.com") {
                    NSWorkspace.shared.open(url)
                }
            } label: {
                Text("getwaqtu.com")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtuPrimary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 12) {
                Text(AppSettings.quranicQuote)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.waqtuText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                Text(AppSettings.quranicReference)
                    .font(.system(size: 13))
                    .foregroundColor(.waqtuGold)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .background(Color.waqtuDark.opacity(0.4))
            .cornerRadius(12)

            if let onReset = onResetWaqtu {
                VStack(alignment: .leading, spacing: 8) {
                    Button("Reset Waqtu", role: .destructive) {
                        showResetConfirmation = true
                    }
                    .buttonStyle(.bordered)
                    Text("Clears all settings and calendar events, then quits. Use to fix calendar access issues. Your license is preserved.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)

                    DisclosureGroup("Clean uninstall (manual)") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("1. Quit Waqtu")
                            Text("2. Drag Waqtu from Applications to Trash")
                            Text("3. Delete: ~/Library/Preferences/dat.waqtu.plist")
                            Text("4. System Settings → Privacy & Security → Calendars → remove Waqtu")
                            Text("5. Restart Mac (clears calaccessd state)")
                        }
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                        .padding(.top, 4)
                    }
                    .font(.caption)
                }
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .background(Color.waqtuBackground)
        .alert("Reset Waqtu?", isPresented: $showResetConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Reset & Quit", role: .destructive) {
                onResetWaqtu?()
            }
        } message: {
            Text("All settings will be reset to defaults, Waqtu events will be removed from your calendar, and the app will quit. Your license is preserved. Reopen Waqtu to start fresh.")
        }
    }

    @ViewBuilder
    private var accessBadge: some View {
        if isLicensed {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtuPrimary)
                Text("Lifetime access")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.waqtuText)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.waqtuDark.opacity(0.6))
            .cornerRadius(8)
        } else if let trial = trialManager, trial.hasAccess, trial.isTrialActive, trial.trialDaysRemaining > 0 {
            Text("\(trial.trialDaysRemaining) day\(trial.trialDaysRemaining == 1 ? "" : "s") left in trial")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.waqtuGold)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.waqtuDark.opacity(0.6))
                .cornerRadius(8)
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
