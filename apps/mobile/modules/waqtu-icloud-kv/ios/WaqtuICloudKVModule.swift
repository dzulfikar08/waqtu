import ExpoModulesCore
import Foundation

public class WaqtuICloudKVModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WaqtuICloudKV")

    // The old Swift app's streak summary: `JSONEncoder().encode(StreakData)` stored as Data under
    // "sharedStreakData" (apps/apple/shared/Core/StreakSyncManager.swift), returned as its UTF-8 JSON
    // text. nil when the key is absent, iCloud is signed out, the first iCloud sync has not arrived
    // yet, or the build lacks the ubiquity-kvstore-identifier entitlement.
    Function("sharedStreakData") { () -> String? in
      let store = NSUbiquitousKeyValueStore.default
      store.synchronize()
      guard let data = store.data(forKey: "sharedStreakData") else { return nil }
      return String(data: data, encoding: .utf8)
    }
  }
}
