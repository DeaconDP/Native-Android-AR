require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'NativeAr'
  s.version = package['version']
  s.summary = package['description']
  s.license = 'UNLICENSED'
  s.homepage = 'https://worldbuild.io'
  s.author = 'worldbuild'
  s.source = { :git => 'https://worldbuild.io', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.resources = ['ios/Sources/NativeArPlugin/Resources/**/*']
  s.ios.deployment_target = '15.0'
  s.ios.frameworks = 'ARKit', 'SceneKit', 'AVFoundation'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
