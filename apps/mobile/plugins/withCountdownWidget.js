// @ts-check
const withAppleTargets = require("@bacons/apple-targets/app.plugin");

/** Shared with src/ramadhan/liveCountdown.ts and targets/countdown-widget. */
const APP_GROUP = "group.dat.waqtu.ios";

/**
 * iOS home-screen widget for the sahur/iftar countdown (targets/countdown-widget, bundle
 * dat.waqtu.ios.CountdownWidget). Off unless WAQTU_IOS_WIDGET=1: the extension and the App Group it
 * shares with the app need their own App Store provisioning, so a build without it keeps exactly
 * the app and the Live Activity extension it had before. See docs in .github/workflows/release-ios.yml.
 *
 * @param {import("expo/config").ExpoConfig} config
 */
module.exports = function withCountdownWidget(config) {
  if (process.env.WAQTU_IOS_WIDGET !== "1") return config;
  config.ios = {
    ...config.ios,
    entitlements: {
      ...config.ios?.entitlements,
      "com.apple.security.application-groups": [APP_GROUP],
    },
  };
  return withAppleTargets(config, { root: "./targets", match: "countdown-widget" });
};
