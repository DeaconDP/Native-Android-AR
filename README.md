# Native Android AR (WebXR)

WebXR tap-to-place AR delivered as a PWA, with an Android Trusted Web Activity (TWA) shell.

## Requirements

- Node.js 20+ (for the `web/` PWA)
- Android Studio or Android SDK + JDK 17 (for the TWA APK)
- Physical ARCore-capable Android device
- [Chrome for Android](https://play.google.com/store/apps/details?id=com.android.chrome) (WebXR `immersive-ar` runs in Chrome, not WebView)
- [Google Play Services for AR](https://play.google.com/store/apps/details?id=com.google.ar.core) on the device

## Architecture

| Layer | Stack |
|-------|-------|
| AR | WebXR `immersive-ar` (hit-test, anchors, dom-overlay) |
| 3D | Three.js + GLTFLoader |
| UI | HTML/CSS dom-overlay |
| PWA | Vite + service worker (app shell + GLB precache) |
| Android | TWA launcher (`androidx.browser`) → Chrome |

Dev server: **https://localhost:5187** (Vite, `strictPort`)

Default production origin: **https://ar.worldbuild.io**

## Features

- Tap to place on floor or wall
- Helmet GLB + cube, sphere, cylinder primitives
- Drag / twist / pinch transforms on placed objects
- Debug HUD (cog toggle): FPS, anchors, pose, depth/light flags
- Model choice persisted in `localStorage`
- Capability gate: HTTPS / WebXR / immersive-ar reasons before Start AR

### Known gaps vs native ARCore build

| Feature | Status |
|---------|--------|
| Point cloud overlay | Not available in WebXR v1 (shown as N/A in HUD) |
| Depth mesh overlay | Partial — depth-sensing requested when supported |
| SceneView coaching UI | Replaced with in-app scan banner |

## Quick start (web in Chrome)

```bat
cd web
npm install
npm run dev
```

On your phone (same Wi‑Fi), open Chrome to:

`https://<your-pc-lan-ip>:5187`

Accept the self-signed cert warning (dev only), then tap **Start AR**.

## Quick start (TWA APK)

1. Set your PC LAN IP in [`gradle.properties`](gradle.properties) (optional — `run.bat` / `run.command` pass `-PTWA_URL` automatically):

   ```properties
   TWA_URL=https://192.168.x.x:5187
   ```

2. Double-click [`run.bat`](run.bat) (Windows) or [`run.command`](run.command) (macOS).

   This starts the Vite dev server, builds/installs the debug APK, and launches it.

3. If TWA verification fails (expected in dev without Digital Asset Links), the app falls back to a Chrome Custom Tab with a toast.

`TWA_URL` drives `BuildConfig.TWA_URL`, `twa_url`, and `asset_statements` in one Gradle property — no separate string edits.

## Wireless debugging (Cursor)

Phone and PC on the same Wi‑Fi. Android 11+ **Wireless debugging** required (no USB after the first pair).

### One-time pair

1. Phone: **Settings → Developer options → Wireless debugging** ON → **Pair device with pairing code**.
2. In Cursor: **Terminal → Run Task… → Android: Wireless Pair + Connect**, and enter the pairing `IP:port`, 6-digit code, then the connect `IP:port` from the main Wireless debugging screen.

Or from a shell:

```powershell
powershell -NoProfile -File scripts\android-wireless.ps1 `
  -PairAddress "192.168.0.213:PAIR_PORT" -PairCode "XXXXXX" `
  -ConnectAddress "192.168.0.213:CONNECT_PORT"
```

### Day-to-day

| Cursor task | What it does |
|-------------|--------------|
| **Android: Wireless Discover + Install** | mDNS find phone → start Vite on `:5187` if needed → `installDebug` with LAN `TWA_URL` → launch app |
| **Android: Wireless Connect + Install** | Connect to a known `IP:port`, then same install/launch |
| **Android: Wireless Install only** | Discover + install; reuse already-running Vite (`-SkipVite`) |
| **Android: Wireless Logcat** | Filtered logcat (`nativear` / chromium / WebXR / …) |

Equivalent shell: `powershell -NoProfile -File scripts\android-wireless.ps1 -Discover`

Accept the self-signed cert warning on the phone if Chrome prompts, then **Start AR**.

### WebXR / JS inspect

AR runs in **Chrome** (TWA / Custom Tab), not a WebView. With wireless ADB connected, open Chrome on the PC → [`chrome://inspect`](chrome://inspect) → inspect the device page for breakpoints and console.

## Release TWA

1. Build and deploy the web app:

   ```bat
   cd web
   npm run build
   ```

   Host `web/dist` on HTTPS at your origin (e.g. `https://ar.worldbuild.io`).

2. Print the signing cert fingerprint and paste it into [`web/public/.well-known/assetlinks.json`](web/public/.well-known/assetlinks.json):

   ```bat
   scripts\print-twa-fingerprint.bat
   ```

   ```bash
   ./scripts/print-twa-fingerprint
   ```

   For a release keystore: `scripts\print-twa-fingerprint.bat path\to\release.keystore yourAlias storePass keyPass`

   Rebuild `web/dist` after updating the fingerprint so `/.well-known/assetlinks.json` is deployed.

3. Host [Digital Asset Links](https://developer.android.com/training/app-links/verify-android-apks) at `https://<origin>/.well-known/assetlinks.json`.

4. Build the release APK/AAB with the same origin:

   ```bat
   gradlew.bat assembleRelease -PTWA_URL=https://ar.worldbuild.io
   ```

Verified TWA requires matching package name (`io.worldbuild.nativear`), fingerprint, and HTTPS origin. Until DAL verifies, the shell opens a Custom Tab (AR still works in Chrome).

## Controls

| Control | Action |
|---------|--------|
| Start AR | Begin WebXR session |
| Tap screen | Place selected object at reticle |
| Floor / Wall | Prefer floors or walls (falls back to any surface) |
| Model | Pick helmet GLB or primitive |
| Clear all | Remove all placed objects |
| Exit AR | End the WebXR session |
| Cog | Toggle debug HUD |

## Project structure

```
web/                  # WebXR PWA (Vite + Three.js)
app/                  # Android TWA shell
scripts/              # Wireless ADB helper + TWA fingerprint
.vscode/tasks.json    # Cursor Run Task wrappers for wireless debug
gradle.properties     # Default TWA_URL for local builds
```

## Stack

- Vite 6 + TypeScript + Three.js + vite-plugin-pwa
- WebXR Device API (`immersive-ar`, hit-test, anchors, dom-overlay)
- Android TWA (`androidx.browser`)

## License

Sample helmet model: [Khronos Damaged Helmet](https://github.com/KhronosGroup/glTF-Sample-Assets) (CC BY 4.0).
