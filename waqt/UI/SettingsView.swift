import SwiftUI
import ServiceManagement

struct SettingsView: View {
    @Bindable var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Settings").font(.title).fontWeight(.bold)

            // Overlay settings
            Group {
                Toggle("Enable Overlay Enforcement", isOn: $settings.overlayEnabled)

                Button("Test Overlay") {
                    showTestOverlay()
                }
                .buttonStyle(.bordered)
                .padding(.leading, 16)

                VStack(alignment: .leading) {
                    HStack {
                        Text("Overlay Duration:")
                        Text("\(settings.overlayDuration) minutes")
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                    }
                    .font(.subheadline)

                    Text("The overlay will auto-dismiss after this duration (mimicking prayer time)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)

                    Slider(value: Binding(
                        get: { Double(settings.overlayDuration) },
                        set: { settings.overlayDuration = Int($0) }
                    ), in: 5...15, step: 1)
                }
                .padding(.leading, 16)
            }

            Divider()

            // Location settings
            Group {
                Toggle("Auto-detect Location", isOn: $settings.autoDetectLocation)
                if !settings.autoDetectLocation {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Latitude:")
                            TextField("Latitude", value: $settings.manualLatitude, format: .number)
                                .textFieldStyle(.roundedBorder).frame(width: 120)
                        }
                        HStack {
                            Text("Longitude:")
                            TextField("Longitude", value: $settings.manualLongitude, format: .number)
                                .textFieldStyle(.roundedBorder).frame(width: 120)
                        }
                        Button("Apply Location") {
                            NotificationCenter.default.post(name: .locationSettingsChanged, object: nil)
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.leading, 16)
                }
            }

            Divider()

            // Launch at login
            Toggle("Launch at Login", isOn: $settings.launchAtLogin)
                .onChange(of: settings.launchAtLogin) { _, newValue in
                    toggleLaunchAtLogin(newValue)
                }

            Divider()

            // Quranic quote
            VStack(alignment: .leading, spacing: 8) {
                Text("Daily Quote").font(.headline)
                Text(AppSettings.quranicQuote).font(.body).foregroundStyle(.secondary)
                Text(AppSettings.quranicReference).font(.caption).foregroundStyle(.tertiary)
            }

            Spacer()

            // Done button
            HStack {
                Spacer()
                Button("Done") { dismiss() }.buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 400, height: 550)
    }

    private func showTestOverlay() {
        let testWindow = OverlayWindow(
            prayerName: .maghrib,
            durationMinutes: settings.overlayDuration
        ) {
            // Auto-dismiss on test
        }
        testWindow.makeKeyAndOrderFront(nil)
    }

    private func toggleLaunchAtLogin(_ enabled: Bool) {
        if #available(macOS 13.0, *) {
            do {
                if enabled {
                    try SMAppService.mainApp.register()
                } else {
                    try SMAppService.mainApp.unregister()
                }
            } catch {
                print("Failed to \(enabled ? "enable" : "disable") launch at login: \(error)")
            }
        }
    }
}

extension Notification.Name {
    static let locationSettingsChanged = Notification.Name("locationSettingsChanged")
}
