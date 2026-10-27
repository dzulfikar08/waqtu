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
        case halaqah, hafalan, circles, ibadah
    }

    static let shared = ModuleWindows()

    private var windows: [Module: NSWindow] = [:]
    private var closeObservers: [Module: NSObjectProtocol] = [:]

    /// `unifiedTitlebar`: the content runs up behind a transparent title bar (traffic lights over the
    /// window's own sidebar, no title text), for windows that draw their own header.
    func open<Content: View>(
        _ module: Module, title: String, size: NSSize, minSize: NSSize? = nil, unifiedTitlebar: Bool = false,
        content: () -> Content
    ) {
        NSApp.activate(ignoringOtherApps: true)
        if let existing = windows[module] {
            existing.makeKeyAndOrderFront(nil)
            return
        }
        var style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
        if unifiedTitlebar { style.insert(.fullSizeContentView) }
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: style,
            backing: .buffered,
            defer: false
        )
        window.title = title
        if unifiedTitlebar {
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.backgroundColor = NSColor(Color.wqCanvas)
        }
        window.isReleasedWhenClosed = false
        window.contentMinSize = minSize ?? NSSize(width: min(size.width, 560), height: min(size.height, 420))
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

    /// The Mac's Settings window, on `pane` (a `SettingsView.Pane` id) when given.
    static func openSettings(pane: String? = nil) {
        SettingsOpener.show(pane: pane)
    }

    private func forget(_ module: Module) {
        if let observer = closeObservers.removeValue(forKey: module) {
            NotificationCenter.default.removeObserver(observer)
        }
        windows[module]?.contentView = nil
        windows.removeValue(forKey: module)
    }
}

/// Opens the Settings window from anywhere, on a pane. The SwiftUI `openSettings` action is the only
/// way to reach the Settings scene on current macOS (sending `showSettingsWindow:` down the responder
/// chain does nothing in a menu bar app whose windows are not SwiftUI scenes), so the menu bar view
/// hands it over when it appears and every other caller, the module windows included, goes through here.
@MainActor
enum SettingsOpener {
    private static var action: OpenSettingsAction?

    static func register(_ action: OpenSettingsAction) {
        self.action = action
    }

    static func show(pane: String? = nil) {
        if let pane { SettingsView.requestedPane = pane }
        NSApp.activate(ignoringOtherApps: true)
        if let action {
            action()
        } else {
            NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
        }
    }
}
