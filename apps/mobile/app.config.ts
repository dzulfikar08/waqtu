import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json plus build-time switches.
 *
 * WAQTU_ICLOUD_KV=1 adds the iCloud key-value storage entitlement, so the app can import the old Swift
 * app's streak (modules/waqtu-icloud-kv). The identifier is the one every Swift target uses
 * (apps/apple/ios/ios.entitlements), so this app reads the same store. Off by default: the App Store
 * profile in IOS_PROVISIONING_PROFILE_BASE64 must come from an App ID with iCloud enabled, or signing
 * fails. Turn it on only once that profile is in place (see .github/workflows/release-ios.yml).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iCloudKVStore = process.env.WAQTU_ICLOUD_KV === "1";
  return {
    ...config,
    name: config.name ?? "Waqtu",
    slug: config.slug ?? "waqtu",
    ios: {
      ...config.ios,
      ...(iCloudKVStore && {
        entitlements: {
          ...config.ios?.entitlements,
          "com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)dat.waqtu",
        },
      }),
    },
    extra: { ...config.extra, iCloudKVStore },
  };
};
