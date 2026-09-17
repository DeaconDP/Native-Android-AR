#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d node_modules ]]; then
  echo "Installing root dependencies..."
  npm install
fi

if [[ ! -d web/node_modules ]]; then
  echo "Installing web dependencies..."
  (cd web && npm install)
fi

if [[ ! -d plugins/native-ar/node_modules ]]; then
  echo "Installing native-ar plugin dependencies..."
  (cd plugins/native-ar && npm install)
fi

echo "Building web + Cap sync..."
npm run cap:sync

if [[ ! -f android/local.properties ]]; then
  if [[ -n "${ANDROID_HOME:-}" ]]; then
    echo "sdk.dir=$ANDROID_HOME" > android/local.properties
  elif [[ -d "$HOME/Library/Android/sdk" ]]; then
    echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
  fi
fi

echo "Installing debug APK..."
(cd android && ./gradlew installDebug)

echo "Launching on device..."
adb shell am start -n io.worldbuild.nativear/.MainActivity

echo
echo "Done. For Chrome WebXR on LAN: cd web && npm run dev → https://<lan-ip>:5187"
