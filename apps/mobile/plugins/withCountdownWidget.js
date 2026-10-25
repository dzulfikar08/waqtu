// @ts-check
const fs = require("fs");
const path = require("path");
const { withXcodeProject } = require("expo/config-plugins");
// The same pbxproj helpers expo-live-activity (pinned) uses for its own extension, so both targets are added alike.
const {
  addXCConfigurationList,
} = require("expo-live-activity/plugin/build/xcode/addXCConfigurationList");
const { addProductFile } = require("expo-live-activity/plugin/build/xcode/addProductFile");
const {
  addToPbxNativeTargetSection,
} = require("expo-live-activity/plugin/build/xcode/addToPbxNativeTargetSection");
const {
  addToPbxProjectSection,
} = require("expo-live-activity/plugin/build/xcode/addToPbxProjectSection");
const {
  addTargetDependency,
} = require("expo-live-activity/plugin/build/xcode/addTargetDependency");
const { addPbxGroup } = require("expo-live-activity/plugin/build/xcode/addPbxGroup");

/** Shared with modules/waqtu-countdown/ios and targets/countdown-widget/CountdownWidget.swift. */
const APP_GROUP = "group.dat.waqtu.ios";
const TARGET = "CountdownWidget";
const SOURCES = path.join(__dirname, "..", "targets", "countdown-widget");
const EMBED_PHASE = "Embed Foundation Extensions";

/**
 * iOS home-screen widget for the sahur/iftar countdown: a WidgetKit extension built from
 * targets/countdown-widget (bundle dat.waqtu.ios.CountdownWidget) that reads the schedule the app
 * writes to the App Group. Off unless WAQTU_IOS_WIDGET=1, because the extension and the App Group
 * need their own App Store provisioning (steps in .github/workflows/release-ios.yml); without it
 * the project keeps exactly the app and the Live Activity extension.
 *
 * @param {import("expo/config").ExpoConfig} config
 */
module.exports = function withCountdownWidget(config) {
  if (process.env.WAQTU_IOS_WIDGET !== "1") return config;
  const bundleIdentifier = `${config.ios?.bundleIdentifier}.${TARGET}`;
  const entitlements = { "com.apple.security.application-groups": [APP_GROUP] };
  config.ios = {
    ...config.ios,
    entitlements: { ...config.ios?.entitlements, ...entitlements },
  };
  // EAS reads the extra targets to sign from here.
  const extensions = config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? [];
  config.extra = {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...extensions.filter((/** @type {any} */ e) => e.targetName !== TARGET),
              { targetName: TARGET, bundleIdentifier, entitlements },
            ],
          },
        },
      },
    },
  };

  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const targetDir = path.join(config.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(targetDir, { recursive: true });
    const swiftFiles = fs.readdirSync(SOURCES).filter((f) => f.endsWith(".swift"));
    for (const file of [...swiftFiles, "Info.plist"]) {
      fs.copyFileSync(path.join(SOURCES, file), path.join(targetDir, file));
    }
    fs.writeFileSync(
      path.join(targetDir, `${TARGET}.entitlements`),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>
`,
    );

    const targetUuid = project.generateUuid();
    const xCConfigurationList = addXCConfigurationList(project, {
      targetName: TARGET,
      currentProjectVersion: config.ios?.buildNumber || "1",
      bundleIdentifier,
      // containerBackground(for: .widget) needs iOS 17; older devices just do not offer the widget.
      deploymentTarget: "17.0",
      marketingVersion: config.version,
    });
    const productFile = addProductFile(project, { targetName: TARGET, groupName: EMBED_PHASE });
    const target = addToPbxNativeTargetSection(project, {
      targetName: TARGET,
      targetUuid,
      productFile,
      xCConfigurationList,
    });
    addToPbxProjectSection(project, target);
    addTargetDependency(project, target);

    project.addBuildPhase(swiftFiles, "PBXSourcesBuildPhase", "Sources", targetUuid);
    project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", targetUuid);
    project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", targetUuid);
    // Embed the .appex in the app, next to the Live Activity extension when that phase exists.
    const appUuid = project.getFirstTarget().uuid;
    if (!project.buildPhaseObject("PBXCopyFilesBuildPhase", EMBED_PHASE, appUuid)) {
      project.addBuildPhase(
        [],
        "PBXCopyFilesBuildPhase",
        EMBED_PHASE,
        appUuid,
        "app_extension",
        '""',
      );
    }
    project.buildPhaseObject("PBXCopyFilesBuildPhase", EMBED_PHASE, appUuid).files.push({
      value: productFile.uuid,
      comment: `${productFile.basename} in ${EMBED_PHASE}`,
    });
    project.addToPbxBuildFileSection(productFile);

    addPbxGroup(project, {
      targetName: TARGET,
      widgetFiles: {
        swiftFiles,
        intentFiles: [],
        otherFiles: [],
        entitlementFiles: [],
        plistFiles: ["Info.plist"],
        assetDirectories: [],
      },
    });
    return config;
  });
};
