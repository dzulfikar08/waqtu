//
//  waqtuApp.swift
//  waqtu
//
//  Created by dzul on 15/02/26.
//

import SwiftUI
import AppKit
#if canImport(Sparkle)
import Sparkle
#endif

// View model for "Check for Updates" menu item enabled state (Sparkle SwiftUI example).
#if canImport(Sparkle)
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
        Button("Check for Updates\u{2026}", action: updater.checkForUpdates)
            .disabled(!checkForUpdatesViewModel.canCheckForUpdates)
    }
}
#endif

@main
struct WaqtuApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var viewModel = AppViewModel()

    private static var menuBarIcon: NSImage? = {
        guard let img = NSImage(named: "MutabaahSymbol") else { return nil }
        img.size = NSSize(width: 16, height: 16)
        return img
    }()

    /// "Check for Updates" action. Nil when Sparkle is unavailable (Mac App Store build),
    /// which hides the menu item and About-settings button via their existing nil-guards.
    private var checkForUpdatesAction: (() -> Void)? {
        #if canImport(Sparkle)
        return { appDelegate.updaterController.updater.checkForUpdates() }
        #else
        return nil
        #endif
    }

    var body: some Scene {
        // Menu bar: custom symbol as NSImage at fixed size (SwiftUI frame is ignored by menu bar)
        MenuBarExtra {
            MenuBarView(viewModel: viewModel)
        } label: {
            if viewModel.pomodoroManager.isRunning {
                HStack(spacing: 3) {
                    Image(systemName: viewModel.pomodoroManager.isPaused
                          ? "pause.circle"
                          : viewModel.pomodoroManager.phase.symbolName)
                    Text(viewModel.pomodoroManager.timeText)
                        .monospacedDigit()
                }
            } else if let icon = Self.menuBarIcon {
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
            SettingsView(
                settings: viewModel.settings,
                viewModel: viewModel,
                onCheckForUpdates: checkForUpdatesAction
            )
        }
        .windowResizability(.contentSize)
        .defaultSize(width: 460, height: 560)
        #if canImport(Sparkle)
        .commands {
            CommandGroup(after: .appInfo) {
                CheckForUpdatesView(updater: appDelegate.updaterController.updater)
            }
        }
        #endif
        #endif
    }
}
