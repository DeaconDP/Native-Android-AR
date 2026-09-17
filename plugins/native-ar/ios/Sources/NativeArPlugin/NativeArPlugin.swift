import ARKit
import AVFoundation
import Capacitor
import GLTFKit2
import ModelIO
import SceneKit
import simd
import UIKit

@objc(NativeArPlugin)
public class NativeArPlugin: CAPPlugin, CAPBridgedPlugin, ARSCNViewDelegate {
    public let identifier = "NativeArPlugin"
    public let jsName = "NativeAr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "onScreenTap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "moveScreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reposition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recenter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rotate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setScale", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "tap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "move", returnType: CAPPluginReturnPromise)
    ]

    private static let emergeRiseMs: Double = 520
    private static let emergeJiggleMs: Double = 380
    private static let emergeRingMs: Double = 620
    private static let emergeRingStaggerMs: Double = 55
    private static let emergeRingScaleFrom: Float = 0.12
    private static let emergeRingScaleTo: Float = 2.15
    private static let emergeStartY: Float = -0.04
    private static let emergeOvershoot: Float = 1.18
    private static let emergeYawRad: Float = 12 * .pi / 180
    private static let reduceMotionMs: Double = 120
    private static let planeRevealMs: Double = 800
    private static let planeBreathMs: Double = 2000
    private static let planeTargetOpacity: CGFloat = 0.55
    private static let planeBreathDelta: CGFloat = 0.06
    private static let planeRevealActionKey = "coh.plane.reveal"
    private static let planeBreathActionKey = "coh.plane.breath"

    private var arView: ARSCNView?
    private var modelTemplate: SCNNode?
    private var placedRoot: SCNNode?
    private var placedNode: SCNNode?
    private var ringNode: SCNNode?
    private var dustNode: SCNNode?
    private var planeNodes: [UUID: SCNNode] = [:]
    private var planeGridImage: UIImage?
    private var placed = false
    private var planeNotified = false
    private var scaleFactor: Float = 1
    private var displayedScale: Float = 1
    private var scaleDisplayLink: CADisplayLink?
    private var introMultiplier: Float = 1
    private var spawning = false
    private var reducedMotion = false
    private let baseScale: Float = 0.22
    private static let scaleMin: Float = 0.2
    private static let scaleMax: Float = 5
    private var originalOpaque = true
    private var lastTrackingKey: String?

    private let colorGold = UIColor(red: 0.992, green: 0.722, blue: 0.075, alpha: 1)
    private let colorOrange = UIColor(red: 0.886, green: 0.443, blue: 0.129, alpha: 1)
    private let colorCream = UIColor(red: 0.925, green: 0.910, blue: 0.765, alpha: 1)
    /// Matte bone matching Android Filament (0.85, 0.79, 0.64).
    private let colorBone = UIColor(red: 0.85, green: 0.79, blue: 0.64, alpha: 1)

    @objc func isSupported(_ call: CAPPluginCall) {
        let supported = ARWorldTrackingConfiguration.isSupported
        call.resolve(["supported": supported, "backend": supported ? "arkit" : "none"])
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": ARWorldTrackingConfiguration.isSupported])
    }

    @objc func startSession(_ call: CAPPluginCall) {
        startImpl(call)
    }

    @objc func start(_ call: CAPPluginCall) {
        startImpl(call)
    }

    private func startImpl(_ call: CAPPluginCall) {
        let modelPath = call.getString("modelPath") ?? ""
        guard !modelPath.isEmpty else {
            call.reject("modelPath is required")
            return
        }
        reducedMotion = call.getBool("reducedMotion") ?? false
        let placementMode = call.getString("placementMode") ?? "plane"
        if placementMode.lowercased() == "image" {
            call.reject("Image-target AR is Android-only in this build.")
            return
        }
        // lightEstimateViz is Android-only in this build (ROADMAP Deferred).
        let begin = { [weak self] in
            DispatchQueue.main.async {
                guard let self else { return }
                do {
                    try self.insertView()
                    self.loadModel(path: modelPath, call: call)
                } catch {
                    self.teardown()
                    call.reject("Could not start the camera on this device.")
                }
            }
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            begin()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                if granted {
                    begin()
                } else {
                    call.reject("Camera access is needed to place fossils on a table.")
                }
            }
        default:
            call.reject("Camera access is needed to place fossils on a table.")
        }
    }

    @objc func stopSession(_ call: CAPPluginCall) {
        stopImpl(call)
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopImpl(call)
    }

    private func stopImpl(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            self.notifyListeners("sessionEnded", data: [:])
            call.resolve()
        }
    }

    @objc func onScreenTap(_ call: CAPPluginCall) {
        tapImpl(call)
    }

    @objc func tap(_ call: CAPPluginCall) {
        tapImpl(call)
    }

    private func tapImpl(_ call: CAPPluginCall) {
        let x = CGFloat(call.getFloat("x") ?? 0.5)
        let y = CGFloat(call.getFloat("y") ?? 0.5)
        DispatchQueue.main.async {
            let didPlace = self.placeAt(x: x, y: y)
            call.resolve(["placed": didPlace])
            if didPlace {
                self.notifyListeners("placed", data: [:])
            }
        }
    }

    @objc func moveScreen(_ call: CAPPluginCall) {
        moveImpl(call)
    }

    @objc func move(_ call: CAPPluginCall) {
        moveImpl(call)
    }

    private func moveImpl(_ call: CAPPluginCall) {
        let x = CGFloat(call.getFloat("x") ?? 0.5)
        let y = CGFloat(call.getFloat("y") ?? 0.5)
        DispatchQueue.main.async {
            call.resolve(["moved": self.moveAt(x: x, y: y)])
        }
    }

    @objc func reposition(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.clearPlaced()
            self.setPlanesHidden(false)
            self.replayPlaneReveals()
            call.resolve()
        }
    }

    @objc func recenter(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.faceCamera(alignViewpoint: true)
            call.resolve()
        }
    }

    @objc func rotate(_ call: CAPPluginCall) {
        let dx = call.getFloat("dx") ?? 0
        let dy = call.getFloat("dy") ?? 0
        DispatchQueue.main.async {
            guard let node = self.placedNode, !self.spawning else {
                call.resolve()
                return
            }
            let yawRad = dx * (.pi / 180) * 0.45
            let pitchRad = dy * (.pi / 180) * 0.45
            var worldQ = node.simdWorldOrientation
            let cam = self.arView?.pointOfView
            let camUp = cam.map { simd_normalize($0.simdWorldUp) } ?? SIMD3<Float>(0, 1, 0)
            let camRight = cam.map { simd_normalize($0.simdWorldRight) } ?? SIMD3<Float>(1, 0, 0)
            if yawRad != 0 {
                worldQ = simd_mul(simd_quatf(angle: yawRad, axis: camUp), worldQ)
            }
            if pitchRad != 0 {
                worldQ = simd_mul(simd_quatf(angle: pitchRad, axis: camRight), worldQ)
            }
            node.simdWorldOrientation = worldQ
            call.resolve()
        }
    }

    @objc func setScale(_ call: CAPPluginCall) {
        let factor = call.getFloat("factor") ?? 1
        DispatchQueue.main.async {
            self.scaleFactor = max(Self.scaleMin, min(Self.scaleMax, factor))
            self.cancelScaleSmoothing()
            self.displayedScale = self.scaleFactor
            if !self.spawning {
                self.applyScale()
            }
            call.resolve()
        }
    }

    private func insertView() throws {
        teardown()
        guard let webView = bridge?.webView, let parent = webView.superview else {
            throw NSError(domain: "NativeAr", code: 1)
        }
        originalOpaque = webView.isOpaque
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        parent.backgroundColor = .clear
        bridge?.viewController?.view.backgroundColor = .clear

        let view = ARSCNView(frame: parent.bounds)
        view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.delegate = self
        view.automaticallyUpdatesLighting = true
        parent.insertSubview(view, belowSubview: webView)
        arView = view

        guard ARWorldTrackingConfiguration.isSupported else {
            throw NSError(domain: "NativeAr", code: 2)
        }
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = .horizontal
        view.session.run(config, options: [.resetTracking, .removeExistingAnchors])
        placed = false
        planeNotified = false
        scaleFactor = 1
        displayedScale = 1
        introMultiplier = 1
        spawning = false
        cancelScaleSmoothing()
        lastTrackingKey = nil
        notifyTracking("initializing", message: "Starting ARKit session")
    }

    private func loadModel(path: String, call: CAPPluginCall) {
        guard let url = bundledModelURL(path) else {
            teardown()
            call.reject("This fossil isn’t ready in AR yet.")
            return
        }
        GLTFAsset.load(with: url, options: [:]) { [weak self] _, status, asset, error, _ in
            guard let self else { return }
            if error != nil || (status == .complete && asset == nil) {
                DispatchQueue.main.async {
                    self.teardown()
                    call.reject("Could not load this fossil.")
                }
                return
            }
            guard status == .complete, let asset else { return }
            DispatchQueue.main.async {
                guard self.modelTemplate == nil else { return }
                let source = GLTFSCNSceneSource(asset: asset)
                guard let root = source.defaultScene?.rootNode.clone() else {
                    self.teardown()
                    call.reject("Could not load this fossil.")
                    return
                }
                // Keep each GLB's own materials (Kenney baseColorFactors, duck maps).
                // Soften metal/roughness on untextured meshes for ARKit lighting — never
                // replace diffuse colors with a shared bone tint.
                self.softenUntexturedMaterials(in: root)
                self.modelTemplate = root
                call.resolve()
            }
        }
    }

    /// GLTFKit2 binds maps as UIImage / CGImage / MDLTexture; solid factors are UIColor / NSNumber.
    private static func isTextureContents(_ contents: Any?) -> Bool {
        switch contents {
        case is UIImage, is CGImage, is MDLTexture:
            return true
        case let name as String:
            return !name.isEmpty
        default:
            return false
        }
    }

    private func softenUntexturedMaterials(in root: SCNNode) {
        let soften: (SCNNode) -> Void = { node in
            guard let geometry = node.geometry else { return }
            if geometry.materials.isEmpty {
                let mat = SCNMaterial()
                mat.diffuse.contents = colorBone
                mat.lightingModel = .physicallyBased
                mat.metalness.contents = 0
                mat.roughness.contents = 0.82
                geometry.materials = [mat]
                return
            }
            for mat in geometry.materials where !Self.isTextureContents(mat.diffuse.contents) {
                mat.metalness.contents = 0
                mat.roughness.contents = 0.82
                mat.lightingModel = .physicallyBased
            }
        }
        soften(root)
        root.enumerateChildNodes { node, _ in soften(node) }
    }

    private func bundledModelURL(_ relative: String) -> URL? {
        let trimmed = relative.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let full = Bundle.main.bundleURL
            .appendingPathComponent("public")
            .appendingPathComponent(trimmed)
        return FileManager.default.fileExists(atPath: full.path) ? full : nil
    }

    private func hitHorizontal(x: CGFloat, y: CGFloat) -> ARRaycastResult? {
        guard let arView else { return nil }
        let point: CGPoint
        if x <= 1.5 && y <= 1.5 {
            point = CGPoint(x: x * arView.bounds.width, y: y * arView.bounds.height)
        } else {
            point = CGPoint(x: x, y: y)
        }
        // Soft → strict: estimated (fast) → infinite extent → mature geometry.
        let allowings: [ARRaycastQuery.Target] = [
            .estimatedPlane,
            .existingPlaneInfinite,
            .existingPlaneGeometry,
        ]
        for allowing in allowings {
            guard let query = arView.raycastQuery(
                from: point,
                allowing: allowing,
                alignment: .horizontal
            ) else {
                continue
            }
            if let hit = arView.session.raycast(query).first {
                return hit
            }
        }
        return nil
    }

    private func placeAt(x: CGFloat, y: CGFloat) -> Bool {
        guard !placed, let arView, let template = modelTemplate else { return false }
        guard let result = hitHorizontal(x: x, y: y) else { return false }
        clearPlaced()

        let root = SCNNode()
        root.simdWorldTransform = result.worldTransform
        arView.scene.rootNode.addChildNode(root)

        let content = template.clone()
        root.addChildNode(content)
        placedRoot = root
        placedNode = content
        placed = true
        setPlanesHidden(true)
        faceCamera()
        startEmergence(on: content, root: root)
        notifyTracking("ready", message: "Fossil placed")
        return true
    }

    private func startEmergence(on content: SCNNode, root: SCNNode) {
        content.removeAllActions()
        ringNode?.removeFromParentNode()
        dustNode?.removeFromParentNode()
        ringNode = nil
        dustNode = nil

        if reducedMotion || UIAccessibility.isReduceMotionEnabled {
            introMultiplier = 0.85
            content.position = SCNVector3(0, 0, 0)
            applyScale()
            spawning = true
            let settle = SCNAction.customAction(duration: Self.reduceMotionMs / 1000) { [weak self] _, elapsed in
                guard let self else { return }
                let t = Float(elapsed / (Self.reduceMotionMs / 1000))
                self.introMultiplier = 0.85 + 0.15 * min(1, t)
                self.applyScale()
            }
            let done = SCNAction.run { [weak self] _ in
                guard let self else { return }
                self.introMultiplier = 1
                self.spawning = false
                self.applyScale()
            }
            content.runAction(SCNAction.sequence([settle, done]))
            return
        }

        introMultiplier = 0
        content.position = SCNVector3(0, Self.emergeStartY, 0)
        content.eulerAngles.y += Self.emergeYawRad
        applyScale()
        spawning = true
        spawnContactRipple(on: root)
        spawnDust(on: root)

        let riseDuration = Self.emergeRiseMs / 1000
        let jiggleDuration = Self.emergeJiggleMs / 1000
        let startY = Self.emergeStartY
        let overshoot = Self.emergeOvershoot
        let yaw = Self.emergeYawRad
        let baseYaw = content.eulerAngles.y

        let rise = SCNAction.customAction(duration: riseDuration) { [weak self] node, elapsed in
            guard let self else { return }
            let t = Float(min(1, elapsed / riseDuration))
            let eased = self.easeOutBack(t)
            self.introMultiplier = overshoot * eased
            node.position.y = startY * (1 - eased)
            node.eulerAngles.y = baseYaw - yaw * self.easeOutCubic(t)
            self.applyScale()
        }
        let jiggle = SCNAction.customAction(duration: jiggleDuration) { [weak self] node, elapsed in
            guard let self else { return }
            let t = Float(min(1, elapsed / jiggleDuration))
            self.introMultiplier = self.jiggleIntro(t)
            node.position.y = 0
            node.eulerAngles.y = baseYaw - yaw
            self.applyScale()
        }
        let finish = SCNAction.run { [weak self] node in
            guard let self else { return }
            self.introMultiplier = 1
            self.displayedScale = self.scaleFactor
            node.position = SCNVector3(0, 0, 0)
            node.eulerAngles.y = baseYaw - yaw
            self.spawning = false
            self.applyScale()
        }
        content.runAction(SCNAction.sequence([rise, jiggle, finish]))
    }

    private func spawnContactRipple(on root: SCNNode) {
        ringNode?.removeFromParentNode()
        let container = SCNNode()
        root.addChildNode(container)
        ringNode = container

        let colors: [(UIColor, CGFloat)] = [
            (colorGold, 0.55),
            (colorOrange, 0.40),
            (colorCream, 0.28),
        ]
        let ringDuration = Self.emergeRingMs / 1000
        let stagger = Self.emergeRingStaggerMs / 1000
        let scaleFrom = CGFloat(Self.emergeRingScaleFrom)
        let scaleTo = CGFloat(Self.emergeRingScaleTo)

        for (index, entry) in colors.enumerated() {
            let (color, peakAlpha) = entry
            let torus = SCNTorus(ringRadius: 0.048, pipeRadius: 0.002)
            let material = SCNMaterial()
            material.diffuse.contents = color.withAlphaComponent(peakAlpha)
            material.emission.contents = color.withAlphaComponent(peakAlpha * 0.35)
            material.lightingModel = .constant
            material.transparency = peakAlpha
            torus.firstMaterial = material
            let ring = SCNNode(geometry: torus)
            ring.eulerAngles.x = .pi / 2
            ring.scale = SCNVector3(scaleFrom, scaleFrom, scaleFrom)
            ring.opacity = 0
            container.addChildNode(ring)

            let wait = SCNAction.wait(duration: stagger * Double(index))
            let wave = SCNAction.customAction(duration: ringDuration) { node, elapsed in
                let t = CGFloat(min(1, elapsed / ringDuration))
                let u = 1 - t
                let eased = 1 - u * u * u
                let s = scaleFrom + (scaleTo - scaleFrom) * eased
                node.scale = SCNVector3(s, s, s)
                node.opacity = peakAlpha * u * u
            }
            ring.runAction(SCNAction.sequence([
                wait,
                wave,
                SCNAction.removeFromParentNode(),
            ]))
        }

        let cleanupWait = Self.emergeRingMs + Self.emergeRingStaggerMs * Double(colors.count - 1)
        container.runAction(SCNAction.sequence([
            SCNAction.wait(duration: cleanupWait / 1000 + 0.05),
            SCNAction.removeFromParentNode(),
        ])) { [weak self] in
            if self?.ringNode === container {
                self?.ringNode = nil
            }
        }
    }

    private func spawnDust(on root: SCNNode) {
        let dust = SCNNode()
        root.addChildNode(dust)
        dustNode = dust

        let system = SCNParticleSystem()
        system.birthRate = 24
        system.particleLifeSpan = 0.55
        system.emissionDuration = 0.32
        system.particleSize = 0.005
        system.particleSizeVariation = 0.003
        system.particleColor = colorCream
        system.particleColorVariation = SCNVector4(0.08, 0.05, 0.02, 0.2)
        system.emitterShape = SCNSphere(radius: 0.02)
        system.spreadingAngle = 55
        system.particleVelocity = 0.16
        system.particleVelocityVariation = 0.08
        system.acceleration = SCNVector3(0, -0.3, 0)
        system.blendMode = .alpha
        system.isAffectedByGravity = false
        system.loops = false

        let gold = system.copy() as! SCNParticleSystem
        gold.particleColor = colorGold
        gold.birthRate = 14
        gold.particleVelocity = 0.12
        dust.addParticleSystem(system)
        dust.addParticleSystem(gold)
        dust.runAction(SCNAction.sequence([
            SCNAction.wait(duration: 0.9),
            SCNAction.removeFromParentNode()
        ])) { [weak self] in
            self?.dustNode = nil
        }
    }

    private func easeOutBack(_ t: Float) -> Float {
        let c1: Float = 2.2
        let c3 = c1 + 1
        let u = t - 1
        return 1 + c3 * u * u * u + c1 * u * u
    }

    private func easeOutCubic(_ t: Float) -> Float {
        let u = 1 - t
        return 1 - u * u * u
    }

    private func jiggleIntro(_ t: Float) -> Float {
        let u = min(1, max(0, t))
        let ts: [Float] = [0, 0.35, 0.7, 1]
        let vs: [Float] = [Self.emergeOvershoot, 0.94, 1.06, 1]
        for i in 0..<(ts.count - 1) {
            if u <= ts[i + 1] {
                let local = (u - ts[i]) / max(0.0001, ts[i + 1] - ts[i])
                let a = vs[i]
                let b = vs[i + 1]
                return a + (b - a) * easeOutCubic(local)
            }
        }
        return 1
    }

    private func moveAt(x: CGFloat, y: CGFloat) -> Bool {
        guard placed, !spawning, let root = placedRoot, let content = placedNode else {
            return false
        }
        guard let result = hitHorizontal(x: x, y: y) else { return false }
        let euler = content.eulerAngles
        let localScale = content.scale
        let localPosition = content.position
        root.simdWorldTransform = result.worldTransform
        content.eulerAngles = euler
        content.scale = localScale
        content.position = localPosition
        return true
    }

    private func applyScale() {
        guard let node = placedNode else { return }
        let scale = CGFloat(baseScale * displayedScale * introMultiplier)
        node.scale = SCNVector3(scale, scale, scale)
    }

    private func ensureScaleSmoothing() {
        cancelScaleSmoothing()
        let from = displayedScale
        let to = scaleFactor
        if abs(to - from) < 0.0008 {
            displayedScale = to
            applyScale()
            return
        }
        scaleAnimFrom = from
        scaleAnimTo = to
        scaleAnimStart = CACurrentMediaTime()
        let link = CADisplayLink(target: self, selector: #selector(tickScaleSmooth))
        link.add(to: .main, forMode: .common)
        scaleDisplayLink = link
    }

    private var scaleAnimFrom: Float = 1
    private var scaleAnimTo: Float = 1
    private var scaleAnimStart: CFTimeInterval = 0
    private let scaleAnimDuration: CFTimeInterval = 0.18

    @objc private func tickScaleSmooth() {
        let t = min(1, (CACurrentMediaTime() - scaleAnimStart) / scaleAnimDuration)
        let u = 1 - t
        let eased = 1 - u * u * u
        displayedScale = scaleAnimFrom + (scaleAnimTo - scaleAnimFrom) * Float(eased)
        applyScale()
        if t >= 1 {
            displayedScale = scaleFactor
            applyScale()
            cancelScaleSmoothing()
        }
    }

    private func cancelScaleSmoothing() {
        scaleDisplayLink?.invalidate()
        scaleDisplayLink = nil
    }

    /// Point the skull toward the camera.
    /// - Parameter alignViewpoint: Recentre = full pitch+yaw toward camera;
    ///   post-place = yaw-only + level so emerge yaw animation stays stable.
    private func faceCamera(alignViewpoint: Bool = false) {
        guard let node = placedNode, let root = placedRoot, let camera = arView?.pointOfView else {
            return
        }
        let cameraWorld = camera.worldPosition
        // Camera in the plane-anchor's local space so yaw is correct under hit pose.
        let localCam = root.convertPosition(cameraWorld, from: nil)
        let localPos = node.position
        let dx = localCam.x - localPos.x
        let dy = localCam.y - localPos.y
        let dz = localCam.z - localPos.z
        let horiz = sqrt(dx * dx + dz * dz)
        guard horiz > 1e-5 else { return }

        let yaw = atan2(dx, dz)
        if !alignViewpoint {
            node.eulerAngles = SCNVector3(0, yaw, 0)
            return
        }
        let pitch = max(-40 * .pi / 180, min(40 * .pi / 180, -atan2(dy, horiz)))
        node.eulerAngles = SCNVector3(pitch, yaw, 0)
    }

    private func setPlanesHidden(_ hidden: Bool) {
        for node in planeNodes.values {
            node.isHidden = hidden
            if hidden {
                node.removeAction(forKey: Self.planeRevealActionKey)
                node.removeAction(forKey: Self.planeBreathActionKey)
            }
        }
    }

    private func planeGridTexture() -> UIImage {
        if let cached = planeGridImage {
            return cached
        }
        let bundle = Bundle(for: NativeArPlugin.self)
        if let url = bundle.url(forResource: "coh_plane_grid", withExtension: "png"),
           let image = UIImage(contentsOfFile: url.path) {
            planeGridImage = image
            return image
        }
        // Procedural fallback if the pod resource was not copied.
        let size = CGSize(width: 256, height: 256)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            UIColor.clear.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            let cell: CGFloat = 32
            ctx.cgContext.setStrokeColor(UIColor.white.withAlphaComponent(0.35).cgColor)
            ctx.cgContext.setLineWidth(1)
            var x: CGFloat = 0
            while x <= size.width {
                ctx.cgContext.move(to: CGPoint(x: x, y: 0))
                ctx.cgContext.addLine(to: CGPoint(x: x, y: size.height))
                x += cell
            }
            var y: CGFloat = 0
            while y <= size.height {
                ctx.cgContext.move(to: CGPoint(x: 0, y: y))
                ctx.cgContext.addLine(to: CGPoint(x: size.width, y: y))
                y += cell
            }
            ctx.cgContext.strokePath()
            let dot = UIColor.white.withAlphaComponent(0.78)
            x = 0
            while x <= size.width {
                y = 0
                while y <= size.height {
                    let r: CGFloat = 2.2
                    ctx.cgContext.setFillColor(dot.cgColor)
                    ctx.cgContext.fillEllipse(in: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2))
                    y += cell
                }
                x += cell
            }
        }
        planeGridImage = image
        return image
    }

    private func makePlaneMaterial() -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = planeGridTexture()
        material.diffuse.wrapS = .repeat
        material.diffuse.wrapT = .repeat
        material.diffuse.contentsTransform = SCNMatrix4MakeScale(4, 4, 1)
        material.multiply.contents = colorGold
        material.emission.contents = colorGold.withAlphaComponent(0.22)
        material.lightingModel = .constant
        material.isDoubleSided = true
        material.writesToDepthBuffer = false
        material.blendMode = .alpha
        material.transparency = 1
        return material
    }

    private func makePlaneNode(for plane: ARPlaneAnchor) -> SCNNode {
        let mesh: SCNNode
        if let device = arView?.device,
           let geometry = ARSCNPlaneGeometry(device: device) {
            geometry.update(from: plane.geometry)
            geometry.firstMaterial = makePlaneMaterial()
            mesh = SCNNode(geometry: geometry)
        } else {
            let extent = SCNPlane(
                width: CGFloat(plane.extent.x),
                height: CGFloat(plane.extent.z)
            )
            extent.firstMaterial = makePlaneMaterial()
            mesh = SCNNode(geometry: extent)
            mesh.eulerAngles.x = -.pi / 2
            mesh.position = SCNVector3(plane.center.x, 0, plane.center.z)
        }
        mesh.opacity = 0
        mesh.scale = SCNVector3(0.85, 0.85, 0.85)
        return mesh
    }

    private func playPlaneReveal(on mesh: SCNNode) {
        mesh.removeAction(forKey: Self.planeRevealActionKey)
        mesh.removeAction(forKey: Self.planeBreathActionKey)
        let reduce = reducedMotion || UIAccessibility.isReduceMotionEnabled
        if reduce {
            mesh.opacity = Self.planeTargetOpacity
            mesh.scale = SCNVector3(1, 1, 1)
            return
        }
        mesh.opacity = 0
        mesh.scale = SCNVector3(0.85, 0.85, 0.85)
        let duration = Self.planeRevealMs / 1000
        let fade = SCNAction.fadeOpacity(to: Self.planeTargetOpacity, duration: duration)
        fade.timingMode = .easeOut
        let grow = SCNAction.scale(to: 1, duration: duration)
        grow.timingMode = .easeOut
        let reveal = SCNAction.group([fade, grow])
        let startBreath = SCNAction.run { [weak self] node in
            self?.startPlaneBreath(on: node)
        }
        mesh.runAction(SCNAction.sequence([reveal, startBreath]), forKey: Self.planeRevealActionKey)
    }

    private func startPlaneBreath(on mesh: SCNNode) {
        mesh.removeAction(forKey: Self.planeBreathActionKey)
        if reducedMotion || UIAccessibility.isReduceMotionEnabled || placed || mesh.isHidden {
            return
        }
        let low = Self.planeTargetOpacity - Self.planeBreathDelta
        let high = Self.planeTargetOpacity + Self.planeBreathDelta
        let half = Self.planeBreathMs / 2000
        let up = SCNAction.fadeOpacity(to: high, duration: half)
        up.timingMode = .easeInEaseOut
        let down = SCNAction.fadeOpacity(to: low, duration: half)
        down.timingMode = .easeInEaseOut
        mesh.runAction(SCNAction.repeatForever(SCNAction.sequence([up, down])), forKey: Self.planeBreathActionKey)
    }

    private func replayPlaneReveals() {
        for node in planeNodes.values where !node.isHidden {
            playPlaneReveal(on: node)
        }
    }

    private func clearPlaced() {
        placedNode?.removeAllActions()
        ringNode?.removeAllActions()
        ringNode?.removeFromParentNode()
        dustNode?.removeAllActions()
        dustNode?.removeFromParentNode()
        ringNode = nil
        dustNode = nil
        placedRoot?.removeFromParentNode()
        placedRoot = nil
        placedNode = nil
        placed = false
        spawning = false
        introMultiplier = 1
        displayedScale = scaleFactor
        cancelScaleSmoothing()
    }

    private func teardown() {
        cancelScaleSmoothing()
        clearPlaced()
        for node in planeNodes.values {
            node.removeFromParentNode()
        }
        planeNodes.removeAll()
        arView?.session.pause()
        arView?.removeFromSuperview()
        arView = nil
        modelTemplate = nil
        lastTrackingKey = nil
        if let webView = bridge?.webView {
            webView.isOpaque = originalOpaque
            webView.backgroundColor = UIColor(
                red: 0.051,\r
green: 0.067,\r
                blue: 0.090,
                alpha: 1
            )
            webView.scrollView.backgroundColor = webView.backgroundColor
        }
    }

    private func notifyTracking(_ state: String, message: String? = nil) {
        let key = "\(state)\u{0}\(message ?? "")"
        guard key != lastTrackingKey else { return }
        lastTrackingKey = key
        var data: [String: Any] = ["state": state]
        if let message {
            data["message"] = message
        }
        notifyListeners("trackingChanged", data: data)
    }

    public func renderer(
        _ renderer: SCNSceneRenderer,
        didAdd node: SCNNode,
        for anchor: ARAnchor
    ) {
        guard let plane = anchor as? ARPlaneAnchor else { return }
        let mesh = makePlaneNode(for: plane)
        node.addChildNode(mesh)
        planeNodes[plane.identifier] = mesh
        if !placed {
            playPlaneReveal(on: mesh)
        } else {
            mesh.isHidden = true
        }
        if !planeNotified {
            planeNotified = true
            notifyListeners("planeFound", data: [:])
            notifyTracking("ready", message: "Tap to place a fossil")
        }
    }

    public func renderer(
        _ renderer: SCNSceneRenderer,
        didUpdate node: SCNNode,
        for anchor: ARAnchor
    ) {
        guard
            let plane = anchor as? ARPlaneAnchor,
            let mesh = planeNodes[plane.identifier]
        else {
            return
        }
        if let geometry = mesh.geometry as? ARSCNPlaneGeometry {
            geometry.update(from: plane.geometry)
        } else if let geometry = mesh.geometry as? SCNPlane {
            geometry.width = CGFloat(plane.extent.x)
            geometry.height = CGFloat(plane.extent.z)
            mesh.position = SCNVector3(plane.center.x, 0, plane.center.z)
        }
    }

    public func renderer(
        _ renderer: SCNSceneRenderer,
        didRemove node: SCNNode,
        for anchor: ARAnchor
    ) {
        guard let plane = anchor as? ARPlaneAnchor else { return }
        planeNodes[plane.identifier]?.removeFromParentNode()
        planeNodes.removeValue(forKey: plane.identifier)
    }

    public func session(
        _ session: ARSession,
        cameraDidChangeTrackingState camera: ARCamera
    ) {
        switch camera.trackingState {
        case .normal:
            // Ready as soon as tracking is normal — estimatedPlane hit-tests work without a mature mesh.
            if !planeNotified {
                planeNotified = true
                notifyListeners("planeFound", data: [:])
            }
            notifyTracking("ready", message: placed ? "Fossil placed" : "Tap to place a fossil")
        case .notAvailable:
            notifyTracking("unavailable", message: "Tracking unavailable")
        case .limited(let reason):
            switch reason {
            case .initializing:
                notifyTracking("initializing", message: "Starting ARKit tracking")
            case .excessiveMotion:
                notifyTracking("limited", message: "Move the phone more slowly")
            case .insufficientFeatures:
                notifyTracking("limited", message: "Point the camera at a textured surface")
            case .relocalizing:
                notifyTracking("limited", message: "Restoring tracking")
            @unknown default:
                notifyTracking("limited", message: "Tracking limited")
            }
        }
    }

    public func session(_ session: ARSession, didFailWithError error: Error) {
        let lower = error.localizedDescription.lowercased()
        let message = (lower.contains("camera") || lower.contains("permission"))
            ? "Camera access is needed to place fossils on a table."
            : "Could not start the camera on this device."
        notifyTracking("unavailable", message: message)
        notifyListeners("error", data: ["message": message])
        notifyListeners("sessionEnded", data: [:])
    }
}
