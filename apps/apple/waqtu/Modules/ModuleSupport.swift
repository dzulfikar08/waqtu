//
//  ModuleSupport.swift
//  waqtu
//
//  Shared plumbing of the module windows (halaqah, hafalan, circles): their string table
//  (Modules.xcstrings, kept apart from the main Localizable catalog), the content language and
//  the AppKit windows they open in from the menu bar.
//

import AppKit
import SwiftUI

/// A string from the `Modules` table (Modules.xcstrings, Indonesian + English like the phone app).
func mstr(_ key: String.LocalizationValue) -> String {
    String(localized: key, table: "Modules")
}

enum ModuleLocale {
    /// Bilingual content (halaqah titles, surah names) follows the app language: Indonesian unless
    /// the Mac runs the app in another language, then English.
    static var english: Bool {
        Bundle.main.preferredLocalizations.first != "id"
    }

    /// Unapproved content shows in debug builds only (mobile: `__DEV__`).
    static var isDevBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}

/// One window per module, opened from the menu bar and reused while it is open. The Mac app is a
/// menu bar app (LSUIElement), so opening a window also activates the app.
@MainActor
final class ModuleWindows {
    enum Module: String {
        case halaqah, hafalan, circles
    }

    static let shared = ModuleWindows()

    private var windows: [Module: NSWindow] = [:]
    private var closeObservers: [Module: NSObjectProtocol] = [:]

    func open<Content: View>(_ module: Module, title: String, size: NSSize, content: () -> Content) {
        NSApp.activate(ignoringOtherApps: true)
        if let existing = windows[module] {
            existing.makeKeyAndOrderFront(nil)
            return
        }
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.isReleasedWhenClosed = false
        window.contentMinSize = NSSize(width: min(size.width, 560), height: min(size.height, 420))
        window.contentView = NSHostingView(rootView: content())
        window.center()
        window.setFrameAutosaveName("waqtu.module.\(module.rawValue)")
        windows[module] = window
        // Closing drops the window and its view tree, so a playing video or audio stops.
        closeObservers[module] = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification, object: window, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.forget(module) }
        }
        window.makeKeyAndOrderFront(nil)
    }

    private func forget(_ module: Module) {
        if let observer = closeObservers.removeValue(forKey: module) {
            NotificationCenter.default.removeObserver(observer)
        }
        windows[module]?.contentView = nil
        windows.removeValue(forKey: module)
    }
}
