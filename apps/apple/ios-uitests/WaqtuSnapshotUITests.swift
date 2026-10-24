import XCTest

/// Drives the iOS app through each tab and captures screenshots for App Store.
/// Run with:  fastlane ios_screenshots
final class WaqtuSnapshotUITests: XCTestCase {
    @MainActor
    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launch()

        // Auto-dismiss any system permission prompt (e.g. location) so it doesn't cover the UI.
        let monitor = addUIInterruptionMonitor(withDescription: "System permission dialog") { alert -> Bool in
            for label in ["Allow Once", "Allow While Using App", "Allow", "Don't Allow"] {
                if alert.buttons[label].exists {
                    alert.buttons[label].tap()
                    return true
                }
            }
            return false
        }
        app.tap() // give the interruption monitor a turn

        // 01 — Today (default tab): countdown + prayer list
        snapshot("01_Today")

        // 02 — Streaks: streak stats + weekly heatmap
        if app.tabBars.buttons["Streaks"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Streaks"].tap()
            snapshot("02_Streaks")
        }

        // 03 — Settings: method, adjustments, sync
        if app.tabBars.buttons["Settings"].waitForExistence(timeout: 5) {
            app.tabBars.buttons["Settings"].tap()
            snapshot("03_Settings")
        }

        removeUIInterruptionMonitor(monitor)
    }
}
