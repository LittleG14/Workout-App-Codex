Pod::Spec.new do |s|
  s.name = 'SwoleRunAudio'
  s.version = '1.0.0'
  s.summary = 'Bounded iOS workout milestone playback and speech with temporary audio ducking.'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'Swole House'
  s.homepage = 'https://github.com/LittleG14/Workout-App-Codex'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/LittleG14/Workout-App-Codex.git' }
  s.static_framework = true
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'SwoleRunAudio' => ['Resources/*.wav'] }
end
