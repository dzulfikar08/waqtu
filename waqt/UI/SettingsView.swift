import SwiftUI

struct SettingsView: View {
    @Bindable var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Text("Settings").font(.title).fontWeight(.bold)
            Group {
                Toggle("Enable Overlay Enforcement", isOn: $settings.overlayEnabled)
                VStack(alignment: .leading) {
                    Text("Overlay Duration: \(settings.overlayDuration) minutes").font(.subheadline)
                    Slider(value: Binding(
                        get: { Double(settings.overlayDuration) },
                        set: { settings.overlayDuration = Int($0) }
                    ), in: 5...15, step: 1)
                }.padding(.leading, 16)
            }
            Divider()
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
                    }.padding(.leading, 16)
                }
            }
            Divider()
            Toggle("Launch at Login", isOn: $settings.launchAtLogin)
            Divider()
            VStack(alignment: .leading, spacing: 8) {
                Text("Daily Quote").font(.headline)
                Text(AppSettings.quranicQuote).font(.body).foregroundStyle(.secondary)
                Text(AppSettings.quranicReference).font(.caption).foregroundStyle(.tertiary)
            }
            Spacer()
            HStack {
                Spacer()
                Button("Done") { dismiss() }.buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 400, height: 500)
    }
}
