#!/usr/bin/env ruby
# Add Phase 4 targets to Waqtu Xcode project:
#   - iOS companion app
#   - iOS Widget extension  
#   - watchOS app
#   - macOS Widget extension
#
# Usage: ruby scripts/add-phase4-targets.rb

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
TEAM_ID = 'F6Q6UFUK69'
APP_GROUP = 'group.com.waqtu.shared'

COMMON_SETTINGS = {
  'CODE_SIGN_STYLE' => 'Automatic',
  'DEVELOPMENT_TEAM' => TEAM_ID,
  'GENERATE_INFOPLIST_FILE' => 'YES',
  'SWIFT_VERSION' => '5.0',
  'SWIFT_EMIT_LOC_STRINGS' => 'YES',
  'ENABLE_PREVIEWS' => 'YES',
}

def configure_target(target, platform, extra = {})
  target.build_configurations.each do |config|
    COMMON_SETTINGS.each { |k, v| config.build_settings[k] = v }
    extra.each { |k, v| config.build_settings[k] = v }

    case platform
    when :ios
      config.build_settings['SDKROOT'] = 'iphoneos'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
      config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
      config.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
      config.build_settings['SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'
      config.build_settings['SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'
      config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon' unless extra['SKIP_INSTALL']
    when :watchos
      config.build_settings['SDKROOT'] = 'watchos'
      config.build_settings['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
      config.build_settings['TARGETED_DEVICE_FAMILY'] = '4'
      config.build_settings['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
      config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
      config.build_settings['IBSC_MODULE'] = 'waqtu_watch_extension' rescue nil
    when :widget_ios
      config.build_settings['SDKROOT'] = 'iphoneos'
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
      config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
      config.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
      config.build_settings['SKIP_INSTALL'] = 'YES'
    when :widget_macos
      config.build_settings['SDKROOT'] = 'macosx'
      config.build_settings['MACOSX_DEPLOYMENT_TARGET'] = '15.0'
      config.build_settings['SKIP_INSTALL'] = 'YES'
    end
  end
end

def add_sync_group(project, target, path)
  group = project.new(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup)
  group.path = path
  target.file_system_synchronized_groups << group
  project.main_group << group
  group
end

def add_package_dep(target, package_ref_uuid, product_name)
  # Create XCSwiftPackageProductDependency
  project = target.project
  dep = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
  dep.package = project.objects_by_uuid[package_ref_uuid] || project.files.find { |f| f.uuid == package_ref_uuid }
  # Set manually via plist
  dep_hash = dep.to_hash
  dep_hash['package'] = package_ref_uuid
  dep_hash['productName'] = product_name
  target.package_product_dependencies << dep
  dep
end

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

puts "Opening: #{PROJECT_PATH}"
project = Xcodeproj::Project.open(PROJECT_PATH)

# Package references (find existing ones from the pbxproj)
adhan_package_ref = nil
sparkle_package_ref = nil
project.root_object.package_references.each do |ref|
  if ref.to_hash['repositoryURL'].include?('Adhan')
    adhan_package_ref = ref
  elsif ref.to_hash['repositoryURL'].include?('Sparkle')
    sparkle_package_ref = ref
  end
end
puts "Found Adhan package: #{adhan_package_ref&.uuid}"
puts "Found Sparkle package: #{sparkle_package_ref&.uuid}"

# Get existing product ref UUIDs for reference
adhan_product_ref_uuid = nil
project.objects_by_uuid.each do |uuid, obj|
  if obj.is_a?(Hash) && obj['isa'] == 'XCSwiftPackageProductDependency' && obj['productName'] == 'Adhan'
    adhan_product_ref_uuid = uuid
  end
end
puts "Existing Adhan product ref: #{adhan_product_ref_uuid}"

# 1. Add shared/ synchronized group to existing macOS target
puts "\n📦 Adding shared/ to macOS target..."
mac_target = project.targets.find { |t| t.product_type == 'com.apple.product-type.application' && t.name == 'waqtu' }
if mac_target
  add_sync_group(project, mac_target, 'shared')
  puts "   ✅ shared/ added to waqtu"
end

# 2. Create iOS app target
puts "\n📱 Creating iOS app target..."
ios_target = project.new_target(
  'com.apple.product-type.application',
  'waqtu-ios',
  :ios,
  '17.0'
)
configure_target(ios_target, :ios, {
  'PRODUCT_BUNDLE_IDENTIFIER' => 'dat.waqtu.ios',
  'PRODUCT_NAME' => 'waqtu-ios',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu',
  'INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents' => 'YES',
  'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
  'INFOPLIST_KEY_UISupportedInterfaceOrientations' => 'UIInterfaceOrientationPortrait',
  'CURRENT_PROJECT_VERSION' => '1',
  'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'ios/ios.entitlements',
})
add_sync_group(project, ios_target, 'ios')
add_sync_group(project, ios_target, 'shared')
puts "   ✅ waqtu-ios created"

# 3. Create iOS Widget extension target
puts "\n🧩 Creating iOS Widget extension..."
ios_widget = project.new_target(
  'com.apple.product-type.app-extension',
  'waqtu-widget',
  :ios,
  '17.0'
)
configure_target(ios_widget, :widget_ios, {
  'PRODUCT_BUNDLE_IDENTIFIER' => 'dat.waqtu.ios.widget',
  'PRODUCT_NAME' => 'waqtu-widget',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu Widget',
  'INFOPLIST_KEY_NSExtension' => {
    'NSExtensionPointIdentifier' => 'com.apple.widgetkit-extension'
  },
  'CURRENT_PROJECT_VERSION' => '1',
  'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'ios-widget/ios-widget.entitlements',
  'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME' => 'AccentColor',
})
add_sync_group(project, ios_widget, 'ios-widget')
add_sync_group(project, ios_widget, 'shared')
puts "   ✅ waqtu-widget created"

# 4. Create watchOS app target
puts "\n⌚ Creating watchOS app target..."
watch_target = project.new_target(
  'com.apple.product-type.application',
  'waqtu-watch',
  :watchos,
  '10.0'
)
configure_target(watch_target, :watchos, {
  'PRODUCT_BUNDLE_IDENTIFIER' => 'dat.waqtu.watch',
  'PRODUCT_NAME' => 'waqtu-watch',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu',
  'INFOPLIST_KEY_UISupportedInterfaceOrientations' => 'UIInterfaceOrientationPortrait',
  'INFOPLIST_KEY_WKCompanionAppBundleIdentifier' => 'dat.waqtu.ios',
  'CURRENT_PROJECT_VERSION' => '1',
  'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'watch/watch.entitlements',
})
add_sync_group(project, watch_target, 'watch')
add_sync_group(project, watch_target, 'shared')
puts "   ✅ waqtu-watch created"

# 5. Create macOS Widget extension target
puts "\n🖥️  Creating macOS Widget extension..."
mac_widget = project.new_target(
  'com.apple.product-type.app-extension',
  'waqtu-mac-widget',
  :macos,
  '15.0'
)
configure_target(mac_widget, :widget_macos, {
  'PRODUCT_BUNDLE_IDENTIFIER' => 'dat.waqtu.mac-widget',
  'PRODUCT_NAME' => 'waqtu-mac-widget',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu Widget',
  'INFOPLIST_KEY_NSExtension' => {
    'NSExtensionPointIdentifier' => 'com.apple.widgetkit-extension'
  },
  'CURRENT_PROJECT_VERSION' => '1',
  'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'macos-widget/macos-widget.entitlements',
  'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME' => 'AccentColor',
})
add_sync_group(project, mac_widget, 'macos-widget')
add_sync_group(project, mac_widget, 'shared')
puts "   ✅ waqtu-mac-widget created"

# 6. Save
puts "\n💾 Saving project..."
project.save
puts "\n✅ Done! Created 4 new targets:"
puts "   📱 waqtu-ios        (#{ios_target.uuid})"
puts "   🧩 waqtu-widget      (#{ios_widget.uuid})"
puts "   ⌚ waqtu-watch       (#{watch_target.uuid})"
puts "   🖥️  waqtu-mac-widget (#{mac_widget.uuid})"
puts "\nBackup saved at: waqt.xcodeproj/project.pbxproj.backup"
puts "\nRemaining manual steps in Xcode:"
puts "  1. Add app icons to asset catalogs"
puts "  2. Enable iCloud (NSUbiquitousKeyValueStore) for waqtu + waqtu-ios"
puts "  3. Embed iOS Widget in iOS app (Build Phases → Embed App Extensions)"
puts "  4. Embed macOS Widget in macOS app (Build Phases → Embed App Extensions)"
puts "  5. Build & test each target"
