# ROADMAP

## Epics

### WebXR phone AR + Android TWA
PWA immersive-ar placement app with a thin Chrome TWA shell. Gate hardening, service worker, and Gradle-synced Digital Asset Links wiring are in place; production DAL verify is the remaining ship step.

## Deferred

- 2026-08-28: Point cloud overlay unavailable in WebXR v1 — HUD shows N/A. `web/src/ui/render.ts:84`
- 2026-08-28: Depth mesh / light estimation requested but not visualized (HUD flags only). `web/src/ar/session.ts:40`
- 2026-08-28: Headset / `immersive-vr` out of scope for phone AR + TWA pass. `web/src/ar/session.ts:40`
- 2026-08-28: iOS Safari immersive AR not available the same way as Chrome/ARCore. `README.md`
