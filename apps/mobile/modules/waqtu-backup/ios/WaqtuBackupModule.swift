import ExpoModulesCore

internal final class ExcludeFromBackupException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "Could not exclude \(param) from backup"
  }
}

public class WaqtuBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WaqtuBackup")

    // Marks a file or folder (a file:// URI) as excluded from iCloud and iTunes backups. The mark
    // covers everything inside a folder and survives app restarts; it is lost if the item is replaced.
    Function("excludeFromBackup") { (uri: String) throws in
      guard var url = URL(string: uri), url.isFileURL else {
        throw ExcludeFromBackupException(uri)
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
      } catch {
        throw ExcludeFromBackupException(uri)
      }
    }
  }
}
