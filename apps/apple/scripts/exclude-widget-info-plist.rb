#!/usr/bin/env ruby
# Exclude Info.plist from each widget target's file-system-synchronized group
# so it isn't copied as a resource (collides with INFOPLIST_FILE processing ->
# "Multiple commands produce .../Widget.appex/Info.plist").
#
# Usage: ruby scripts/exclude-widget-info-plist.rb

require 'xcodeproj'
PROJECT_PATH = File.expand_path('../waqt.xcodeproj', __dir__)
project = Xcodeproj::Project.open(PROJECT_PATH)

{
  'ios-widget'     => 'waqtu-widget',
  'macos-widget'   => 'waqtu-mac-widget'
}.each do |group_path, target_name|
  group = project.main_group.children.find do |g|
    g.is_a?(Xcodeproj::Project::Object::PBXFileSystemSynchronizedRootGroup) && g.path == group_path
  end
  abort "sync group #{group_path} not found" unless group

  target = project.targets.find { |t| t.name == target_name }
  abort "target #{target_name} not found" unless target

  # Reuse existing exception set for this target if present, else create one.
  ex = group.exceptions.find { |e| e.target == target } ||
       project.new(Xcodeproj::Project::Object::PBXFileSystemSynchronizedBuildFileExceptionSet).tap { |e|
         e.target = target
         group.exceptions << e
       }
  ex.membership_exceptions ||= []
  ex.membership_exceptions << 'Info.plist' unless ex.membership_exceptions.include?('Info.plist')

  puts "✅ #{group_path}: Info.plist excluded from #{target_name} resources"
end

project.save
puts "done"
