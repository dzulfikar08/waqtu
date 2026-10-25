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
    static let waqtuSecondary = Color(hex: "#6B8FAD")
    static let waqtuSecondaryDark = Color(hex: "#5A7D9A")
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
            // Trial banner only without paid premium (license or Waqtu account)
            if !viewModel.isPremium, viewModel.trialManager.trialDaysRemaining >= 2 {
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

            // Today's fardhu checklist (marks prayed locally and syncs with the account)
            FardhChecklistView(
                streakManager: viewModel.streakManager,
                onToggle: { viewModel.toggleFardh($0) }
            )

            Divider()

            // Streak report
            StreakReportView(streakManager: viewModel.streakManager)

            Divider()

            // Module windows (halaqah, hafalan, circles); brings its own divider
            ModulesMenuSection(viewModel: viewModel)

            // Pomodoro timer
            PomodoroSection(pomodoroManager: viewModel.pomodoroManager, nextPrayer: viewModel.nextPrayer)

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
            if !viewModel.isPremium, viewModel.trialManager.shouldShowTrialEndingSoonModal {
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

// MARK: - Streak Report
struct StreakReportView: View {
    let streakManager: PrayerStreakManager
    @State private var isExpanded = false

    private let prayerOrder: [String] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
    private let prayerIcons: [String: String] = [
        "Fajr": "moon.stars.fill",
        "Dhuhr": "sun.max.fill",
        "Asr": "sun.haze.fill",
        "Maghrib": "sunset.fill",
        "Isha": "moon.fill"
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header row — tappable to expand/collapse
            Button(action: { withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() } }) {
                HStack(spacing: 8) {
                    Text("🔥")
                        .font(.system(size: 13))
                    Text("Streak \(streakManager.currentStreak)d")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.waqtuGold)
                    if streakManager.bestStreak > 0 {
                        Text("· Best \(streakManager.bestStreak)d")
                            .font(.system(size: 11))
                            .foregroundColor(.waqtuMuted)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10))
                        .foregroundColor(.waqtuMuted)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                Divider()
                    .padding(.horizontal, 12)

                VStack(spacing: 6) {
                    // Today's prayer status
                    ForEach(prayerOrder, id: \.self) { prayerName in
                        prayerStatusRow(name: prayerName)
                    }

                    // Weekly mini-grid
                    HStack(spacing: 4) {
                        ForEach(streakManager.weeklyGrid, id: \.label) { day in
                            VStack(spacing: 2) {
                                Text(day.label.prefix(1).uppercased())
                                    .font(.system(size: 9))
                                    .foregroundColor(day.isToday ? .waqtuGold : .waqtuMuted)
                                Text(day.status)
                                    .font(.system(size: 13))
                                    .foregroundColor(day.isToday ? .waqtuGold : .waqtuMuted)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                    // Week summary
                    let week = streakManager.weeklyStats
                    if week.total > 0 {
                        Text("This week: \(week.prayed)/\(week.total) (\(Int(Double(week.prayed) / Double(week.total) * 100))%)")
                            .font(.system(size: 10))
                            .foregroundColor(.waqtuMuted)
                    }
                }
                .padding(.vertical, 8)
            }
        }
    }

    @ViewBuilder
    private func prayerStatusRow(name: String) -> some View {
        let status = streakManager.statusFor(prayer: name)
        let hasPassed: Bool = {
            // Check if this prayer's time has passed today
            let icon = prayerIcons[name] ?? "circle"
            return status != nil || icon.isEmpty == false // simplified: show all
        }()

        HStack(spacing: 8) {
            Image(systemName: prayerIcons[name] ?? "circle")
                .font(.system(size: 11))
                .foregroundColor(status == .prayed ? .waqtuPrimary : .waqtuMuted)
                .frame(width: 16)

            Text(name)
                .font(.system(size: 12))
                .foregroundColor(.waqtuText)

            Spacer()

            statusBadge(status)
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private func statusBadge(_ status: PrayerLogEntry.Status?) -> some View {
        if let status {
            switch status {
            case .prayed:
                Text("Prayed")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.waqtuPrimary)
            case .missed:
                Text("Missed")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.red.opacity(0.8))
            case .late:
                Text("Late")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.waqtuGold)
            }
        } else {
            Text("—")
                .font(.system(size: 10))
                .foregroundColor(.waqtuMuted)
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

// MARK: - Pomodoro Section
struct PomodoroSection: View {
    @Bindable var pomodoroManager: PomodoroManager
    var nextPrayer: PrayerTime?

    var body: some View {
        VStack(spacing: 0) {
            // Phase + countdown header
            HStack(spacing: 10) {
                Image(systemName: pomodoroManager.phase.symbolName)
                    .foregroundColor(.waqtuGold)
                    .font(.system(size: 12))
                    .frame(width: 18, alignment: .center)

                VStack(alignment: .leading, spacing: 1) {
                    Text(pomodoroManager.phase.displayName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.waqtuText)
                    if let prayer = pomodoroManager.clampedBeforePrayer {
                        Text("Stops before \(prayer)")
                            .font(.system(size: 10))
                            .foregroundColor(.waqtuMuted)
                    } else if pomodoroManager.isPaused {
                        Text("Paused")
                            .font(.system(size: 10))
                            .foregroundColor(.waqtuMuted)
                    }
                }

                Spacer(minLength: 8)

                Text(pomodoroManager.timeText)
                    .font(.system(size: 16, weight: .semibold))
                    .monospacedDigit()
                    .foregroundColor(.waqtuGold)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            // Progress bar
            if pomodoroManager.isRunning {
                ProgressView(value: pomodoroManager.progress)
                    .tint(.waqtuPrimary)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 6)
            }

            // Cycle dots
            HStack(spacing: 4) {
                ForEach(0..<pomodoroManager.cycleTarget, id: \.self) { i in
                    Circle()
                        .fill(i < pomodoroManager.cyclesCompleted ? Color.waqtuPrimary : Color.waqtuDark)
                        .frame(width: 6, height: 6)
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            // Controls
            HStack(spacing: 8) {
                if pomodoroManager.phase == .idle {
                    Button {
                        pomodoroManager.start(nextPrayer: nextPrayer)
                    } label: {
                        Label("Start", systemImage: "play.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)
                } else {
                    Button {
                        pomodoroManager.isPaused ? pomodoroManager.resume() : pomodoroManager.pause()
                    } label: {
                        Label(pomodoroManager.isPaused ? "Resume" : "Pause",
                              systemImage: pomodoroManager.isPaused ? "play.fill" : "pause.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.bordered)
                    .tint(.waqtuPrimary)

                    Button {
                        pomodoroManager.skip(nextPrayer: nextPrayer)
                    } label: {
                        Label("Skip", systemImage: "forward.fill")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .buttonStyle(.bordered)

                    Button {
                        pomodoroManager.reset()
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 12))
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
        }
    }
}

// MARK: - Pomodoro Settings Tab
struct PomodoroSettingsTab: View {
    @Bindable var settings: AppSettings
    var onBrowse: () -> Void = {}

    var body: some View {
        Form {
            Section {
                HStack {
                    Text("Focus")
                    Spacer()
                    Text("\(settings.focusMinutes) min")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.focusMinutes) },
                        set: { settings.focusMinutes = Int($0) }
                    ), in: 5...90, step: 5)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }
                Text("Length of each focus block.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                HStack {
                    Text("Short break")
                    Spacer()
                    Text("\(settings.breakMinutes) min")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.breakMinutes) },
                        set: { settings.breakMinutes = Int($0) }
                    ), in: 1...30, step: 1)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }

                HStack {
                    Text("Long break")
                    Spacer()
                    Text("\(settings.longBreakMinutes) min")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.longBreakMinutes) },
                        set: { settings.longBreakMinutes = Int($0) }
                    ), in: 1...60, step: 1)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }

                HStack {
                    Text("Cycles before long break")
                    Spacer()
                    Text("\(settings.cyclesBeforeLongBreak)")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.cyclesBeforeLongBreak) },
                        set: { settings.cyclesBeforeLongBreak = Int($0) }
                    ), in: 1...8, step: 1)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }
            } header: {
                Text("Focus")
            }

            Section {
                Toggle("Intention & dua", isOn: $settings.intentionDua)
                Text("Frame each session — Bismillah to begin, Alhamdulillah on completion.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Toggle("Dhikr breaks", isOn: $settings.dhikrBreaks)
                Text("Remind you of the post-salah tasbih (×33, ×33, ×34) during breaks.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Toggle("Quran verse break", isOn: $settings.verseBreak)
                Text("Show a short surah to recite during breaks.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Toggle("Salah-aligned", isOn: $settings.salahAligned)
                Text("End a focus block before the next adhan.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Picker("Break audio", selection: $settings.breakAudio) {
                    Text("None").tag("none")
                    Text("Murattal").tag("murattal")
                    Text("Dzikr").tag("dzikr")
                    Text("Sholawat").tag("sholawat")
                    Text("Auto (rotate)").tag("auto")
                }
                .pickerStyle(.menu)
                Text("Looped during breaks. Add murattal.mp3 / dzikr.mp3 / sholawat.mp3. Auto rotates by cycle.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)

                Button {
                    onBrowse()
                } label: {
                    Label("Browse & Download…", systemImage: "square.and.arrow.down")
                        .font(.system(size: 12))
                }
                .buttonStyle(.bordered)
                .tint(.waqtuPrimary)
                if settings.breakAudio == "downloaded", let id = settings.downloadedAudioId,
                   let title = AudioLibraryManager.item(id)?.title {
                    Text("Selected: \(title)")
                        .font(.caption)
                        .foregroundColor(.waqtuPrimary)
                }
            } header: {
                Text("Islamic Features")
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
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
    @State private var showAudioBrowser = false

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
        .frame(width: 520, height: 520)
        .background(Color.waqtuBackground)
        .onAppear {
            NSApp.activate(ignoringOtherApps: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                NSApp.keyWindow?.makeKeyAndOrderFront(nil)
            }
        }
        .sheet(isPresented: $showAudioBrowser) {
            if let vm = viewModel {
                AudioBrowserView(settings: settings, audioLibrary: vm.audioLibrary)
            }
        }
    }

    private var settingsTabs: some View {
        VStack(spacing: 0) {
            if let vm = viewModel, !vm.isPremium, vm.trialManager.trialDaysRemaining >= 2 {
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

                PomodoroSettingsTab(settings: settings, onBrowse: { showAudioBrowser = true })
                    .tabItem {
                        Label("Pomodoro", systemImage: "timer.fill")
                    }

                LocationSettingsTab(settings: settings, viewModel: viewModel)
                    .tabItem {
                        Label("Location", systemImage: "location.fill")
                    }

                if let vm = viewModel {
                    AccountSettingsTab(
                        account: vm.account,
                        sync: vm.syncController,
                        licenseManager: vm.licenseManager,
                        settings: settings
                    )
                    .tabItem {
                        Label("Account", systemImage: "person.crop.circle.fill")
                    }

                    SlackSettingsTab(settings: settings, slackManager: vm.slackManager)
                        .tabItem {
                            Label("Slack", systemImage: "message.fill")
                        }

                    UpgradeSettingsTab(trialManager: vm.trialManager, licenseManager: vm.licenseManager)
                        .tabItem {
                            Label("Upgrade", systemImage: "crown.fill")
                        }
                }

                AboutSettingsTab(trialManager: viewModel?.trialManager, isLicensed: viewModel?.licenseManager.isLicensed ?? false, hasAccountPremium: viewModel?.account.serverPremium ?? false, onCheckForUpdates: onCheckForUpdates, onResetWaqtu: viewModel.map { vm in { vm.resetAllAndQuit() } })
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
                    #if MAS
                    Text("Unlock Waqtu for lifetime access on this Mac with a one-time purchase.")
                        .font(.system(size: 13))
                        .foregroundColor(.waqtuMuted)
                    VStack(alignment: .leading, spacing: 8) {
                        if let err = activationError {
                            Text(err)
                                .font(.system(size: 11))
                                .foregroundColor(.red)
                        }
                        Button(isActivating ? "Processing\u{2026}" : "Buy Lifetime Access") {
                            purchaseLifetime()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.waqtuPrimary)
                        .disabled(isActivating)
                        Button("Restore Purchases") {
                            restorePurchases()
                        }
                        .buttonStyle(.bordered)
                        .tint(.waqtuPrimary)
                    }
                    #else
                    Text("Buy once at getwaqtu.com \u{2014} you\u{2019}ll get a license key by email. Enter it below to activate this Mac.")
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
                        Button(isActivating ? "Activating\u{2026}" : "Activate this device") {
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
                    #endif
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
    }

    #if !MAS
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
    #else
    private func purchaseLifetime() {
        activationError = nil
        isActivating = true
        Task { @MainActor in
            let result = await licenseManager.purchase()
            isActivating = false
            if case .failure(.message(let msg)) = result { activationError = msg }
        }
    }

    private func restorePurchases() {
        Task { @MainActor in await licenseManager.restore() }
    }
    #endif
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
            #if MAS
            Text("Your trial has ended. Unlock Waqtu for lifetime access with a one-time purchase.")
                .font(.system(size: 14))
                .foregroundColor(.waqtuMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(alignment: .leading, spacing: 8) {
                if let err = activationError {
                    Text(err)
                        .font(.system(size: 11))
                        .foregroundColor(.red)
                }
                Button(isActivating ? "Processing\u{2026}" : "Buy Lifetime Access") {
                    purchaseLifetime()
                }
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
                .disabled(isActivating)
                Button("Restore Purchases") {
                    restorePurchases()
                }
                .buttonStyle(.bordered)
                .tint(.waqtuPrimary)
            }
            .frame(width: 280)
            #else
            Text("Your trial has ended. Buy lifetime access at getwaqtu.com \u{2014} you\u{2019}ll get a license key by email. Enter it below to activate this Mac.")
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
                Button(isActivating ? "Activating\u{2026}" : "Activate this device") {
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
            #endif
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    #if !MAS
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
    #else
    private func purchaseLifetime() {
        activationError = nil
        isActivating = true
        Task { @MainActor in
            let result = await licenseManager.purchase()
            isActivating = false
            if case .failure(.message(let msg)) = result { activationError = msg }
        }
    }

    private func restorePurchases() {
        Task { @MainActor in await licenseManager.restore() }
    }
    #endif
}

// MARK: - Slack Settings Tab
struct SlackSettingsTab: View {
    @Bindable var settings: AppSettings
    let slackManager: SlackManager
    @State private var tokenInput: String = ""
    @State private var showTokenHelp = false
    @FocusState private var isTokenFocused: Bool

    var body: some View {
        Form {
            Section {
                Toggle("Auto-set Slack status", isOn: $settings.slackEnabled)
                Text("Your Slack status will change to \"Praying\" during prayer times and auto-clear when the prayer block ends.")
                    .font(.caption)
                    .foregroundColor(.waqtuMuted)
            } header: {
                Text("Integration")
            }

            if settings.slackEnabled {
                Section {
                    HStack {
                        if slackManager.isConnected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.waqtuPrimary)
                            Text("Connected to Slack")
                                .font(.system(size: 13))
                                .foregroundColor(.waqtuText)
                        } else {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.red.opacity(0.7))
                            Text("Not connected")
                                .font(.system(size: 13))
                                .foregroundColor(.waqtuMuted)
                        }
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("User OAuth Token")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.waqtuMuted)

                        HStack {
                            SecureField("xoxp-...", text: $tokenInput)
                                .textFieldStyle(.roundedBorder)
                                .focused($isTokenFocused)

                            Button(slackManager.isConnected ? "Update" : "Connect") {
                                saveToken()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.waqtuPrimary)
                            .disabled(tokenInput.trimmingCharacters(in: .whitespaces).isEmpty)
                        }

                        if slackManager.isConnected {
                            Button("Disconnect", role: .destructive) {
                                slackManager.deleteToken()
                                tokenInput = ""
                            }
                            .font(.caption)
                        }
                    }

                    Button {
                        showTokenHelp = true
                    } label: {
                        HStack {
                            Image(systemName: "questionmark.circle")
                                .font(.system(size: 12))
                            Text("How to get a Slack token")
                                .font(.system(size: 12))
                        }
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.waqtuPrimary)
                } header: {
                    Text("Connection")
                }

                Section {
                    HStack {
                        Text("Status text")
                        Spacer()
                        TextField("Praying", text: $settings.slackStatusText)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 180)
                    }

                    HStack {
                        Text("Status emoji")
                        Spacer()
                        TextField(":pray:", text: $settings.slackStatusEmoji)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 180)
                    }
                    Text("Use Slack emoji codes like :mosque: or :pray:. Unicode emoji also works: 🙏 🕌")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)
                } header: {
                    Text("Status")
                }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .background(Color.waqtuBackground)
        .padding()
        .onAppear {
            tokenInput = slackManager.loadToken() ?? ""
        }
        .alert("Getting a Slack Token", isPresented: $showTokenHelp) {
            Button("Open Slack API", action: openSlackAPI)
            Button("OK", role: .cancel) {}
        } message: {
            Text("1. Open the Slack API site and create a new app.\n2. Under OAuth & Permissions, add the scope users.profile:write.\n3. Install to your workspace.\n4. Copy the \"User OAuth Token\" (starts with xoxp-).\n5. Paste it above and click Connect.")
        }
    }

    private func saveToken() {
        let trimmed = tokenInput.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        slackManager.storeToken(trimmed)
        isTokenFocused = false
    }

    private func openSlackAPI() {
        if let url = URL(string: "https://api.slack.com/apps") {
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
        ("kemenag", "Kemenag RI (Indonesia)"),
        ("singapore", "Singapore / Malaysia (MUIS / JAKIM)"),
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
                    Picker("Theme", selection: $settings.overlayTheme) {
                        Text("Dark").tag("dark")
                        Text("Light").tag("light")
                    }
                    .pickerStyle(.menu)
                    Text("Choose a dark or light appearance for the prayer overlay.")
                        .font(.caption)
                        .foregroundColor(.waqtuMuted)

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

                HStack {
                    Text("Start before prayer")
                    Spacer()
                    Text("\(settings.calendarPreBufferMinutes) min")
                        .foregroundColor(.waqtuPrimary)
                        .monospacedDigit()
                    Slider(value: Binding(
                        get: { Double(settings.calendarPreBufferMinutes) },
                        set: { settings.calendarPreBufferMinutes = Int($0) }
                    ), in: 0...10, step: 1)
                    .frame(width: 120)
                    .tint(.waqtuPrimary)
                }
                .onChange(of: settings.calendarPreBufferMinutes) { _, _ in
                    NotificationCenter.default.post(name: Notification.Name("calendarProtectionSettingsChanged"), object: nil)
                }
                Text("Block your calendar this many minutes before each prayer for wudu and preparation.")
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
    /// Premium on the signed-in Waqtu account (e.g. a subscription bought on the phone).
    var hasAccountPremium: Bool = false
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
        } else if hasAccountPremium {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtuPrimary)
                Text("Premium via your Waqtu account")
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
