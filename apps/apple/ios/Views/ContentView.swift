import SwiftUI

/// Main tab view for the iOS companion app.
struct ContentView: View {
    @Bindable var viewModel: IOSAppViewModel

    var body: some View {
        TabView {
            TodayView(viewModel: viewModel)
                .tabItem {
                    Label("Today", systemImage: "clock.fill")
                }

            StreakView(viewModel: viewModel)
                .tabItem {
                    Label("Streaks", systemImage: "flame.fill")
                }

            SettingsView(viewModel: viewModel)
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .tint(.waqtuTeal)
    }
}
