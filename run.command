#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo localhost)"
DEV_URL="https://${LAN_IP}:5187"

echo "Dev URL: ${DEV_URL}"

if [ ! -d web/node_modules ]; then
  echo "Installing web dependencies..."
  (cd web && npm install)
fi

if ! lsof -nP -iTCP:5187 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting WebXR dev server on port 5187..."
  osascript -e "tell application \"Terminal\" to do script \"cd \\\"$(pwd)/web\\\" && npm run dev\""
  sleep 4
else
  echo "Port 5187 already in use — reusing existing dev server."
fi

if [ ! -f local.properties ]; then
  if [ -n "${ANDROID_HOME:-}" ]; then
    printf 'sdk.dir=%s\n' "${ANDROID_HOME//\\/\\\\}" > local.properties
  elif [ -d "$HOME/Library/Android/sdk" ]; then
    printf 'sdk.dir=%s\n' "$HOME/Library/Android/sdk" > local.properties
  fi
fi

echo "Building TWA APK with TWA_URL=${DEV_URL} ..."
./gradlew installDebug -PTWA_URL="${DEV_URL}"

echo "Launching on device..."
adb shell am start -n io.worldbuild.nativear/.MainActivity

echo ""
echo "Done. Also test in Chrome: ${DEV_URL}"
