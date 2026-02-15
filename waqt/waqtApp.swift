//
//  waqtApp.swift
//  waqt
//
//  Created by dzul on 15/02/26.
//

import SwiftUI

@main
struct WaqtApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var viewModel = AppViewModel()

    var body: some Scene {
        MenuBarExtra("Waqt", systemImage: "moon.fill") {
            MenuBarView(viewModel: viewModel)
        }
    }
}
