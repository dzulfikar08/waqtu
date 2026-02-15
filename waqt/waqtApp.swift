//
//  waqtApp.swift
//  waqt
//
//  Created by dzul on 15/02/26.
//

import SwiftUI
import AppKit

@main
struct WaqtApp: App {
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
        #endif
    }
}
