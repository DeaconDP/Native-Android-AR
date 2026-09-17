@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing root dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist "web\node_modules" (
  echo Installing web dependencies...
  pushd web
  call npm install
  if errorlevel 1 goto :fail
  popd
)

if not exist "plugins\native-ar\node_modules" (
  echo Installing native-ar plugin dependencies...
  pushd plugins\native-ar
  call npm install
  if errorlevel 1 goto :fail
  popd
)

echo Building web + Cap sync...
call npm run cap:sync
if errorlevel 1 goto :fail

if not exist "android\local.properties" (
  if defined ANDROID_HOME (
    echo sdk.dir=%ANDROID_HOME:\=\\%> android\local.properties
  ) else if exist "%LOCALAPPDATA%\Android\Sdk" (
    echo sdk.dir=%LOCALAPPDATA:\=\\%\Android\Sdk> android\local.properties
  )
)

echo Installing debug APK...
pushd android
call gradlew.bat installDebug
if errorlevel 1 (
  popd
  goto :fail
)
popd

echo Launching on device...
adb shell am start -n io.worldbuild.nativear/.MainActivity
if errorlevel 1 (
  echo Install succeeded but launch failed. Is adb connected?
  goto :fail
)

echo.
echo Done. For Chrome WebXR on LAN: cd web ^&^& npm run dev → https://^<lan-ip^>:5187
pause
exit /b 0

:fail
echo.
echo Run failed. See messages above.
pause
exit /b 1
