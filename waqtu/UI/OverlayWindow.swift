import AppKit
import SwiftUI

final class OverlayWindow: NSWindow {
    private var overlayTimer: Timer?
    private var onDismissCallback: (() -> Void)?
    private var onSnoozeCallback: ((Int) -> Void)?
    private var isDismissing = false

    init(prayerName: PrayerName, durationMinutes: Int, playAdhanSound: Bool, onDismiss: @escaping () -> Void, onSnooze: ((Int) -> Void)? = nil) {
        super.init(
            contentRect: NSScreen.main?.frame ?? .zero,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.isReleasedWhenClosed = false
        self.onDismissCallback = onDismiss
        self.onSnoozeCallback = onSnooze
        setupWindow(prayerName: prayerName, durationMinutes: durationMinutes, playAdhanSound: playAdhanSound)
    }

    private func setupWindow(prayerName: PrayerName, durationMinutes: Int, playAdhanSound: Bool) {
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
            playAdhanSound: playAdhanSound,
            onDismiss: { [weak self] in
                guard let self = self, !self.isDismissing else { return }
                self.dismissOverlay()
            },
            onSnooze: { [weak self] minutes in
                guard let self = self, !self.isDismissing else { return }
                self.onSnoozeCallback?(minutes)
                self.dismissOverlay()
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
        guard !isDismissing else { return }
        isDismissing = true

        overlayTimer?.invalidate()
        overlayTimer = nil

        let callback = onDismissCallback
        onDismissCallback = nil
        onSnoozeCallback = nil

        // Defer teardown to let the button's action handler and SwiftUI fully complete.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let self = self else {
                callback?()
                return
            }
            // Clear SwiftUI content first to release NSHostingView and stop any timers/observers
            self.contentView = nil
            self.orderOut(nil)
            self.close()
            callback?()
        }
    }

    override var canBecomeKey: Bool { true }
    override var acceptsFirstResponder: Bool { true }

    deinit {
        overlayTimer?.invalidate()
        overlayTimer = nil
        onDismissCallback = nil
        onSnoozeCallback = nil
    }
}
