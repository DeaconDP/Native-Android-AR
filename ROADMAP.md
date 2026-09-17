# ROADMAP

## Epics

### Education Phase 1 — Deepen live curriculum ✅
Sectioned Learn hub + milestone coach captions mapped 1:1 to techniques this app already runs (mode ladder, Instant Placement / hit cascade, gestures, Cap transparent WebView, WebXR `offsetRay`, orbit control). Shipped 2026-09-17.

### Education Phase 2 — AR taxonomy Learn hub ✅
Kinds of AR + software stacks/techniques with `live` | `explained` | `roadmap` chips; “Try in AR” only for live topics. Shipped 2026-09-17.

### Education Phase 3 — Technique demos
Interactive showcases beyond the current place-on-plane lab. Each demo is its own sub-epic when started; do not parallelize. Taxonomy labels exist — remaining demos stay Deferred until picked up one at a time.

Demo backlog:

| Demo | Surface | Status |
|------|---------|--------|
| Feature-point / tracking HUD | Native debug overlay | Done (Android 2026-09-17; iOS follow-up) |
| Depth / occlusion peek | Native where supported | Done (Android 2026-09-17; iOS skipped) |
| Image / marker target place | Native ARCore image anchors | Done (Android 2026-09-17; iOS skipped) |
| Light-estimate viz | Native light probe readout | Done (Android 2026-09-17; iOS skipped) |
| Face mesh peek | Native ARCore Augmented Faces | Done (Android 2026-09-17; iOS skipped) |
| Geo AR sketch | Location + outdoor QA | Deferred hard |

### Capacitor native AR (Cradle techniques)
Cap 8 shell with `native-ar` plugin (SceneView/ARCore + ARKit), WebXR/Quick Look/Chrome/orbit fallbacks, shared gesture surface. Web + Android `assembleDebug` verified; physical device QA remains.

## Deferred

- 2026-09-17: Feature-point HUD iOS overlay (`ARFrame.rawFeaturePoints`) — Android ARCore HUD shipped; iOS skipped as non-trivial in this pass. `plugins/native-ar/ios/Sources/NativeArPlugin/NativeArPlugin.swift`
- 2026-09-17: Depth heatmap peek iOS (`ARFrame.sceneDepth`) — Android ARCore CPU depth image shipped; iOS skipped as non-trivial in this pass. `plugins/native-ar/ios/Sources/NativeArPlugin/NativeArPlugin.swift`
- 2026-09-17: Education Phase 3 — image / marker target placement iOS ARKit image anchors skipped as non-trivial in this pass. Android ARCore Augmented Images shipped. `plugins/native-ar/ios/Sources/NativeArPlugin/NativeArPlugin.swift` · `web/src/learn/curriculum.ts` (kind-marker)
- 2026-09-17: Education Phase 3 — light-estimate viz iOS ARKit light estimate skipped as non-trivial in this pass. Android ARCore `AMBIENT_INTENSITY` + Filament main-light drive + HUD shipped. `plugins/native-ar/ios/Sources/NativeArPlugin/NativeArPlugin.swift` · `web/src/learn/curriculum.ts` (kind-light)
- 2026-09-17: Education Phase 3 — face mesh peek iOS ARKit face anchors skipped as non-trivial in this pass. Android ARCore Augmented Faces (front camera, mesh wireframe + nose marker) shipped. `plugins/native-ar/ios/Sources/NativeArPlugin/NativeArPlugin.swift` · `web/src/learn/curriculum.ts` (kind-face)
- 2026-09-17: Education Phase 3 — geo / location AR sketch. Needs location permissions + outdoor QA. `web/src/learn/curriculum.ts` (kind-geo)
- 2026-09-16: Production TWA / Digital Asset Links ship checklist superseded by Capacitor shell. Was `web/public/.well-known/assetlinks.json`.
- 2026-08-28: Point cloud overlay unavailable in WebXR v1. Native Android feature-point HUD shipped 2026-09-17; WebXR still has no visitor point cloud.
- 2026-08-28: Headset / `immersive-vr` out of scope for phone AR.
- 2026-08-28: People-occlusion / depth-mesh visualization beyond SceneView automatic depth — still deferred (CPU depth heatmap peek shipped Android 2026-09-17).
