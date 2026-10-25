import ExpoModulesCore
import WidgetKit

/// iOS side of the countdown module: only the home-screen widget feed (the lock-screen countdown is a Live Activity,
/// see src/ramadhan/liveCountdown.ts). The widget extension is built only with WAQTU_IOS_WIDGET=1
/// (plugins/withCountdownWidget.js); without it, or without the App Group entitlement, this writes to a store
/// nobody reads and the reload does nothing.
public class WaqtuCountdownModule: Module {
  // Shared with targets/countdown-widget/CountdownWidget.swift.
  private static let appGroup = "group.dat.waqtu.ios"
  private static let scheduleKey = "countdownSchedule"
  private static let widgetKind = "WaqtuCountdownWidget"

  public func definition() -> ModuleDefinition {
    Name("WaqtuCountdown")

    Function("setWidgetSchedule") { (json: String) in
      UserDefaults(suiteName: Self.appGroup)?.set(json, forKey: Self.scheduleKey)
      WidgetCenter.shared.reloadTimelines(ofKind: Self.widgetKind)
    }
  }
}
