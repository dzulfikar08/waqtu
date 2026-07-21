#!/usr/bin/env ruby
# Create a Mac App Store variant of the macOS app target ("waqtu-mas").
#
# Differences from the direct-distribution "waqtu" target:
#   - No Sparkle (banned under MAS sandbox). Uses #if canImport(Sparkle) in source.
#   - MAS compilation flag -> StoreKit 2 licensing instead of Polar.sh.
#   - Sandbox + network entitlements, LSUIElement, Apple Distribution signing.
#
# Usage: ruby scripts/add-mas-target.rb

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
TEAM = 'F6Q6UFUK69'

project = Xcodeproj::Project.open(PROJECT_PATH)

if project.targets.any? { |t| t.name == 'waqtu-mas' }
  puts "waqtu-mas target already exists — nothing to do."
  exit 0
end

mac = project.targets.find { |t| t.name == 'waqtu' }
abort 'waqtu target not found' unless mac

# Reuse the existing Adhan product dependency (NOT Sparkle).
adhan_dep = mac.package_product_dependencies.find { |d| (d.respond_to?(:productName) ? d.productName : d.to_hash['productName']) == 'Adhan' }
abort 'Adhan product dependency not found' unless adhan_dep

# Reuse existing synchronized root groups so waqtu-mas compiles the same sources.
sync_groups = project.main_group.children.select do |g|
  g.is_a?(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup)
end
waqtu_group = sync_groups.find { |g| g.path == 'waqtu' }
shared_group = sync_groups.find { |g| g.path == 'shared' }
abort 'waqtu sync group not found' unless waqtu_group
abort 'shared sync group not found' unless shared_group

mw = project.targets.find { |t| t.name == 'waqtu-mac-widget' }
abort 'waqtu-mac-widget target not found' unless mw

# --- Create the MAS target -------------------------------------------------
mas = project.new_target('com.apple.product-type.application', 'waqtu-mas', :macos, '15.0')
mas.product_type = 'com.apple.product-type.application'

mas.file_system_synchronized_groups << waqtu_group
mas.file_system_synchronized_groups << shared_group
mas.package_product_dependencies << adhan_dep

CAL_DESC_FULL = "Waqtu creates daily prayer blocks in your calendar so Outlook and Teams show you as busy during prayer times. Full access is required to add and remove these events."
CAL_DESC = "Waqtu creates daily prayer blocks in your calendar so Outlook and Teams show you as busy during prayer times."
LOC_DESC = "Waqtu needs your location to calculate accurate prayer times."

mas.build_configurations.each do |c|
  c.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  c.build_settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  c.build_settings['ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS'] = 'YES'
  c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'waqtu-mas/waqtu-mas.entitlements'
  c.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  c.build_settings['DEVELOPMENT_TEAM'] = TEAM
  c.build_settings['CURRENT_PROJECT_VERSION'] = '28'
  c.build_settings['MARKETING_VERSION'] = '1.9.0'
  c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  c.build_settings['INFOPLIST_KEY_CFBundleDisplayName'] = 'Waqtu'
  c.build_settings['INFOPLIST_KEY_LSUIElement'] = 'YES'
  c.build_settings['INFOPLIST_KEY_NSCalendarsFullAccessUsageDescription'] = CAL_DESC_FULL
  c.build_settings['INFOPLIST_KEY_NSCalendarsUsageDescription'] = CAL_DESC
  c.build_settings['INFOPLIST_KEY_NSLocationWhenInUseUsageDescription'] = LOC_DESC
  c.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/../Frameworks', '@executable_path/Frameworks']
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'dat.waqtu'
  c.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  c.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) MAS'
  c.build_settings['ENABLE_PREVIEWS'] = 'YES'
  c.build_settings['ENABLE_HARDENED_RUNTIME'] = 'YES' if c.name == 'Release'
end

# --- Embed the macOS widget extension -------------------------------------
mas.add_dependency(mw)
cp = mas.new_copy_files_build_phase('Embed App Extensions')
cp.dst_subfolder_spec = '13'
bf = project.new(Xcodeproj::Project::Object::PBXBuildFile)
bf.file_ref = mw.product_reference
bf.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
cp.files << bf

project.save

puts "✅ waqtu-mas target created (uuid: #{mas.uuid})"
puts "Bundle id: dat.waqtu  (same app, MAS distribution channel)"
puts "Next: create the shared scheme, then archive with an Apple Distribution identity."
