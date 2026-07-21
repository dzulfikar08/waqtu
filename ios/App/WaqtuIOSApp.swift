import SwiftUI

/// iOS companion app entry point.
/// Read-only companion — view prayer times, streaks, and settings synced from the Mac app via iCloud.
@main
struct WaqtuIOSApp: App {
    @State private var viewModel = IOSAppViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: viewModel)
        }
    }
}
