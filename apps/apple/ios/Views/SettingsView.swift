import SwiftUI

/// iOS Settings view — mirrors key settings from the Mac app, synced via iCloud.
struct SettingsView: View {
    @Bindable var viewModel: IOSAppViewModel

    var body: some View {
        NavigationStack {
            Form {
                // Prayer Calculation
                Section {
                    Picker("Method", selection: Binding(
                        get: { viewModel.settings.calculationMethod },
                        set: { viewModel.settings.calculationMethod = $0; viewModel.refresh() }
                    )) {
                        Text("Muslim World League").tag("muslimWorldLeague")
                        Text("ISNA").tag("northAmerica")
                        Text("Egyptian").tag("egyptian")
                        Text("Umm Al-Qura").tag("ummAlQura")
                        Text("Karachi").tag("karachi")
                        Text("Moonsighting").tag("moonsightingCommittee")
                        Text("Diyanet").tag("diyanet")
                        Text("Tehran").tag("tehran")
                    }

                    Picker("Asr School", selection: Binding(
                        get: { viewModel.settings.madhab },
                        set: { viewModel.settings.madhab = $0; viewModel.refresh() }
                    )) {
                        Text("Shafi'i (Standard)").tag("shafi")
                        Text("Hanafi").tag("hanafi")
                    }

                    Picker("High Latitude", selection: Binding(
                        get: { viewModel.settings.highLatitudeRule },
                        set: { viewModel.settings.highLatitudeRule = $0; viewModel.refresh() }
                    )) {
                        Text("Auto").tag("auto")
                        Text("Middle of Night").tag("middleOfTheNight")
                        Text("Seventh of Night").tag("seventhOfTheNight")
                        Text("Twilight Angle").tag("twilightAngle")
                    }
                } header: {
                    Text("Calculation Method")
                }

                // Prayer Adjustments
                Section {
                    adjustmentRow(label: "Fajr", value: Binding(
                        get: { viewModel.settings.adjustmentFajr },
                        set: { viewModel.settings.adjustmentFajr = $0; viewModel.refresh() }
                    ))
                    adjustmentRow(label: "Dhuhr", value: Binding(
                        get: { viewModel.settings.adjustmentDhuhr },
                        set: { viewModel.settings.adjustmentDhuhr = $0; viewModel.refresh() }
                    ))
                    adjustmentRow(label: "Asr", value: Binding(
                        get: { viewModel.settings.adjustmentAsr },
                        set: { viewModel.settings.adjustmentAsr = $0; viewModel.refresh() }
                    ))
                    adjustmentRow(label: "Maghrib", value: Binding(
                        get: { viewModel.settings.adjustmentMaghrib },
                        set: { viewModel.settings.adjustmentMaghrib = $0; viewModel.refresh() }
                    ))
                    adjustmentRow(label: "Isha", value: Binding(
                        get: { viewModel.settings.adjustmentIsha },
                        set: { viewModel.settings.adjustmentIsha = $0; viewModel.refresh() }
                    ))
                } header: {
                    Text("Time Adjustments (minutes)")
                }

                // Info
                Section {
                    HStack {
                        Text("Location")
                        Spacer()
                        Text(viewModel.locationLabel)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    HStack {
                        Text("Last Synced")
                        Spacer()
                        Text(lastSyncedFormatted)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Sync Status")
                } footer: {
                    Text("Settings sync automatically via iCloud with your Mac. Prayer streaks update when the Mac app is active.")
                }
            }
            .navigationTitle("Settings")
        }
    }

    private func adjustmentRow(label: String, value: Binding<Int>) -> some View {
        HStack {
            Text(label)
            Spacer()
            Stepper(
                "\(value.wrappedValue > 0 ? "+" : "")\(value.wrappedValue) min",
                value: value,
                in: -60...60,
                step: 1
            )
            .labelsHidden()
        }
    }

    private var lastSyncedFormatted: String {
        let date = viewModel.streakSync.streakData.lastUpdated
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
