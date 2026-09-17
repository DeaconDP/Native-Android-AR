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

## Next

- [x] In-app AR education: Learn hub + stage coach captions
- [x] Rebrand to Deez-Native AR + hermetic seal on home gate

- [ ] Device QA on ARCore phone: Instant Placement place → rotate/pinch → reposition/exit (confirm selected model)
- [ ] Optional: set `VITE_AR_ORIGIN` and verify Cap Android Chrome handoff
- [ ] iOS Cap + ARKit / Quick Look on Mac (team d@worldbuild.io)
