import SwiftUI
import WaqtuCore

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @State private var locating = false

    var body: some View {
        @Bindable var settings = settings
        Form {
            Section("Location") {
                if let coordinates = settings.coordinates {
                    LabeledContent("Latitude", value: coordinates.latitude.formatted(.number.precision(.fractionLength(4))))
                    LabeledContent("Longitude", value: coordinates.longitude.formatted(.number.precision(.fractionLength(4))))
                    Button {
                        locate()
                    } label: {
                        Label(locating ? "Updating…" : "Update location", systemImage: "location.arrow")
                    }
                } else {
                    Button {
                        locate()
                    } label: {
                        Label(locating ? "Locating…" : "Use my location", systemImage: "location")
                    }
                }
                Text("Prayer times are calculated on device. Your location is never collected or sent anywhere.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Calculation method") {
                Picker("Method", selection: $settings.method) {
                    ForEach(CalculationMethod.allCases) { method in
                        Text(method.displayName).tag(method)
                    }
                }
                Picker("Asr (madhab)", selection: $settings.madhab) {
                    ForEach(Madhab.allCases) { madhab in
                        Text(madhab.displayName).tag(madhab)
                    }
                }
            }
        }
        .navigationTitle("Settings")
    }

    private func locate() {
        locating = true
        Task {
            defer { locating = false }
            let provider = LocationProvider()
            settings.coordinates = try? await provider.requestCoordinates()
        }
    }
}
