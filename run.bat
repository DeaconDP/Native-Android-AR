@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "LAN_IP=%%a"
  set "LAN_IP=!LAN_IP: =!"
  goto :found_ip
)
:found_ip

if not defined LAN_IP (
  echo Could not detect LAN IP. Set TWA_URL manually in gradle.properties.
  set "LAN_IP=localhost"
)

set "DEV_URL=https://%LAN_IP%:5187"
echo Dev URL: %DEV_URL%

if not exist "web\node_modules" (
  echo Installing web dependencies...
  pushd web
  call npm install
  if errorlevel 1 goto :fail
  popd
)

echo Starting WebXR dev server on port 5187...
start "Native AR Web" cmd /c "cd /d "%~dp0web" && npm run dev"

echo Waiting for dev server...
timeout /t 4 /nobreak >nul

if not exist "local.properties" (
  if defined ANDROID_HOME (
    echo sdk.dir=%ANDROID_HOME:\=\\%> local.properties
  ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
    echo sdk.dir=%LOCALAPPDATA:\=\\%\Android\Sdk> local.properties
  )
)

echo Building TWA APK with TWA_URL=%DEV_URL% ...
call gradlew.bat installDebug -PTWA_URL=%DEV_URL%
if errorlevel 1 goto :fail

echo Launching on device...
adb shell am start -n io.worldbuild.nativear/.MainActivity
if errorlevel 1 (
  echo Install succeeded but launch failed. Is adb connected?
  goto :fail
)

echo.
echo Done. Also test in Chrome: %DEV_URL%
pause
exit /b 0

:fail
echo.
echo Run failed. See messages above.
pause
exit /b 1
