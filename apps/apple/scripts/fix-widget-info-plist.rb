#!/usr/bin/env ruby
# Point the WidgetKit extension targets at real Info.plist files (with the
# NSExtension dict) instead of GENERATE_INFOPLIST_FILE=YES. The host app fails
# to install on device/simulator if the .appex has no extension dictionary, and
# INFOPLIST_KEY_NSExtension can't be a nested dict (Xcode rejects it as a macro).
#
# Usage: ruby scripts/fix-widget-info-plist.rb

require 'xcodeproj'
PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
project = Xcodeproj::Project.open(PROJECT_PATH)

{
  'waqtu-widget'     => 'ios-widget/Info.plist',
  'waqtu-mac-widget' => 'macos-widget/Info.plist'
}.each do |name, plist|
  t = project.targets.find { |x| x.name == name }
  next unless t
  t.build_configurations.each do |c|
    c.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
    c.build_settings['INFOPLIST_FILE'] = plist
    c.build_settings.delete('INFOPLIST_KEY_NSExtension') if c.build_settings.key?('INFOPLIST_KEY_NSExtension')
  end
  puts "✅ #{name} -> INFOPLIST_FILE=#{plist} (GENERATE_INFOPLIST_FILE=NO)"
end

project.save
puts "done"
