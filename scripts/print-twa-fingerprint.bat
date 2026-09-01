@echo off
setlocal
cd /d "%~dp0.."

set "KEYSTORE=%USERPROFILE%\.android\debug.keystore"
set "ALIAS=androiddebugkey"
set "STOREPASS=android"
set "KEYPASS=android"

if not "%~1"=="" set "KEYSTORE=%~1"
if not "%~2"=="" set "ALIAS=%~2"
if not "%~3"=="" set "STOREPASS=%~3"
if not "%~4"=="" set "KEYPASS=%~4"

where keytool >nul 2>&1
if errorlevel 1 (
  echo keytool not found. Add a JDK bin directory to PATH.
  exit /b 1
)

if not exist "%KEYSTORE%" (
  echo Keystore not found: %KEYSTORE%
  echo Pass a release keystore path as the first argument.
  exit /b 1
)

echo Keystore: %KEYSTORE%
echo Alias:    %ALIAS%
echo.
echo SHA-256 fingerprint for web/public/.well-known/assetlinks.json:
echo.

for /f "tokens=1* delims=:" %%A in ('keytool -list -v -keystore "%KEYSTORE%" -alias "%ALIAS%" -storepass "%STOREPASS%" -keypass "%KEYPASS%" 2^>nul ^| findstr /c:"SHA256:"') do (
  set "FP=%%B"
  goto :print
)

echo Could not read SHA-256 from keystore.
exit /b 1

:print
rem Trim leading space after "SHA256:" and drop spaces between hex octets.
set "FP=%FP:~1%"
set "FP=%FP: =%"
echo %FP%
echo.
echo Paste that value into sha256_cert_fingerprints, deploy web/dist, then rebuild the APK with:
echo   gradlew.bat assembleRelease -PTWA_URL=https://ar.worldbuild.io
exit /b 0
