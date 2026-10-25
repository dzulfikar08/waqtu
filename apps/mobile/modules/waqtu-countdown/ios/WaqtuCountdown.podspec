Pod::Spec.new do |s|
  s.name           = 'WaqtuCountdown'
  s.version        = '1.0.0'
  s.summary        = 'Hands the sahur/iftar countdown widget its schedule.'
  s.description    = 'Local Expo module: writes the schedule to the App Group shared with the countdown widget extension and reloads its timeline.'
  s.license        = { :type => 'MPL-2.0' }
  s.author         = 'Waqtu'
  s.homepage       = 'https://github.com/dzulfikar08/waqtu'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/dzulfikar08/waqtu.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
