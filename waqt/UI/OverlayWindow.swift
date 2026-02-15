import AppKit
import SwiftUI

final class OverlayWindow: NSWindow {
    private var overlayTimer: Timer?
    private var onDismissCallback: (() -> Void)?

    init(prayerName: PrayerName, durationMinutes: Int, onDismiss: @escaping () -> Void) {
        super.init(
            contentRect: NSScreen.main?.frame ?? .zero,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.onDismissCallback = onDismiss
        setupWindow(prayerName: prayerName, durationMinutes: durationMinutes)
    }

    private func setupWindow(prayerName: PrayerName, durationMinutes: Int) {
        level = .screenSaver
        if let screen = NSScreen.main {
            setFrame(screen.visibleFrame, display: true)
        }
        isMovable = false
        styleMask = [.borderless, .fullSizeContentView]
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let hostingView = NSHostingView(rootView: OverlayView(
            prayerName: prayerName,
            durationMinutes: durationMinutes,
            onDismiss: { [weak self] in
                self?.dismissOverlay()
            }
        ))
        contentView = hostingView

        overlayTimer = Timer.scheduledTimer(
            withTimeInterval: TimeInterval(durationMinutes * 60),
            repeats: false
        ) { [weak self] _ in
            self?.dismissOverlay()
        }
    }

    private func dismissOverlay() {
        onDismissCallback?()
        onDismissCallback = nil
        overlayTimer?.invalidate()
        overlayTimer = nil
        super.close()
    }

    override var canBecomeKey: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    deinit {
        overlayTimer?.invalidate()
        overlayTimer = nil
        onDismissCallback = nil
    }
}
