//
//  waqtuApp.swift
//  waqtu
//
//  Created by dzul on 15/02/26.
//

import SwiftUI
import AppKit
import Sparkle

// View model for "Check for Updates" menu item enabled state (Sparkle SwiftUI example).
final class CheckForUpdatesViewModel: ObservableObject {
    @Published var canCheckForUpdates = false

    init(updater: SPUUpdater) {
        updater.publisher(for: \.canCheckForUpdates)
            .assign(to: &$canCheckForUpdates)
    }
}

struct CheckForUpdatesView: View {
    @ObservedObject private var checkForUpdatesViewModel: CheckForUpdatesViewModel
    private let updater: SPUUpdater

    init(updater: SPUUpdater) {
        self.updater = updater
        self.checkForUpdatesViewModel = CheckForUpdatesViewModel(updater: updater)
    }

    var body: some View {
        Button("Check for Updates…", action: updater.checkForUpdates)
            .disabled(!checkForUpdatesViewModel.canCheckForUpdates)
    }
}

@main
struct WaqtuApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var viewModel = AppViewModel()

    private static var menuBarIcon: NSImage? = {
        guard let img = NSImage(named: "MutabaahSymbol") else { return nil }
        img.size = NSSize(width: 16, height: 16)
        return img
    }()

    var body: some Scene {
        // Menu bar: custom symbol as NSImage at fixed size (SwiftUI frame is ignored by menu bar)
        MenuBarExtra {
            MenuBarView(viewModel: viewModel)
        } label: {
            if let icon = Self.menuBarIcon {
                Image(nsImage: icon)
            } else {
                Image("MutabaahSymbol")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 16, height: 16)
            }
        }
        .menuBarExtraStyle(.window)

        #if os(macOS)
        Settings {
            SettingsView(settings: viewModel.settings, viewModel: viewModel)
        }
        .windowResizability(.contentSize)
        .defaultSize(width: 460, height: 560)
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updater: appDelegate.updaterController.updater)
            }
        }
        #endif
    }
}
