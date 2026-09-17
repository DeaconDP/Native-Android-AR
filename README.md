# Deez-Native AR (Capacitor)

Capacitor 8 phone AR with Cradle-style mode ladder: **native SceneView/ARCore (and ARKit)** → **WebXR** → **Quick Look** → **Chrome handoff** → **orbit**.

## Requirements

- Node.js 20+
- Android Studio / SDK + JDK 17 (Cap Android)
- Physical ARCore-capable Android device (native path)
- [Google Play Services for AR](https://play.google.com/store/apps/details?id=com.google.ar.core)
- Optional: macOS + Xcode for iOS Cap / ARKit (Apple team **d@worldbuild.io**)

## Architecture

| Layer | Stack |
|-------|-------|
| Shell | Capacitor 8 (`android/`, `ios/`) |
| Native AR plugin | `plugins/native-ar` — SceneView 2.3 / ARCore + ARKit/GLTFKit2 |
| Web UI | Vite + TypeScript DOM overlay |
| Browser AR | WebXR `immersive-ar` + Three.js (Chrome only; never Cap WebView) |
| Fallbacks | iOS Quick Look · Cap Android Chrome Custom Tabs · orbit viewer |

Dev / preview port: **https://localhost:5187** (`strictPort`)

Optional Chrome handoff: set `VITE_AR_ORIGIN` in `web/.env` (see `web/.env.example`).

## Mode ladder

1. **native** — Cap + ARCore/ARKit under transparent WebView  
2. **webxr** — Chrome / PWA immersive-ar  
3. **quicklook** — iOS Safari `<a rel="ar">`  
4. **chrome** — Cap Android opens Custom Tabs when `VITE_AR_ORIGIN` is set  
5. **orbit** — desktop / unsupported

## Features

- Instant Placement + plane hit cascade (native)
- Tap to place, drag rotate, pinch scale, two-finger move, emerge motion
- Reposition / Recentre / Exit
- Model picker: CC0 Kenney furniture/nature + Khronos Duck + teaching cube (native `models/ar/*.glb`)
- Debug HUD (cog) + native **Debug place** when debug is on

## Quick start (Cap APK)

```bat
run.bat
```

Or:

```bat
npm install
npm run cap:sync
cd android
gradlew.bat installDebug
adb shell am start -n io.worldbuild.nativear/.MainActivity
```

## Quick start (Chrome WebXR)

```bat
cd web
npm install
npm run dev
```

Open `https://<lan-ip>:5187` in Chrome on an ARCore phone (accept the self-signed cert).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite HTTPS on 5187 |
| `npm run cap:sync` | Build plugin + web + `cap sync` |
| `npm run normalize:models` | Build cube + Filament-friendly `models/ar/*.glb` |
| `run.bat` / `run.command` | Sync, installDebug, launch |

## Wireless debugging

Keep using [`scripts/android-wireless.ps1`](scripts/android-wireless.ps1) and `.vscode/tasks.json` as before.

## iOS

On a Mac: `npm run cap:sync` → `npx cap open ios` → sign with team **d@worldbuild.io**.
