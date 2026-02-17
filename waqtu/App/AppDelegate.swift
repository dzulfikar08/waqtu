import Cocoa
import Sparkle

private let sparkleFeedURL = "https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml"

final class AppDelegate: NSObject, NSApplicationDelegate, SPUUpdaterDelegate {
    /// Sparkle updater controller. Used for auto-updates and "Check for Updates" menu item.
    lazy var updaterController: SPUStandardUpdaterController = {
        SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: self,
            userDriverDelegate: nil
        )
    }()

    func feedURLString(for updater: SPUUpdater) -> String? {
        sparkleFeedURL
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}
