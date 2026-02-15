import SwiftUI

struct MenuBarView: View {
    @Bindable var viewModel: AppViewModel
    @State private var showingSettings = false

    init(viewModel: AppViewModel) {
        self.viewModel = viewModel
    }

    var body: some View {
        VStack(spacing: 0) {
            if let nextPrayer = viewModel.nextPrayer {
                HStack {
                    Image(systemName: nextPrayer.name.iconName)
                    Text("\(nextPrayer.name.displayName): \(nextPrayer.time, style: .time)")
                    Spacer()
                    Text(countdownText)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
                .padding()
            } else {
                Text("Loading...").padding()
            }
            Divider()
            if !viewModel.todayPrayers.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(viewModel.todayPrayers) { prayer in
                        HStack {
                            Image(systemName: prayer.name.iconName)
                            Text(prayer.name.displayName)
                            Spacer()
                            Text(prayer.time, style: .time)
                                .foregroundStyle(prayer.hasPassed ? .secondary : .primary)
                        }
                    }
                }
                .padding()
            }
            Divider()
            Toggle("Enable Overlay", isOn: $viewModel.settings.overlayEnabled).padding()
            Divider()
            Button("Settings...") { showingSettings = true }.buttonStyle(.plain).padding()
            Button("Quit") { NSApplication.shared.terminate(nil) }.buttonStyle(.plain).padding()
        }
        .frame(width: 250)
        .sheet(isPresented: $showingSettings) {
            SettingsView(settings: viewModel.settings)
        }
    }

    private var countdownText: String {
        guard viewModel.nextPrayer != nil else { return "--:--" }
        let minutes = viewModel.countdown / 60
        let seconds = viewModel.countdown % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}
