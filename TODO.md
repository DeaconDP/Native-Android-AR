# TODO

## Active — Capacitor native AR

- [x] Capacitor 8 shell (`android/` + `ios/`) replacing TWA
- [x] Vendor `plugins/native-ar` from Cradle `coh-ar` (SceneView Instant Placement + ARKit)
- [x] Mode ladder: native → WebXR → Quick Look → Chrome handoff → orbit
- [x] Vanilla session gestures (rotate / pinch / move) + emerge motion
- [x] WebXR screen-space `offsetRay` place/move
- [x] Normalize helmet GLB for native Filament path
- [x] Keep helmet textures/PBR (stop Cradle bone-matte override on textured GLBs)
- [x] CC0 model kit + picker (Kenney + Duck + cube) wired through native / WebXR / orbit

## Education Phase 1 — Deepen live (done)

- [x] Sectioned Learn hub: This app · How placement works · Platform paths
- [x] Deepen live topics (WebView chrome, Instant Placement vs planes, soft→strict raycast, WebXR offsetRay, gestures, orbit)
- [x] Milestone coach captions tied to Learn topic IDs (scan → ready → placed → gesture → learn nudge)
- [x] Strip leftover agent-log debug instrumentation in session files

## Education Phase 2 — Taxonomy (done)

- [x] Kinds-of-AR curriculum chapters with `live` | `explained` | `roadmap` chips
- [x] Software stacks / techniques curriculum chapters (same chip model)
- [x] “Try in AR” only for `live` topics

## Education Phase 3 — Technique demos (Android done)

- [x] Feature-point / tracking HUD (Android native; iOS overlay follow-up)
- [x] Depth / occlusion peek (Android native; iOS overlay follow-up)
- [x] Image / marker target place (Android native; iOS image anchors follow-up)
- [x] Light-estimate viz (Android native; iOS light estimate follow-up)
- [x] Face mesh peek (Android native; iOS face anchors follow-up)
- [ ] Geo AR sketch (hard defer — see ROADMAP)

## Also next

- [x] Rebrand to Deez-Native AR + hermetic seal on home gate

- [ ] Device QA on ARCore phone: Instant Placement place → rotate/pinch → reposition/exit; also Learn Try paths for marker / light / face / depth / feature-point overlays (confirm selected model)
- [ ] Optional: set `VITE_AR_ORIGIN` and verify Cap Android Chrome handoff
- [ ] iOS Cap + ARKit / Quick Look on Mac (team d@worldbuild.io)
