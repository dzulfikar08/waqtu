import AppKit
import SwiftUI

final class OverlayWindow: NSWindow {
    private var overlayTimer: Timer?

    init(prayerName: PrayerName, durationMinutes: Int, onDismiss: @escaping () -> Void) {
        super.init(
            contentRect: NSScreen.main?.frame ?? .zero,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        setupWindow(prayerName: prayerName, durationMinutes: durationMinutes, onDismiss: onDismiss)
    }

    private func setupWindow(prayerName: PrayerName, durationMinutes: Int, onDismiss: @escaping () -> Void) {
        level = .screenSaver
        if let screen = NSScreen.main {
            setFrame(screen.visibleFrame, display: true)
        }
        isMovable = false
        styleMask = [.borderless, .fullSizeContentView]
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        contentView = NSHostingView(rootView: OverlayView(
            prayerName: prayerName,
            durationMinutes: durationMinutes,
            onDismiss: { [weak self] in
                self?.close()
                onDismiss()
            }
        ))
        overlayTimer = Timer.scheduledTimer(
            withTimeInterval: TimeInterval(durationMinutes * 60),
            repeats: false
        ) { [weak self] _ in
            self?.close()
            onDismiss()
        }
    }

    override var canBecomeKey: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    deinit {
        overlayTimer?.invalidate()
    }
}
