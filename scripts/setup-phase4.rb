#!/usr/bin/env ruby
# Comprehensive Phase 4 setup — creates all targets, links deps, embeds widgets.
# Run: ruby scripts/setup-phase4.rb

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
TEAM = 'F6Q6UFUK69'

def configure(project, target, platform, bundle_id, extra = {})
  target.build_configurations.each do |c|
    c.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
    c.build_settings['DEVELOPMENT_TEAM'] = TEAM
    c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    c.build_settings['SWIFT_VERSION'] = '5.0'
    c.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
    c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
    c.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
    
    if platform == :ios
      c.build_settings['SDKROOT'] = 'iphoneos'
      c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
      c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
      c.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
    elsif platform == :watchos
      c.build_settings['SDKROOT'] = 'watchos'
      c.build_settings['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
      c.build_settings['TARGETED_DEVICE_FAMILY'] = '4'
      c.build_settings['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
    elsif platform == :macext
      c.build_settings['SDKROOT'] = 'macosx'
      c.build_settings['MACOSX_DEPLOYMENT_TARGET'] = '15.0'
      c.build_settings['SKIP_INSTALL'] = 'YES'
    elsif platform == :iosext
      c.build_settings['SDKROOT'] = 'iphoneos'
      c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
      c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
      c.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
      c.build_settings['SKIP_INSTALL'] = 'YES'
    end
    extra.each { |k, v| c.build_settings[k] = v }
  end
end

def add_sync(project, target, path)
  g = project.new(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup)
  g.path = path
  target.file_system_synchronized_groups << g
  project.main_group << g
  g
end

# --------------------------------------------------------------------------
puts "Opening project..."
project = Xcodeproj::Project.open(PROJECT_PATH)

# Find existing refs
mac_target = project.targets.find { |t| t.name == 'waqtu' }
adhan_dep = mac_target.package_product_dependencies.find { |d| d.to_hash['productName'] == 'Adhan' }

# Add shared/ to macOS target
add_sync(project, mac_target, 'shared')
puts "shared/ → macOS app"

# --- iOS App ---
ios = project.new_target('com.apple.product-type.application', 'waqtu-ios', :ios, '17.0')
ios.product_type = 'com.apple.product-type.application'
configure(project, ios, :ios, 'dat.waqtu.ios',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu',
  'INFOPLIST_KEY_UILaunchScreen_Generation' => 'YES',
  'INFOPLIST_KEY_UISupportedInterfaceOrientations' => 'UIInterfaceOrientationPortrait',
  'CURRENT_PROJECT_VERSION' => '1', 'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'ios/ios.entitlements',
  'ASSETCATALOG_COMPILER_APPICON_NAME' => 'AppIcon',
)
add_sync(project, ios, 'ios')
add_sync(project, ios, 'shared')
ios.package_product_dependencies << adhan_dep
puts "waqtu-ios created"

# --- iOS Widget ---
iw = project.new_target('com.apple.product-type.app-extension', 'waqtu-widget', :ios, '17.0')
iw.product_type = 'com.apple.product-type.app-extension'
configure(project, iw, :iosext, 'dat.waqtu.ios.widget',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu Widget',
  'CURRENT_PROJECT_VERSION' => '1', 'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'ios-widget/ios-widget.entitlements',
)
add_sync(project, iw, 'ios-widget')
add_sync(project, iw, 'shared')
iw.package_product_dependencies << adhan_dep
puts "waqtu-widget created"

# Embed iOS widget
ios.add_dependency(iw)
cp = ios.new_copy_files_build_phase('Embed App Extensions')
cp.dst_subfolder_spec = '13'
bf = project.new(Xcodeproj::Project::Object::PBXBuildFile)
bf.file_ref = iw.product_reference
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
cp.files << bf
puts "iOS widget embedded"

# --- watchOS App ---
watch = project.new_target('com.apple.product-type.application', 'waqtu-watch', :watchos, '10.0')
watch.product_type = 'com.apple.product-type.application'
configure(project, watch, :watchos, 'dat.waqtu.watch',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu',
  'INFOPLIST_KEY_WKCompanionAppBundleIdentifier' => 'dat.waqtu.ios',
  'CURRENT_PROJECT_VERSION' => '1', 'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'watch/watch.entitlements',
  'ASSETCATALOG_COMPILER_APPICON_NAME' => 'AppIcon',
)
add_sync(project, watch, 'watch')
add_sync(project, watch, 'shared')
watch.package_product_dependencies << adhan_dep
puts "waqtu-watch created"

# --- macOS Widget ---
mw = project.new_target('com.apple.product-type.app-extension', 'waqtu-mac-widget', :macos, '15.0')
mw.product_type = 'com.apple.product-type.app-extension'
configure(project, mw, :macext, 'dat.waqtu.mac-widget',
  'INFOPLIST_KEY_CFBundleDisplayName' => 'Waqtu Widget',
  'CURRENT_PROJECT_VERSION' => '1', 'MARKETING_VERSION' => '1.0',
  'CODE_SIGN_ENTITLEMENTS' => 'macos-widget/macos-widget.entitlements',
)
add_sync(project, mw, 'macos-widget')
add_sync(project, mw, 'shared')
mw.package_product_dependencies << adhan_dep
puts "waqtu-mac-widget created"

# Embed macOS widget
mac_target.add_dependency(mw)
mcp = mac_target.new_copy_files_build_phase('Embed App Extensions')
mcp.dst_subfolder_spec = '13'
mbf = project.new(Xcodeproj::Project::Object::PBXBuildFile)
mbf.file_ref = mw.product_reference
mbf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
mcp.files << mbf
puts "macOS widget embedded"

# Save
project.save
puts "\n✅ Done! All 4 targets created and configured."
puts "Open in Xcode and build."
