import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";

interface WaqtuICloudKVNative {
  sharedStreakData(): string | null;
}

// iOS only: the old Swift app never shipped on Android, so there is nothing to read there.
const native =
  Platform.OS === "ios" ? requireOptionalNativeModule<WaqtuICloudKVNative>("WaqtuICloudKV") : null;

/**
 * Whether this build can read iCloud key-value storage: iOS, the module linked, and built with the
 * kvstore entitlement (`WAQTU_ICLOUD_KV=1`, see app.config.ts). Without the entitlement every read is
 * nil, so callers must not treat "nothing there" as final.
 */
export const iCloudKVAvailable =
  native !== null && Constants.expoConfig?.extra?.iCloudKVStore === true;

/** The old Swift app's `sharedStreakData` value as JSON text; null when absent or unavailable. */
export function readSharedStreakData(): string | null {
  return iCloudKVAvailable && native ? native.sharedStreakData() : null;
}
