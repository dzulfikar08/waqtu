Pod::Spec.new do |s|
  s.name           = 'WaqtuBackup'
  s.version        = '1.0.0'
  s.summary        = 'Excludes a file or folder from iCloud and iTunes backups.'
  s.description    = 'Local Expo module: sets NSURLIsExcludedFromBackupKey, which expo-file-system does not expose.'
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
