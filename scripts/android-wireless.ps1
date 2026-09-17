# Build Capacitor Native AR and install over wireless ADB (Android 11+).
# Usage (first pair on this PC):
#   powershell -NoProfile -File scripts\android-wireless.ps1 `
#     -PairAddress "192.168.1.42:37123" -PairCode "123456" `
#     -ConnectAddress "192.168.1.42:5555"
# Later sessions (already paired):
#   powershell -NoProfile -File scripts\android-wireless.ps1 -ConnectAddress "192.168.1.42:5555"
# Or rely on mDNS after wireless debugging is on:
#   powershell -NoProfile -File scripts\android-wireless.ps1 -Discover
# Logcat only (no install):
#   powershell -NoProfile -File scripts\android-wireless.ps1 -Discover -LogcatOnly
# Reuse running Vite (optional; Cap ships bundled assets by default):
#   powershell -NoProfile -File scripts\android-wireless.ps1 -Discover -SkipVite

[CmdletBinding()]
param(
  [string]$PairAddress = "",
  [string]$PairCode = "",
  [string]$ConnectAddress = "",
  [switch]$Discover,
  [switch]$SkipBuild,
  [switch]$SkipVite,
  [switch]$LogcatOnly
)

$ErrorActionPreference = "Stop"

$root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
$root = (Resolve-Path -LiteralPath $root).Path
$androidDir = Join-Path $root "android"
$vitePort = 5187
$package = "io.worldbuild.nativear"
$activity = "$package/.MainActivity"

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }

$adb = Join-Path $sdk "platform-tools\adb.exe"
if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb. Install Android SDK platform-tools."
}

function Get-LanIp {
  $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.PrefixOrigin -ne "WellKnown" -and
      $_.AddressState -eq "Preferred"
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -ExpandProperty IPAddress
  if ($addrs -and $addrs.Count -gt 0) { return $addrs[0] }

  $ipconfig = ipconfig 2>$null | Select-String -Pattern "IPv4"
  foreach ($line in $ipconfig) {
    if ($line -match ":\s*(\d+\.\d+\.\d+\.\d+)") {
      $ip = $Matches[1]
      if ($ip -notlike "127.*") { return $ip }
    }
  }
  return "localhost"
}

function Test-PortListening([int]$Port) {
  $listening = netstat -ano 2>$null | Select-String -Pattern ":$Port\s+.*LISTENING"
  return [bool]$listening
}

function Get-WirelessDevice {
  $lines = & $adb devices -l 2>&1 | Where-Object { $_ -match "\S+\s+device" -and $_ -notmatch "List of devices" }
  return @($lines)
}

function Get-DeviceSerial([string[]]$deviceLines) {
  foreach ($line in $deviceLines) {
    if ($line -match "^(\d+\.\d+\.\d+\.\d+:\d+)\s+device") { return $Matches[1] }
  }
  if ($deviceLines.Count -gt 0 -and $deviceLines[0] -match "^(\S+)\s+device") {
    return $Matches[1]
  }
  return $null
}

function Ensure-LocalProperties {
  $localProps = Join-Path $androidDir "local.properties"
  if (Test-Path -LiteralPath $localProps) { return }
  $sdkEscaped = $sdk -replace "\\", "\\"
  Set-Content -LiteralPath $localProps -Value "sdk.dir=$sdkEscaped" -Encoding ASCII
  Write-Host "Wrote android/local.properties (sdk.dir=$sdk)"
}

function Ensure-Vite {
  if (Test-PortListening $vitePort) {
    Write-Host "Vite already listening on :$vitePort"
    return
  }

  $webDir = Join-Path $root "web"
  $nodeModules = Join-Path $webDir "node_modules"
  if (-not (Test-Path -LiteralPath $nodeModules)) {
    Write-Host "Installing web dependencies..."
    Push-Location $webDir
    try {
      npm install
      if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)." }
    } finally {
      Pop-Location
    }
  }

  Write-Host "Starting Vite on port $vitePort (Chrome WebXR / live QA)..."
  $cmd = "cd /d `"$webDir`" && npm run dev"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WindowStyle Minimized

  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-PortListening $vitePort) {
      $ok = $true
      Write-Host "Vite is up on :$vitePort"
      break
    }
  }
  if (-not $ok) {
    throw "Vite did not bind port $vitePort in time. Start it manually: cd web && npm run dev"
  }
}

function Show-NoDeviceHelp {
  Write-Host ""
  Write-Host "No device connected."
  Write-Host "On the phone: Settings > Developer options > Wireless debugging ON"
  Write-Host "  Pair device with pairing code: note IP:port and 6-digit code"
  Write-Host "  Then note IP address and port on the main wireless debugging screen"
  Write-Host ""
  Write-Host "Example:"
  Write-Host '  powershell -NoProfile -File scripts\android-wireless.ps1 `'
  Write-Host '    -PairAddress "192.168.1.42:37123" -PairCode "123456" `'
  Write-Host '    -ConnectAddress "192.168.1.42:5555"'
}

if ($PairAddress) {
  if (-not $PairCode) { throw "PairAddress requires -PairCode (6 digits from the phone)." }
  Write-Host "Pairing with $PairAddress ..."
  & $adb pair $PairAddress $PairCode
  if ($LASTEXITCODE -ne 0) { throw "adb pair failed ($LASTEXITCODE)." }
}

if ($Discover -and -not $ConnectAddress) {
  Write-Host "Scanning mDNS for wireless debugging ..."
  $mdns = & $adb mdns services 2>&1
  $mdns | ForEach-Object { Write-Host $_ }
  $connectLine = $mdns | Where-Object { $_ -match "_adb-tls-connect\._tcp" } | Select-Object -First 1
  if ($connectLine -match "(\d+\.\d+\.\d+\.\d+):(\d+)") {
    $ConnectAddress = "$($Matches[1]):$($Matches[2])"
    Write-Host "Found connect target: $ConnectAddress"
  } else {
    Write-Host "No _adb-tls-connect._tcp service found via mDNS."
  }
}

if ($ConnectAddress) {
  Write-Host "Connecting to $ConnectAddress ..."
  & $adb connect $ConnectAddress | ForEach-Object { Write-Host $_ }
  Start-Sleep -Seconds 1
}

$devices = Get-WirelessDevice
if ($devices.Count -eq 0) {
  Show-NoDeviceHelp
  exit 1
}

Write-Host "Device(s):"
$devices | ForEach-Object { Write-Host "  $_" }

$serial = Get-DeviceSerial $devices
if (-not $serial) { throw "Could not parse a device serial from adb devices." }
Write-Host "Using serial: $serial"

if ($LogcatOnly) {
  Write-Host "Streaming filtered logcat (Ctrl+C to stop) ..."
  & $adb -s $serial logcat -v time |
    Select-String -Pattern "nativear|NativeAr|chromium|WebXR|Console|Capacitor|SSL|CERT|ERR_"
  exit 0
}

$lanIp = Get-LanIp
$devUrl = "https://${lanIp}:${vitePort}"
Write-Host "Chrome WebXR URL: $devUrl"

if (-not $SkipVite) {
  Ensure-Vite
} elseif (-not (Test-PortListening $vitePort)) {
  Write-Host "Warning: -SkipVite set but nothing is listening on :$vitePort"
}

Ensure-LocalProperties
$env:ANDROID_HOME = $sdk

if (-not $SkipBuild) {
  Write-Host "Cap sync + installDebug ..."
  Push-Location $root
  try {
    npm run cap:sync
    if ($LASTEXITCODE -ne 0) { throw "cap:sync failed ($LASTEXITCODE)." }
  } finally {
    Pop-Location
  }
  Push-Location $androidDir
  try {
    & .\gradlew.bat installDebug
    if ($LASTEXITCODE -ne 0) { throw "installDebug failed ($LASTEXITCODE)." }
  } finally {
    Pop-Location
  }
} else {
  Write-Host "SkipBuild set - launching existing install only."
}

Write-Host "Launching $activity ..."
& $adb -s $serial shell am start -n $activity
if ($LASTEXITCODE -ne 0) { throw "am start failed ($LASTEXITCODE)." }

Write-Host ""
Write-Host "Done. Cap APK launched. Also test WebXR in Chrome: $devUrl"
Write-Host 'JS inspect: chrome://inspect on this PC (same wireless ADB session).'
