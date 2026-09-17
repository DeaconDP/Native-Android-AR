# ROADMAP

## Epics

### Education Phase 1 — Deepen live curriculum ✅
Sectioned Learn hub + milestone coach captions mapped 1:1 to techniques this app already runs (mode ladder, Instant Placement / hit cascade, gestures, Cap transparent WebView, WebXR `offsetRay`, orbit control). Shipped 2026-09-17.

### Education Phase 2 — AR taxonomy Learn hub ✅
Kinds of AR + software stacks/techniques with `live` | `explained` | `roadmap` chips; “Try in AR” only for live topics. Shipped 2026-09-17.

### Education Phase 3 — Technique demos
Interactive showcases beyond the current place-on-plane lab. Each demo is its own sub-epic when started; do not parallelize. Taxonomy labels exist — demos remain Deferred until picked up one at a time.

Demo backlog:

| Demo | Surface | Status |
|------|---------|--------|
| Feature-point / tracking HUD | Native debug overlay | Deferred |
| Depth / occlusion peek | Native where supported | Deferred |
| Image / marker target place | Native ARCore/ARKit image anchors | Deferred |
| Light-estimate viz | Native light probe readout | Deferred |
| Face mesh peek | iOS ARKit face (optional Android) | Deferred |
| Geo AR sketch | Location + outdoor QA | Deferred hard |

### Capacitor native AR (Cradle techniques)
Cap 8 shell with `native-ar` plugin (SceneView/ARCore + ARKit), WebXR/Quick Look/Chrome/orbit fallbacks, shared gesture surface. Web + Android `assembleDebug` verified; physical device QA remains.

## Deferred

- 2026-09-17: Education Phase 3 — feature-point / tracking HUD. Revisit as teaching viz after taxonomy. Was deferred 2026-08-28 (SceneView visitor HUD). `plugins/native-ar` · `web/src/learn/curriculum.ts` (kind-slam / explained tracking)
- 2026-09-17: Education Phase 3 — depth / occlusion peek beyond SceneView automatic depth. Phone-scope only. `plugins/native-ar` · `web/src/learn/curriculum.ts` (kind-occlusion)
- 2026-09-17: Education Phase 3 — image / marker target placement (ARCore/ARKit image anchors + target assets). `plugins/native-ar` · `web/src/learn/curriculum.ts` (kind-marker)
- 2026-09-17: Education Phase 3 — light-estimate viz vs fixed Filament directional light. `plugins/native-ar` · `web/src/learn/curriculum.ts` (kind-light)
- 2026-09-17: Education Phase 3 — face mesh peek (separate mode, not default floor place). `plugins/native-ar` · `web/src/learn/curriculum.ts` (kind-face)
- 2026-09-17: Education Phase 3 — geo / location AR sketch. Needs location permissions + outdoor QA. `web/src/learn/curriculum.ts` (kind-geo)
- 2026-09-16: Production TWA / Digital Asset Links ship checklist superseded by Capacitor shell. Was `web/public/.well-known/assetlinks.json`.
- 2026-08-28: Point cloud overlay unavailable in WebXR v1. Native SceneView does not expose a visitor HUD for feature points in this pass.
- 2026-08-28: Headset / `immersive-vr` out of scope for phone AR.
- 2026-08-28: Depth mesh visualization beyond SceneView automatic depth — deferred.
