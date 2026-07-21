import SwiftUI

/// Apple Watch app entry point.
@main
struct WaqtuWatchApp: App {
    @State private var viewModel = WatchViewModel()

    var body: some Scene {
        WindowGroup {
            WatchContentView(viewModel: viewModel)
        }
    }
}
