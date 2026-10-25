// Built only when WAQTU_IOS_WIDGET=1 (see plugins/withCountdownWidget.js).
/** @type {import("@bacons/apple-targets/app.plugin").ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "CountdownWidget",
  displayName: "Waqtu",
  bundleIdentifier: ".CountdownWidget",
  deploymentTarget: "17.0",
  colors: {
    $accent: "#6BA888",
    $widgetBackground: "#1A2E25",
  },
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
