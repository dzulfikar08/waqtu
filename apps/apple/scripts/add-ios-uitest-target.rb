#!/usr/bin/env ruby
# Create the iOS UI Test target (waqtu-ios-uitests) for fastlane snapshot screenshots.
# Host app = waqtu-ios. Captures Today / Streaks / Settings screens.
#
# Usage: ruby scripts/add-ios-uitest-target.rb

require 'xcodeproj'

PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
TEAM = 'F6Q6UFUK69'

project = Xcodeproj::Project.open(PROJECT_PATH)

if project.targets.any? { |t| t.name == 'waqtu-ios-uitests' }
  puts "waqtu-ios-uitests already exists — nothing to do."
  exit 0
end

ios = project.targets.find { |t| t.name == 'waqtu-ios' }
abort 'waqtu-ios target not found' unless ios

sync_groups = project.main_group.children.select do |g|
  g.is_a?(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup)
end
uitests_group = sync_groups.find { |g| g.path == 'ios-uitests' }
# Create the group if it doesn't exist yet (it may have been made by hand).
unless uitests_group
  uitests_group = project.new(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup)
  uitests_group.path = 'ios-uitests'
  project.main_group << uitests_group
end

# Create the UI testing bundle target.
t = project.new_target('com.apple.product-type.bundle.ui-testing', 'waqtu-ios-uitests', :ios, '17.0')
t.product_type = 'com.apple.product-type.bundle.ui-testing'
t.file_system_synchronized_groups << uitests_group
t.add_dependency(ios)

t.build_configurations.each do |c|
  c.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  c.build_settings['DEVELOPMENT_TEAM'] = TEAM
  c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'dat.waqtu.ios.uitests'
  c.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['SDKROOT'] = 'iphoneos'
  c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
  c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  c.build_settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
  c.build_settings['TEST_TARGET_NAME'] = 'waqtu-ios'
  c.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
end

project.save
puts "✅ waqtu-ios-uitests target created (uuid: #{t.uuid})"
puts "Host app: waqtu-ios  |  TEST_TARGET_NAME set"
puts "Add the shared scheme in Xcode (or via the xcscheme file), then: fastlane ios_screenshots"
