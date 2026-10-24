import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

interface WaqtuBackupNative {
  excludeFromBackup(uri: string): void;
}

// iOS only. Android backups are off for the whole app (`allowBackup: false` in app.json).
const native =
  Platform.OS === "ios" ? requireOptionalNativeModule<WaqtuBackupNative>("WaqtuBackup") : null;

/** Keeps a file or folder (file:// URI) out of iCloud and iTunes backups. A no-op where backups are off. */
export function excludeFromBackup(uri: string): void {
  native?.excludeFromBackup(uri);
}
