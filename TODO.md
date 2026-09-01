# TODO

## Active — WebXR + mobile TWA

- [x] Harden WebXR gate (secure context + capability reasons + start failures)
- [x] Add PWA service worker (vite-plugin-pwa; precache shell + helmet GLB)
- [x] Drive `twa_url` + `asset_statements` from Gradle `TWA_URL`
- [x] Add `assetlinks.json` template + fingerprint helper + README release steps
- [x] Wireless ADB Cursor pipeline (`scripts/android-wireless.ps1` + `.vscode/tasks.json`)
- [x] Align WebXR session with Cross-Platform-AR (`local` ref space, visible canvas, optional overlay, hit fallback, Exit)

## Next

- [ ] Fill real SHA-256 into `web/public/.well-known/assetlinks.json` and deploy `web/dist` to `https://ar.worldbuild.io`
- [ ] Build release APK with `-PTWA_URL=https://ar.worldbuild.io` and confirm verified TWA (not Custom Tab fallback)
