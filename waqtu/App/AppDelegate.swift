import Cocoa
import ServiceManagement
import CoreLocation
import UserNotifications
#if canImport(Sparkle)
import Sparkle
#endif

#if canImport(Sparkle)
private let sparkleFeedURL = "https://waqt-updates.dzulfikar-at.workers.dev/appcast.xml"
#endif
private let updateNotificationIdentifier = "WaqtuUpdateAvailable"

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    private let locationManager = CLLocationManager()

    #if canImport(Sparkle)
    /// Sparkle updater controller. Used for auto-updates and "Check for Updates" menu item.
    /// Excluded from the Mac App Store build (Sparkle is not allowed under sandbox).
    lazy var updaterController: SPUStandardUpdaterController = {
        SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: self,
            userDriverDelegate: self
        )
    }()
    #endif

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        requestLocationPermission()
        UNUserNotificationCenter.current().delegate = self
        Self.applyLaunchAtLogin(UserDefaults.standard.bool(forKey: "launchAtLogin"))
        showOnboardingIfNeeded()
    }

    private func showOnboardingIfNeeded() {
        guard !UserDefaults.standard.bool(forKey: "hasCompletedOnboarding") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let window = OnboardingWindow {
                UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
            }
            window.makeKeyAndOrderFront(nil)
        }
    }

    /// Registers or unregisters the app with macOS login items. Call when the user toggles the setting or on launch.
    /// - Returns: `false` if registration failed (e.g. user denied in System Settings); caller should revert the toggle.
    @discardableResult
    static func applyLaunchAtLogin(_ enabled: Bool) -> Bool {
        let service = SMAppService.mainApp
        do {
            if enabled {
                try service.register()
            } else {
                try service.unregister()
            }
            return true
        } catch {
            NSLog("Launch at Login: failed to %@: %@", enabled ? "register" : "unregister", error.localizedDescription)
            if enabled {
                UserDefaults.standard.set(false, forKey: "launchAtLogin")
            }
            return false
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if response.notification.request.identifier == updateNotificationIdentifier,
           response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            #if canImport(Sparkle)
            updaterController.checkForUpdates(nil)
            #endif
        }
        completionHandler()
    }

    private func requestLocationPermission() {
        let status: CLAuthorizationStatus
        if #available(macOS 14.0, *) {
            status = locationManager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        switch status {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        default:
            break
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

// MARK: - Sparkle (direct-distribution auto-updates). Excluded from Mac App Store build.
#if canImport(Sparkle)
extension AppDelegate: SPUUpdaterDelegate, SPUStandardUserDriverDelegate {
    func feedURLString(for updater: SPUUpdater) -> String? {
        sparkleFeedURL
    }

    func updater(_ updater: SPUUpdater, willScheduleUpdateCheckAfterDelay delay: TimeInterval) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.badge, .alert, .sound]) { _, _ in }
    }

    // MARK: SPUStandardUserDriverDelegate (Gentle Reminders for background app)

    var supportsGentleScheduledUpdateReminders: Bool { true }

    func standardUserDriverWillHandleShowingUpdate(_ handleShowingUpdate: Bool, forUpdate update: SUAppcastItem, state: SPUUserUpdateState) {
        NSApp.setActivationPolicy(.regular)
        if !state.userInitiated {
            NSApp.dockTile.badgeLabel = "1"
            let content = UNMutableNotificationContent()
            content.title = "Update available"
            content.body = "Waqtu \(update.displayVersionString) is ready to install"
            let request = UNNotificationRequest(identifier: updateNotificationIdentifier, content: content, trigger: nil)
            UNUserNotificationCenter.current().add(request)
        }
    }

    func standardUserDriverDidReceiveUserAttention(forUpdate update: SUAppcastItem) {
        NSApp.dockTile.badgeLabel = ""
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [updateNotificationIdentifier])
    }

    func standardUserDriverWillFinishUpdateSession() {
        NSApp.setActivationPolicy(.accessory)
    }
}
#endif
