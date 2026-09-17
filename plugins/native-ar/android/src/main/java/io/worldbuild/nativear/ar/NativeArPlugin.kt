package io.worldbuild.nativear.ar

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.opengl.Matrix
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.getcapacitor.JSObject
import com.getcapacitor.Logger
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import com.google.ar.core.HitResult
import com.google.ar.core.InstantPlacementPoint
import com.google.ar.core.Plane
import com.google.ar.core.PointCloud
import com.google.ar.core.Pose
import com.google.ar.core.TrackingState
import com.google.android.filament.Texture
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException
import io.github.sceneview.SceneView
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.node.AnchorNode
import io.github.sceneview.ar.scene.PlaneRenderer
import io.github.sceneview.loaders.MaterialLoader
import io.github.sceneview.material.setParameter
import io.github.sceneview.material.setTexture
import io.github.sceneview.safeDestroyTexture
import io.github.sceneview.texture.ImageTexture
import dev.romainguy.kotlin.math.Float2
import dev.romainguy.kotlin.math.Float3
import dev.romainguy.kotlin.math.Quaternion
import dev.romainguy.kotlin.math.inverse
import dev.romainguy.kotlin.math.normalize
import io.github.sceneview.math.Color as SceneColor
import io.github.sceneview.math.Direction
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation
import io.github.sceneview.math.Scale
import io.github.sceneview.math.Size
import io.github.sceneview.model.ModelInstance
import io.github.sceneview.node.CubeNode
import io.github.sceneview.node.ImageNode
import io.github.sceneview.node.ModelNode
import java.io.DataInputStream
import java.io.File
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import org.json.JSONObject

@CapacitorPlugin(
    name = "NativeAr",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
    ],
)
class NativeArPlugin : Plugin() {

    private var arSceneView: ARSceneView? = null
    private var featurePointHudView: FeaturePointHudView? = null
    private var featurePointHudEnabled = true
    private var depthPeekView: DepthPeekView? = null
    private var depthPeekEnabled = true
    private var depthModeActive = false
    private var depthModeResolved = false
    private var depthPeekTick = 0
    private var depthPeekHidden = false
    private var depthPeekPixels: IntArray? = null
    private val depthImageCorners = FloatArray(8)
    private val depthViewCorners = FloatArray(8)
    private val hudViewMtx = FloatArray(16)
    private val hudProjMtx = FloatArray(16)
    private val hudVpMtx = FloatArray(16)
    private val hudWorld = FloatArray(4)
    private val hudClip = FloatArray(4)
    private val hudScratch = FloatArray(FeaturePointHudView.MAX_POINTS * 2)
    private var materialLoader: MaterialLoader? = null
    private var loadedModelInstance: ModelInstance? = null
    private var modelNode: ModelNode? = null
    private var modelBaseScale: Scale? = null
    private var modelRestY = 0f
    private var anchorNode: AnchorNode? = null
    private var debugMarkerNode: CubeNode? = null
    private var planeGridTexture: Texture? = null
    private var rippleNodes: MutableList<ImageNode> = mutableListOf()
    private var softRingBitmap: Bitmap? = null
    private var placed = false
    /** UI ready for tap (camera TRACKING — Instant Placement usable). */
    private var surfaceFound = false
    /** Real plane exists — orange grid spotlight reveal. */
    private var planeVisualReady = false
    private var scaleFactor = 1f
    /** Rendered scale; eases toward [scaleFactor] for gentle pinch. */
    private var displayedScale = 1f
    private var introMultiplier = 1f
    private var reducedMotion = false
    private var modelHasBaseColorTexture = true
    private var matteApplied = false
    private var emergeAnimator: ValueAnimator? = null
    private var scaleAnimator: ValueAnimator? = null
    private var rippleAnimator: ValueAnimator? = null
    private var planeRevealAnimator: ValueAnimator? = null
    private var planeBreathAnimator: ValueAnimator? = null
    private var planeSpotlightRadius = PLANE_SPOTLIGHT_START

    private var pendingStartCall: PluginCall? = null
    private var sessionFrameReceived = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var sessionWatchdog: Runnable? = null
    private var attachCompleted = false
    private var arLifecycleOwner: PluginLifecycleOwner? = null
    private var sensorManager: SensorManager? = null
    private var imuWarmupListener: SensorEventListener? = null
    private var lastTrackingKey: String? = null

    private class PluginLifecycleOwner : LifecycleOwner {
        val registry = LifecycleRegistry(this)
        override val lifecycle: Lifecycle
            get() = registry
    }

    companion object {
        private const val SESSION_START_TIMEOUT_MS = 10000L
        private const val MODEL_SIZE_METERS = 0.28f
        private const val EMERGE_RISE_MS = 520L
        private const val EMERGE_JIGGLE_MS = 380L
        private const val EMERGE_DURATION_MS = EMERGE_RISE_MS + EMERGE_JIGGLE_MS
        private const val EMERGE_OVERSHOOT = 1.18f
        private const val EMERGE_FLOOR = 0.02f
        private const val EMERGE_START_Y = -0.04f
        private const val EMERGE_RING_MS = 620L
        private const val EMERGE_RING_STAGGER_MS = 55L
        private const val EMERGE_RING_SCALE_FROM = 0.12f
        private const val EMERGE_RING_SCALE_TO = 2.15f
        private const val EMERGE_RING_BITMAP_SIZE = 128
        private const val EMERGE_RING_PLANE_M = 0.1f
        private const val GLB_MAGIC = 0x46546C67
        private const val GLB_JSON_CHUNK = 0x4E4F534A
        private const val MAX_GLB_JSON_BYTES = 16 shl 20
        private const val PLANE_GRID_ASSET = "textures/coh_plane_grid.png"
        private const val PLANE_GRID_UV_SCALE = 5f
        private const val PLANE_SPOTLIGHT_START = 0.35f
        private const val PLANE_SPOTLIGHT_SETTLED = 1.0f
        private const val PLANE_REVEAL_MS = 800L
        /** Phone-to-table hold distance for Instant Placement before a plane exists. */
        private const val INSTANT_PLACEMENT_DISTANCE_M = 1.0f
        private const val PLANE_BREATH_MS = 2000L
        private const val PLANE_BREATH_AMPLITUDE = 0.08f
        /** User pinch range — free feel with hard stops at the ends. */
        private const val SCALE_MIN = 0.2f
        private const val SCALE_MAX = 5f
    }

    /** org.json / Capacitor JSObject forbids NaN/Inf in resolve payloads. */
    private fun safeJsonNum(v: Double): Any =
        if (v.isFinite()) v else JSONObject.NULL

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val supported = try {
            ArCoreApk.getInstance().checkAvailability(context).isSupported
        } catch (_: Exception) {
            false
        }
        call.resolve(JSObject().apply {
            put("supported", supported)
            put("backend", if (supported) "arcore" else "none")
        })
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val supported = try {
            ArCoreApk.getInstance().checkAvailability(context).isSupported
        } catch (_: Exception) {
            false
        }
        call.resolve(JSObject().apply { put("available", supported) })
    }

    @PluginMethod
    fun startSession(call: PluginCall) = startInternal(call)

    @PluginMethod
    fun start(call: PluginCall) = startInternal(call)

    private fun startInternal(call: PluginCall) {
        val modelPath = call.getString("modelPath")?.takeIf { it.isNotBlank() }
        if (modelPath == null) {
            call.reject("modelPath is required")
            return
        }
        reducedMotion = call.getBoolean("reducedMotion") ?: false
        featurePointHudEnabled = call.getBoolean("featurePointHud") ?: true
        depthPeekEnabled = call.getBoolean("depthPeek") ?: true
        placed = false
        surfaceFound = false
        planeVisualReady = false
        scaleFactor = 1f
        displayedScale = 1f
        introMultiplier = 1f
        lastTrackingKey = null
        cancelScaleSmoothing()

        if (getPermissionState("camera") == PermissionState.GRANTED) {
            ensureArCoreAndBeginSession(call)
        } else {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback")
        }
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            ensureArCoreAndBeginSession(call)
        } else {
            call.reject("Camera permission denied")
        }
    }

    private fun ensureArCoreAndBeginSession(call: PluginCall) {
        val activity = activity ?: run {
            call.reject("No activity available")
            return
        }

        try {
            when (ArCoreApk.getInstance().requestInstall(activity, true)) {
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> pendingStartCall = call
                ArCoreApk.InstallStatus.INSTALLED -> {
                    pendingStartCall = null
                    beginSession(call)
                }
            }
        } catch (_: UnavailableUserDeclinedInstallationException) {
            pendingStartCall = null
            call.reject("ARCore install declined")
        } catch (_: UnavailableDeviceNotCompatibleException) {
            pendingStartCall = null
            call.reject("ARCore is not supported on this device")
        } catch (ex: Exception) {
            pendingStartCall = null
            call.reject("Failed to prepare ARCore: ${formatError(ex)}")
        }
    }

    private fun beginSession(call: PluginCall) {
        val modelPath = call.getString("modelPath")!!
        bridge.executeOnMainThread {
            try {
                attachArView(
                    modelPath = modelPath,
                    onReady = {
                        notifyTracking("initializing", "Starting ARCore session")
                        call.resolve()
                    },
                    onFailed = { ex ->
                        Logger.error("NativeAr attach failed", ex)
                        detachArView()
                        call.reject("Failed to start native AR: ${formatError(ex)}")
                    },
                )
            } catch (ex: Exception) {
                Logger.error("NativeAr attach failed", ex)
                detachArView()
                call.reject("Failed to start native AR: ${formatError(ex)}")
            }
        }
    }

    @PluginMethod
    fun stopSession(call: PluginCall) = stopInternal(call)

    @PluginMethod
    fun stop(call: PluginCall) = stopInternal(call)

    private fun stopInternal(call: PluginCall) {
        pendingStartCall = null
        bridge.executeOnMainThread {
            detachArView()
            notifySessionEnded()
            call.resolve()
        }
    }

    @PluginMethod
    fun onScreenTap(call: PluginCall) = tapInternal(call)

    @PluginMethod
    fun tap(call: PluginCall) = tapInternal(call)

    private fun tapInternal(call: PluginCall) {
        val x = call.getFloat("x") ?: run {
            call.reject("Missing tap x")
            return
        }
        val y = call.getFloat("y") ?: run {
            call.reject("Missing tap y")
            return
        }
        bridge.executeOnMainThread {
            val out = placeModelAtScreen(x, y, arSceneView)
            call.resolve(out)
        }
    }

    @PluginMethod
    fun moveScreen(call: PluginCall) = moveInternal(call)

    @PluginMethod
    fun move(call: PluginCall) = moveInternal(call)

    private fun moveInternal(call: PluginCall) {
        val x = call.getFloat("x") ?: run {
            call.reject("Missing move x")
            return
        }
        val y = call.getFloat("y") ?: run {
            call.reject("Missing move y")
            return
        }
        bridge.executeOnMainThread {
            // #region agent log
            Logger.info(
                "DBG_a996cb",
                "native_move|x=$x|y=$y|placed=$placed|emerging=${emergeAnimator != null}",
            )
            // #endregion
            val didMove = arSceneView?.let { moveModelAtScreen(x, y, it) } ?: false
            // #region agent log
            Logger.info("DBG_a996cb", "native_move_result|moved=$didMove")
            // #endregion
            call.resolve(JSObject().apply { put("moved", didMove) })
        }
    }

    @PluginMethod
    fun reposition(call: PluginCall) {
        bridge.executeOnMainThread {
            clearPlacement(keepModel = true)
            arSceneView?.let { stylePlaneRenderer(it) }
            call.resolve()
        }
    }

    @PluginMethod
    fun recenter(call: PluginCall) {
        bridge.executeOnMainThread {
            faceCamera(alignViewpoint = true)
            call.resolve()
        }
    }

    @PluginMethod
    fun rotate(call: PluginCall) {
        val dx = call.getFloat("dx") ?: 0f
        val dy = call.getFloat("dy") ?: 0f
        bridge.executeOnMainThread {
            val node = modelNode?.takeIf { placed } ?: run {
                call.resolve()
                return@executeOnMainThread
            }
            val view = arSceneView ?: run {
                call.resolve()
                return@executeOnMainThread
            }
            // Orbit axes in parent space: world-up yaw + horizontal view pitch.
            val yawDeg = dx * 0.45f
            val pitchDeg = -dy * 0.30f

            val camPos = view.cameraNode.worldPosition
            val modelPos = node.worldPosition
            val toModel = Float3(
                modelPos.x - camPos.x,
                modelPos.y - camPos.y,
                modelPos.z - camPos.z,
            )
            val pitchWorld = Float3(toModel.z, 0f, -toModel.x)
            val pitchLen = sqrt(
                pitchWorld.x * pitchWorld.x +
                    pitchWorld.y * pitchWorld.y +
                    pitchWorld.z * pitchWorld.z,
            )

            var localQ = node.quaternion
            if (yawDeg != 0f) {
                val yawAxis = worldDirectionToParentLocal(node, Float3(y = 1.0f))
                localQ = Quaternion.fromAxisAngle(yawAxis, yawDeg) * localQ
            }
            if (pitchDeg != 0f && pitchLen >= 1e-5f) {
                val pitchAxisWorld = Float3(
                    pitchWorld.x / pitchLen,
                    pitchWorld.y / pitchLen,
                    pitchWorld.z / pitchLen,
                )
                val pitchAxis = worldDirectionToParentLocal(node, pitchAxisWorld)
                localQ = Quaternion.fromAxisAngle(pitchAxis, pitchDeg) * localQ
            }
            node.quaternion = localQ
            call.resolve()
        }
    }

    /** Map a world-space direction into the parent frame used by [node.quaternion]. */
    private fun worldDirectionToParentLocal(node: ModelNode, worldDir: Float3): Float3 {
        val parent = node.parent ?: return worldDir
        val inv = inverse(normalize(parent.worldQuaternion))
        val local = inv * worldDir
        val len = sqrt(local.x * local.x + local.y * local.y + local.z * local.z)
        if (len < 1e-5f) return Float3(y = 1.0f)
        return Float3(local.x / len, local.y / len, local.z / len)
    }

    @PluginMethod
    fun setScale(call: PluginCall) {
        scaleFactor = (call.getFloat("factor") ?: 1f).coerceIn(SCALE_MIN, SCALE_MAX)
        bridge.executeOnMainThread {
            // #region agent log
            val base = modelBaseScale
            Logger.info(
                "DBG_a996cb",
                "native_scale_set|" +
                    "target=$scaleFactor|displayed=$displayedScale|intro=$introMultiplier|" +
                    "base=${base?.x},${base?.y},${base?.z}|" +
                    "baseId=${System.identityHashCode(base)}|" +
                    "nodeScaleId=${System.identityHashCode(modelNode?.scale)}|" +
                    "emerging=${emergeAnimator != null}|reduced=$reducedMotion|" +
                    "smoothRunning=${scaleAnimator?.isRunning == true}",
            )
            // #endregion
            // Pinch streams many setScale/frame — follow 1:1 (no retarget animator starvation).
            cancelScaleSmoothing()
            displayedScale = scaleFactor
            if (emergeAnimator == null) {
                applyModelScale()
            }
            call.resolve()
        }
    }

    /**
     * QA/diagnostic: place model (+ optional matte cube) 0.55m in front of the
     * camera without a plane hit. Used to separate "no surface" from "placed
     * but invisible" on wireless debug. `demetalize` forces the matte bone
     * material even on textured models.
     */
    @PluginMethod
    fun debugPlaceFront(call: PluginCall) {
        val withCube = call.getBoolean("withCube", true) == true
        val forceMatte = call.getBoolean("demetalize", false) == true
        bridge.executeOnMainThread {
            val result = placeModelInFrontOfCamera(withCube, forceMatte)
            call.resolve(result)
        }
    }

    private fun attachArView(
        modelPath: String,
        onReady: () -> Unit,
        onFailed: (Exception) -> Unit,
    ) {
        detachArView()

        val activity = activity as? ComponentActivity
            ?: throw IllegalStateException("No activity")
        val webView = bridge.webView

        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        var parent: android.view.ViewParent? = webView.parent
        while (parent is View) {
            parent.setBackgroundColor(Color.TRANSPARENT)
            parent = parent.parent
        }

        val webParent = webView.parent as? ViewGroup
            ?: throw IllegalStateException("WebView has no parent")
        val index = webParent.indexOfChild(webView)
        val params = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        )

        val sceneView = ARSceneView(
            context = activity,
            sharedActivity = null,
            sharedLifecycle = null,
            onSessionFailed = { ex ->
                bridge.executeOnMainThread {
                    Logger.error("NativeAr session failed", ex)
                    notifyTracking("unavailable", formatError(ex))
                    detachArView()
                    notifySessionEnded()
                }
            },
        )

        try {
            sceneView.arCore.checkCameraPermission = false
            sceneView.arCore.checkAvailability = false
            sceneView.keepScreenOn = true
            stylePlaneRenderer(sceneView)
            sceneView.configureSession { session, config ->
                config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
                config.updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                config.focusMode = Config.FocusMode.AUTO
                config.lightEstimationMode = Config.LightEstimationMode.DISABLED
                config.instantPlacementMode = Config.InstantPlacementMode.LOCAL_Y_UP
                val depthOk = session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)
                depthModeActive = depthOk
                depthModeResolved = true
                config.depthMode = if (depthOk) {
                    Config.DepthMode.AUTOMATIC
                } else {
                    Config.DepthMode.DISABLED
                }
            }

            sceneView.lightEstimator?.isEnabled = false
            sceneView.lightEstimator = null
            if (sceneView.mainLightNode == null) {
                sceneView.mainLightNode = SceneView.DefaultLightNode(sceneView.engine)
            }
            val lightDirection = run {
                val x = -0.5f
                val y = -1f
                val z = -0.8f
                val length = sqrt(x * x + y * y + z * z)
                Direction(x / length, y / length, z / length)
            }
            sceneView.mainLightNode?.let { light ->
                light.intensity = 100_000f
                light.lightDirection = lightDirection
            }
            sceneView.mainLightEstimatedNode?.let { light ->
                light.intensity = 100_000f
                light.lightDirection = lightDirection
            }

            sceneView.onSessionUpdated = { _, frame ->
                if (!sessionFrameReceived) {
                    sessionFrameReceived = true
                    cancelSessionWatchdog()
                }
                updateSurfaceProbe(sceneView, frame)
                featurePointHudView?.let { updateFeaturePointHud(frame, it) }
                depthPeekView?.let { updateDepthPeek(frame, it) }
                when (frame.camera.trackingState) {
                    TrackingState.TRACKING -> {
                        if (surfaceFound) {
                            notifyTracking("ready", if (placed) "Fossil placed" else "Tap to place a fossil")
                        } else {
                            notifyTracking("initializing", "Move phone to find a surface")
                        }
                    }
                    TrackingState.PAUSED -> notifyTracking("limited", "Tracking limited")
                    TrackingState.STOPPED -> notifyTracking("unavailable", "Tracking stopped")
                }
            }

            val owner = PluginLifecycleOwner()
            owner.registry.currentState = Lifecycle.State.INITIALIZED
            sceneView.lifecycle = owner.lifecycle
            arLifecycleOwner = owner

            webParent.addView(sceneView, index, params)
            var overlayAt = index + 1
            if (featurePointHudEnabled) {
                val hud = FeaturePointHudView(activity)
                webParent.addView(hud, overlayAt, params)
                featurePointHudView = hud
                overlayAt++
            }
            if (depthPeekEnabled) {
                val peek = DepthPeekView(activity)
                webParent.addView(peek, overlayAt, params)
                depthPeekView = peek
            }
            webView.bringToFront()
            materialLoader = MaterialLoader(sceneView.engine, activity)
            arSceneView = sceneView
            attachCompleted = false

            fun finishAttach() {
                if (attachCompleted || arSceneView !== sceneView) return
                attachCompleted = true
                // Cube AR order: IMU → controlled lifecycle → onReady, then GLB.
                // Preloading Filament before Session.resume races StrictMode teardown.
                startImuWarmup(activity)
                sceneView.postDelayed({
                    if (arSceneView !== sceneView) return@postDelayed
                    try {
                        startControlledLifecycle(sceneView)
                        sessionFrameReceived = false
                        scheduleSessionWatchdog()
                        onReady()
                        preloadModel(
                            sceneView = sceneView,
                            modelPath = modelPath,
                            onLoaded = { /* ready for place */ },
                            onFailed = { ex ->
                                Logger.error("NativeAr model preload failed", ex)
                                notifyTracking(
                                    "unavailable",
                                    "Could not load this fossil model.",
                                )
                            },
                        )
                    } catch (ex: Exception) {
                        attachCompleted = false
                        stopImuWarmup()
                        arLifecycleOwner = null
                        destroyPlaneGridTexture(sceneView.engine)
                        safeDestroySceneView(sceneView)
                        arSceneView = null
                        materialLoader = null
                        onFailed(ex)
                    }
                }, 200L)
            }

            if (sceneView.width > 0 && sceneView.height > 0) {
                finishAttach()
            } else {
                val layoutListener = object : ViewTreeObserver.OnGlobalLayoutListener {
                    override fun onGlobalLayout() {
                        if (sceneView.width <= 0 || sceneView.height <= 0) return
                        if (sceneView.viewTreeObserver.isAlive) {
                            sceneView.viewTreeObserver.removeOnGlobalLayoutListener(this)
                        }
                        finishAttach()
                    }
                }
                sceneView.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
                sceneView.post {
                    if (sceneView.width > 0 && sceneView.height > 0) {
                        if (sceneView.viewTreeObserver.isAlive) {
                            sceneView.viewTreeObserver.removeOnGlobalLayoutListener(layoutListener)
                        }
                        finishAttach()
                    }
                }
            }
        } catch (ex: Exception) {
            arLifecycleOwner = null
            safeDestroySceneView(sceneView)
            onFailed(ex)
        }
    }

    private fun preloadModel(
        sceneView: ARSceneView,
        modelPath: String,
        onLoaded: () -> Unit,
        onFailed: (Exception) -> Unit,
    ) {
        val candidates = modelCandidates(modelPath)

        fun tryCandidate(index: Int) {
            if (arSceneView !== sceneView) return
            if (index >= candidates.size) {
                onFailed(IllegalArgumentException("Could not load model: $modelPath"))
                return
            }
            val path = candidates[index]
            // SceneView's async loader throws uncaught FileNotFoundException on a
            // background dispatcher (process death) — probe Cap assets first.
            val textured = openModel(path)?.use(::glbHasBaseColorTexture) ?: run {
                tryCandidate(index + 1)
                return
            }
            try {
                sceneView.modelLoader.loadModelInstanceAsync(path) { instance ->
                    bridge.executeOnMainThread {
                        if (arSceneView !== sceneView) return@executeOnMainThread
                        if (instance != null) {
                            loadedModelInstance = instance
                            modelHasBaseColorTexture = textured
                            onLoaded()
                        } else {
                            tryCandidate(index + 1)
                        }
                    }
                }
            } catch (ex: Exception) {
                Logger.error("NativeAr model load threw for $path", ex)
                tryCandidate(index + 1)
            }
        }

        tryCandidate(0)
    }

    private fun openModel(path: String): InputStream? {
        val trimmed = path.trim()
        if (trimmed.isEmpty()) return null
        try {
            val file = when {
                trimmed.startsWith("file:", ignoreCase = true) ->
                    Uri.parse(trimmed).path?.let(::File)
                else -> File(trimmed)
            }
            if (file?.isAbsolute == true && file.isFile) return file.inputStream()
        } catch (_: Exception) {
            // Fall through to assets.
        }
        val assetPath = trimmed.trimStart('/').removePrefix("file:///android_asset/")
        return try {
            activity.assets.open(assetPath)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Filament has no IBL here, so an untextured PBR material reads as a flat
     * dark blob under the single directional light. Reads GLB chunk 0 (JSON)
     * to decide whether the loaded model keeps its own materials. Anything
     * that is not a parseable GLB keeps its materials.
     */
    private fun glbHasBaseColorTexture(input: InputStream): Boolean {
        return try {
            val data = DataInputStream(input)
            val header = ByteArray(20)
            data.readFully(header)
            val bb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)
            val jsonLength = bb.getInt(12)
            if (bb.getInt(0) != GLB_MAGIC ||
                bb.getInt(16) != GLB_JSON_CHUNK ||
                jsonLength !in 1..MAX_GLB_JSON_BYTES
            ) {
                return true
            }
            val json = ByteArray(jsonLength)
            data.readFully(json)
            val materials = JSONObject(String(json, Charsets.UTF_8))
                .optJSONArray("materials") ?: return false
            (0 until materials.length()).any { i ->
                materials.optJSONObject(i)
                    ?.optJSONObject("pbrMetallicRoughness")
                    ?.has("baseColorTexture") == true
            }
        } catch (_: Exception) {
            true
        }
    }

    private fun modelCandidates(modelPath: String): List<String> {
        val trimmed = modelPath.trim()
        val relative = trimmed.trimStart('/').removePrefix("public/")
        // Cap Android ships web assets under assets/public/ (iOS Bundle public/).
        val candidates = mutableListOf(
            "public/$relative",
            relative,
            trimmed,
        )
        val file = when {
            trimmed.startsWith("file:", ignoreCase = true) ->
                Uri.parse(trimmed).path?.let(::File)
            else -> File(trimmed)
        }
        if (file?.isAbsolute == true && file.isFile) {
            candidates += file.absolutePath
        }
        return candidates.filter { it.isNotBlank() }.distinct()
    }

    private fun startControlledLifecycle(sceneView: ARSceneView) {
        val registry = arLifecycleOwner?.registry
            ?: throw IllegalStateException("Missing AR lifecycle owner")
        if (registry.currentState == Lifecycle.State.INITIALIZED) {
            registry.handleLifecycleEvent(Lifecycle.Event.ON_CREATE)
        }
        if (registry.currentState.isAtLeast(Lifecycle.State.CREATED) &&
            !registry.currentState.isAtLeast(Lifecycle.State.STARTED)
        ) {
            registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
        }
        if (registry.currentState.isAtLeast(Lifecycle.State.STARTED) &&
            !registry.currentState.isAtLeast(Lifecycle.State.RESUMED)
        ) {
            registry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
        }
        if (sceneView.session == null) {
            sceneView.arCore.createSession(activity)
            sceneView.arCore.resume(activity, null)
        }
    }

    private fun startImuWarmup(context: Context) {
        stopImuWarmup()
        val manager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent?) {}
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }
        val types = intArrayOf(
            Sensor.TYPE_GYROSCOPE_UNCALIBRATED,
            Sensor.TYPE_ACCELEROMETER_UNCALIBRATED,
            Sensor.TYPE_GYROSCOPE,
            Sensor.TYPE_ACCELEROMETER,
        )
        var registered = 0
        for (type in types) {
            val sensor = manager.getDefaultSensor(type) ?: continue
            if (manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_FASTEST)) {
                registered++
            }
        }
        if (registered == 0) return
        sensorManager = manager
        imuWarmupListener = listener
    }

    private fun stopImuWarmup() {
        val listener = imuWarmupListener ?: return
        try {
            sensorManager?.unregisterListener(listener)
        } catch (_: Exception) {
            // Already unregistered.
        }
        imuWarmupListener = null
        sensorManager = null
    }

    private fun safeDestroySceneView(view: ARSceneView) {
        val registry = arLifecycleOwner?.registry
        if (registry != null) {
            try {
                if (registry.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                    registry.handleLifecycleEvent(Lifecycle.Event.ON_PAUSE)
                }
                if (registry.currentState.isAtLeast(Lifecycle.State.STARTED)) {
                    registry.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
                }
            } catch (_: Exception) {
                // Lifecycle may already be torn down.
            }
        }
        (view.parent as? ViewGroup)?.removeView(view)
        try {
            view.lifecycle = null
        } catch (_: Exception) {
            // Lifecycle may already be cleared.
        }
        arLifecycleOwner = null
        try {
            view.destroy()
        } catch (_: Exception) {
            // View may be partially constructed.
        }
    }

    private fun stylePlaneRenderer(sceneView: ARSceneView) {
        sceneView.planeRenderer.isEnabled = true
        sceneView.planeRenderer.isVisible = true
        try {
            val assets = materialLoader?.assets ?: activity.assets
            val texture = planeGridTexture ?: ImageTexture.Builder()
                .bitmap(assets, PLANE_GRID_ASSET)
                .build(sceneView.engine)
                .also { planeGridTexture = it }
            sceneView.planeRenderer.planeMaterial.defaultInstance.apply {
                setTexture(PlaneRenderer.MATERIAL_TEXTURE, texture)
                setParameter(
                    PlaneRenderer.MATERIAL_COLOR,
                    Float3(253f / 255f, 184f / 255f, 19f / 255f),
                )
                setParameter(
                    PlaneRenderer.MATERIAL_UV_SCALE,
                    Float2(PLANE_GRID_UV_SCALE, PLANE_GRID_UV_SCALE),
                )
            }
            // Start modest; bloom when a real plane exists (or on Reposition).
            applyPlaneSpotlightRadius(sceneView, PLANE_SPOTLIGHT_START)
            if (planeVisualReady) {
                startPlaneReveal(sceneView)
            }
        } catch (ex: Exception) {
            Logger.error("NativeAr plane grid style failed", ex)
        }
    }

    private fun applyPlaneSpotlightRadius(sceneView: ARSceneView, radius: Float) {
        planeSpotlightRadius = radius
        try {
            sceneView.planeRenderer.planeMaterial.defaultInstance.setParameter(
                PlaneRenderer.MATERIAL_SPOTLIGHT_RADIUS,
                radius,
            )
        } catch (ex: Exception) {
            Logger.error("NativeAr plane spotlight update failed", ex)
        }
    }

    private fun startPlaneReveal(sceneView: ARSceneView) {
        cancelPlaneReveal()
        if (reducedMotion) {
            applyPlaneSpotlightRadius(sceneView, PLANE_SPOTLIGHT_SETTLED)
            return
        }
        applyPlaneSpotlightRadius(sceneView, PLANE_SPOTLIGHT_START)
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = PLANE_REVEAL_MS
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener {
                val t = easeOutCubic(animatedFraction)
                val radius = lerp(PLANE_SPOTLIGHT_START, PLANE_SPOTLIGHT_SETTLED, t)
                applyPlaneSpotlightRadius(sceneView, radius)
            }
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                if (planeRevealAnimator !== animator) return
                planeRevealAnimator = null
                applyPlaneSpotlightRadius(sceneView, PLANE_SPOTLIGHT_SETTLED)
                startPlaneBreath(sceneView)
            }

            override fun onAnimationCancel(animation: Animator) {
                if (planeRevealAnimator !== animator) return
                planeRevealAnimator = null
            }
        })
        planeRevealAnimator = animator
        animator.start()
    }

    private fun startPlaneBreath(sceneView: ARSceneView) {
        cancelPlaneBreath()
        if (reducedMotion || placed) return
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = PLANE_BREATH_MS
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener {
                // Soft sine pulse ±8% around settled radius.
                val phase = (animatedFraction * (Math.PI * 2.0)).toFloat()
                val pulse = 1f + PLANE_BREATH_AMPLITUDE * kotlin.math.sin(phase)
                applyPlaneSpotlightRadius(sceneView, PLANE_SPOTLIGHT_SETTLED * pulse)
            }
        }
        planeBreathAnimator = animator
        animator.start()
    }

    private fun cancelPlaneBreath() {
        val animator = planeBreathAnimator
        planeBreathAnimator = null
        animator?.cancel()
    }

    private fun cancelPlaneReveal() {
        cancelPlaneBreath()
        val animator = planeRevealAnimator
        planeRevealAnimator = null
        animator?.cancel()
    }

    private fun destroyPlaneGridTexture(engine: com.google.android.filament.Engine? = arSceneView?.engine) {
        val texture = planeGridTexture ?: return
        planeGridTexture = null
        if (engine != null) {
            engine.safeDestroyTexture(texture)
        }
    }

    private fun updateFeaturePointHud(frame: Frame, hud: FeaturePointHudView) {
        val w = hud.width.toFloat()
        val h = hud.height.toFloat()
        if (w <= 0f || h <= 0f) return
        hud.dimmed = placed

        val camera = frame.camera
        if (camera.trackingState != TrackingState.TRACKING) {
            hud.setScreenPoints(hudScratch, 0, 0)
            return
        }

        camera.getViewMatrix(hudViewMtx, 0)
        camera.getProjectionMatrix(hudProjMtx, 0, 0.1f, 100f)
        Matrix.multiplyMM(hudVpMtx, 0, hudProjMtx, 0, hudViewMtx, 0)

        var cloud: PointCloud? = null
        try {
            cloud = frame.acquirePointCloud()
            val buf = cloud.points
            val pos = buf.position()
            val total = buf.remaining() / 4
            if (total <= 0) {
                hud.setScreenPoints(hudScratch, 0, 0)
                return
            }
            val max = FeaturePointHudView.MAX_POINTS
            val stride = if (total <= max) 1 else total / max
            var i = 0
            var drawn = 0
            while (i < total && drawn < max) {
                val base = pos + i * 4
                if (buf.get(base + 3) >= FeaturePointHudView.MIN_CONFIDENCE) {
                    hudWorld[0] = buf.get(base)
                    hudWorld[1] = buf.get(base + 1)
                    hudWorld[2] = buf.get(base + 2)
                    hudWorld[3] = 1f
                    Matrix.multiplyMV(hudClip, 0, hudVpMtx, 0, hudWorld, 0)
                    val cw = hudClip[3]
                    if (cw > 0.0001f) {
                        val ndcX = hudClip[0] / cw
                        val ndcY = hudClip[1] / cw
                        if (ndcX >= -1f && ndcX <= 1f && ndcY >= -1f && ndcY <= 1f) {
                            hudScratch[drawn * 2] = (ndcX + 1f) * 0.5f * w
                            hudScratch[drawn * 2 + 1] = (1f - ndcY) * 0.5f * h
                            drawn++
                        }
                    }
                }
                i += stride
            }
            hud.setScreenPoints(hudScratch, drawn, drawn)
        } catch (_: Exception) {
            // Skip this frame; point cloud is not always available.
        } finally {
            try {
                cloud?.release()
            } catch (_: Exception) {
                // Already released.
            }
        }
    }

    private fun updateDepthPeek(frame: Frame, peek: DepthPeekView) {
        if (depthModeResolved && !depthModeActive) {
            if (!depthPeekHidden) {
                depthPeekHidden = true
                peek.post { peek.visibility = View.GONE }
            }
            return
        }
        if (!depthModeActive) return
        peek.dimmed = placed
        if (placed) {
            peek.postInvalidateOnAnimation()
            return
        }
        depthPeekTick += 1
        if (depthPeekTick % DepthPeekView.FRAME_STRIDE != 0) return

        try {
            frame.acquireDepthImage16Bits().use { image ->
                val w = image.width
                val h = image.height
                if (w <= 0 || h <= 0) return
                val plane = image.planes[0]
                val buf = plane.buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
                val rowStride = plane.rowStride
                val pixelStride = plane.pixelStride
                if (pixelStride <= 0 || rowStride <= 0) return
                val step = if (max(w, h) > 160) 2 else 1
                val outW = w / step
                val outH = h / step
                if (outW <= 0 || outH <= 0) return
                val needed = outW * outH
                val pixels = depthPeekPixels?.takeIf { it.size == needed }
                    ?: IntArray(needed).also { depthPeekPixels = it }
                var i = 0
                for (y in 0 until outH) {
                    val row = y * step * rowStride
                    for (x in 0 until outW) {
                        val idx = row + x * step * pixelStride
                        val mm = if (idx + 1 < buf.limit()) {
                            buf.getShort(idx).toInt() and 0xFFFF
                        } else {
                            0
                        }
                        pixels[i++] = DepthPeekView.colorForMm(mm)
                    }
                }
                // Depth is lower-res than the camera; normalized corners still map to the view.
                depthImageCorners[0] = 0f
                depthImageCorners[1] = 0f
                depthImageCorners[2] = 1f
                depthImageCorners[3] = 0f
                depthImageCorners[4] = 1f
                depthImageCorners[5] = 1f
                depthImageCorners[6] = 0f
                depthImageCorners[7] = 1f
                var corners: FloatArray? = depthViewCorners
                try {
                    frame.transformCoordinates2d(
                        Coordinates2d.IMAGE_NORMALIZED,
                        depthImageCorners,
                        Coordinates2d.VIEW,
                        depthViewCorners,
                    )
                } catch (_: Exception) {
                    corners = null
                }
                peek.setHeatmap(pixels, outW, outH, corners)
            }
        } catch (_: Exception) {
            // NotYetAvailable / unsupported this frame — keep last heatmap.
        }
    }

    private fun updateSurfaceProbe(sceneView: ARSceneView, frame: com.google.ar.core.Frame) {
        if (placed) return
        // Instant Placement: unlock tap as soon as the camera tracks — no plane wait.
        if (!surfaceFound && frame.camera.trackingState == TrackingState.TRACKING) {
            surfaceFound = true
            notifyTracking("ready", "Tap to place a fossil")
        }
        if (planeVisualReady) return
        val candidates = sceneView.session?.getAllTrackables(Plane::class.java)
            ?: frame.getUpdatedTrackables(Plane::class.java)
        val plane = candidates.firstOrNull { candidate ->
            candidate.trackingState == TrackingState.TRACKING &&
                (candidate.type == Plane.Type.HORIZONTAL_UPWARD_FACING ||
                    candidate.type == Plane.Type.HORIZONTAL_DOWNWARD_FACING)
        } ?: return
        planeVisualReady = true
        startPlaneReveal(sceneView)
    }

    private fun isHorizontalPlaneHit(hit: HitResult): Boolean {
        val trackable = hit.trackable
        // Drop isPoseInPolygon so extent-edge taps still place on the plane.
        return trackable is Plane &&
            trackable.trackingState == TrackingState.TRACKING &&
            (trackable.type == Plane.Type.HORIZONTAL_UPWARD_FACING ||
                trackable.type == Plane.Type.HORIZONTAL_DOWNWARD_FACING)
    }

    private fun hitAt(sceneView: ARSceneView, x: Float, y: Float): HitResult? {
        val frame = sceneView.frame ?: return null
        val hits = frame.hitTest(x, y)
        hits.firstOrNull(::isHorizontalPlaneHit)?.let { return it }
        // Fallback: any TRACKING Plane hit if typed filter missed.
        hits.firstOrNull { hit ->
            val trackable = hit.trackable
            trackable is Plane && trackable.trackingState == TrackingState.TRACKING
        }?.let { return it }
        // Instant Placement: place before a mature plane exists (~1 m table distance).
        return try {
            frame.hitTestInstantPlacement(x, y, INSTANT_PLACEMENT_DISTANCE_M)
                .firstOrNull { hit ->
                    val trackable = hit.trackable
                    trackable is InstantPlacementPoint &&
                        trackable.trackingState == TrackingState.TRACKING
                }
        } catch (_: Exception) {
            null
        }
    }

    private fun placeModelAtScreen(x: Float, y: Float, sceneView: ARSceneView?): JSObject {
        val out = JSObject()
        if (sceneView == null) {
            out.put("placed", false)
            out.put("error", "no-scene")
            return out
        }
        if (placed) {
            out.put("placed", false)
            out.put("error", "already-placed")
            return out
        }
        if (loadedModelInstance == null) {
            out.put("placed", false)
            out.put("error", "no-model")
            return out
        }
        val hit = hitAt(sceneView, x, y)
        if (hit == null) {
            out.put("placed", false)
            out.put("error", "no-hit")
            return out
        }
        val instance = loadedModelInstance!!
        val node = obtainModelNode(instance, forceMatte = false)
        val pose = hit.hitPose
        val newAnchor = AnchorNode(sceneView.engine, hit.createAnchor())
        newAnchor.addChildNode(node)
        sceneView.addChildNode(newAnchor)
        anchorNode = newAnchor
        placed = true
        cancelPlaneReveal()
        sceneView.planeRenderer.isVisible = false
        sceneView.planeRenderer.isEnabled = false
        // Face after emerge starts — zero/near-zero scale can NaN world matrices.
        startEmergence()
        faceCamera()
        notifyListeners("placed", JSObject())

        out.put("placed", true)
        out.put("error", JSONObject.NULL)
        out.put("hitX", safeJsonNum(pose.tx().toDouble()))
        out.put("hitY", safeJsonNum(pose.ty().toDouble()))
        out.put("hitZ", safeJsonNum(pose.tz().toDouble()))
        out.put("intro", safeJsonNum(introMultiplier.toDouble()))
        val sc = node.scale
        out.put("scaleX", safeJsonNum(sc.x.toDouble()))
        out.put("localY", safeJsonNum(node.position.y.toDouble()))
        out.put("worldY", safeJsonNum(node.worldPosition.y.toDouble()))
        return out
    }

    private fun obtainModelNode(instance: ModelInstance, forceMatte: Boolean): ModelNode {
        // SceneView 2.3.0 centerOrigin does `position += origin * size` and does
        // NOT subtract the model centre. KDoc "y = -1 → bottom aligned" is wrong
        // for that build: y = -1 sinks a centered mesh a full height under the
        // plane. y = 0.5 lifts the centre so the AABB bottom sits on the anchor
        // (after normalize-ar-glb.mjs centres the GLB). Guard against non-finite
        // size (bad bbox) which would NaN position and crash org.json + hide mesh.
        val node = modelNode ?: ModelNode(
            modelInstance = instance,
            scaleToUnits = MODEL_SIZE_METERS,
            centerOrigin = null,
            autoAnimate = false,
        ).also {
            val sizeY = it.size.y
            it.position = if (sizeY.isFinite() && sizeY > 0f) {
                Position(y = sizeY * 0.5f)
            } else {
                Position(y = MODEL_SIZE_METERS * 0.5f)
            }
            modelRestY = it.position.y
            modelNode = it
            modelBaseScale = it.scale
        }
        // Keep each GLB's own materials (Kenney baseColorFactors, duck maps, etc.).
        // normalize-ar-glb.mjs already softens metal/roughness for Filament without IBL.
        // Bone matte is debug-only (`demetalize`) so QA can force a flat tint.
        if (forceMatte && !matteApplied) {
            materialLoader?.let { loader ->
                node.setMaterialInstance(
                    loader.createColorInstance(
                        SceneColor(0.85f, 0.79f, 0.64f, 1f),
                        metallic = 0f,
                        roughness = 0.8f,
                        reflectance = 0.35f,
                    ),
                )
                matteApplied = true
            }
        }
        return node
    }

    private fun placeModelInFrontOfCamera(withCube: Boolean, forceMatte: Boolean): JSObject {
        val sceneView = arSceneView
        val instance = loadedModelInstance
        val frame = sceneView?.frame
        val camera = frame?.camera
        val out = JSObject()
        if (sceneView == null || instance == null || frame == null || camera == null) {
            out.put("placed", false)
            out.put("error", "no-session")
            return out
        }
        if (camera.trackingState != TrackingState.TRACKING) {
            out.put("placed", false)
            out.put("error", "not-tracking")
            out.put("tracking", camera.trackingState.name)
            return out
        }

        clearPlacement(keepModel = true)
        removeDebugMarker()

        val camPose = camera.pose
        val localForward = floatArrayOf(0f, 0f, -0.55f)
        val world = FloatArray(3)
        camPose.transformPoint(localForward, 0, world, 0)
        val anchorPose = Pose(world, floatArrayOf(0f, 0f, 0f, 1f))
        val session = sceneView.session
        if (session == null) {
            out.put("placed", false)
            out.put("error", "no-session-obj")
            return out
        }
        val anchor = session.createAnchor(anchorPose)
        val newAnchor = AnchorNode(sceneView.engine, anchor)

        val node = obtainModelNode(instance, forceMatte)
        newAnchor.addChildNode(node)

        var cubePlaced = false
        if (withCube) {
            val loader = materialLoader
            if (loader != null) {
                val marker = CubeNode(
                    engine = sceneView.engine,
                    size = Size(0.08f, 0.08f, 0.08f),
                    materialInstance = loader.createColorInstance(
                        SceneColor(0.89f, 0.44f, 0.13f, 1f),
                        metallic = 0f,
                        roughness = 0.75f,
                        reflectance = 0.4f,
                    ),
                )
                marker.position = Position(x = 0.16f, y = 0.04f, z = 0f)
                newAnchor.addChildNode(marker)
                debugMarkerNode = marker
                cubePlaced = true
            }
        }

        sceneView.addChildNode(newAnchor)
        anchorNode = newAnchor
        placed = true
        cancelPlaneReveal()
        sceneView.planeRenderer.isVisible = false
        sceneView.planeRenderer.isEnabled = false
        // Same post-place path as table tap (emerge + snapshot). This is the
        // path that previously crashed on JSON NaN when intro scaled to 0.
        startEmergence()
        faceCamera()
        notifyListeners("placed", JSObject())

        val base = modelBaseScale
        out.put("placed", true)
        out.put("textured", modelHasBaseColorTexture)
        out.put("matte", matteApplied)
        out.put("cube", cubePlaced)
        out.put("modelSizeM", MODEL_SIZE_METERS.toDouble())
        out.put("scaleFactor", safeJsonNum(scaleFactor.toDouble()))
        out.put("intro", safeJsonNum(introMultiplier.toDouble()))
        out.put("localY", safeJsonNum(node.position.y.toDouble()))
        out.put("worldY", safeJsonNum(node.worldPosition.y.toDouble()))
        if (base != null) {
            out.put("baseScaleX", safeJsonNum(base.x.toDouble()))
            out.put("baseScaleY", safeJsonNum(base.y.toDouble()))
            out.put("baseScaleZ", safeJsonNum(base.z.toDouble()))
        }
        out.put("tracking", camera.trackingState.name)
        return out
    }

    private fun removeDebugMarker() {
        val marker = debugMarkerNode ?: return
        try {
            marker.parent?.removeChildNode(marker)
        } catch (_: Exception) {
            // Already detached.
        }
        debugMarkerNode = null
    }

    private fun moveModelAtScreen(x: Float, y: Float, sceneView: ARSceneView): Boolean {
        if (!placed || emergeAnimator != null) return false
        val node = modelNode ?: return false
        val hit = hitAt(sceneView, x, y) ?: return false
        anchorNode?.let { oldAnchor ->
            oldAnchor.removeChildNode(node)
            oldAnchor.destroy()
        }
        val newAnchor = AnchorNode(sceneView.engine, hit.createAnchor())
        newAnchor.addChildNode(node)
        sceneView.addChildNode(newAnchor)
        anchorNode = newAnchor
        return true
    }

    private fun startEmergence() {
        cancelEmergence()
        val node = modelNode
        if (node != null && modelRestY == 0f) {
            modelRestY = node.position.y
        }
        if (reducedMotion) {
            introMultiplier = 1f
            applyModelPose()
            return
        }
        // Never scale to exact 0 — Filament/SceneView world matrices can NaN,
        // which crashed debug JSON and left the skull invisible after place.
        introMultiplier = EMERGE_FLOOR
        applyModelPose(elapsedMs = 0f)
        spawnContactRipple()
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = EMERGE_DURATION_MS
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener {
                val elapsed = currentPlayTime.toFloat().coerceAtMost(EMERGE_DURATION_MS.toFloat())
                introMultiplier = emergeIntroAt(elapsed)
                applyModelPose(elapsed)
            }
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                if (emergeAnimator !== animator) return
                emergeAnimator = null
                introMultiplier = 1f
                displayedScale = scaleFactor
                applyModelPose(elapsedMs = EMERGE_DURATION_MS.toFloat())
            }
        })
        emergeAnimator = animator
        animator.start()
    }

    private fun cancelEmergence() {
        val animator = emergeAnimator
        emergeAnimator = null
        animator?.cancel()
        introMultiplier = 1f
        cancelScaleSmoothing()
        displayedScale = scaleFactor
        clearRipple()
    }

    private fun easeOutBack(t: Float): Float {
        val c1 = 2.2f
        val c3 = c1 + 1f
        val u = t - 1f
        return 1f + c3 * u * u * u + c1 * u * u
    }

    private fun easeOutCubic(t: Float): Float {
        val u = 1f - t
        return 1f - u * u * u
    }

    private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

    private fun jiggleIntro(t: Float): Float {
        val u = min(1f, max(0f, t))
        // (t, v) pairs: 1.18 → 0.94 → 1.06 → 1.0
        val ts = floatArrayOf(0f, 0.35f, 0.7f, 1f)
        val vs = floatArrayOf(EMERGE_OVERSHOOT, 0.94f, 1.06f, 1f)
        for (i in 0 until ts.lastIndex) {
            if (u <= ts[i + 1]) {
                val local = (u - ts[i]) / (ts[i + 1] - ts[i]).coerceAtLeast(0.0001f)
                return lerp(vs[i], vs[i + 1], easeOutCubic(local))
            }
        }
        return 1f
    }

    private fun emergeIntroAt(elapsedMs: Float): Float {
        if (elapsedMs <= 0f) return EMERGE_FLOOR
        if (elapsedMs < EMERGE_RISE_MS) {
            val t = elapsedMs / EMERGE_RISE_MS
            return max(EMERGE_FLOOR, EMERGE_OVERSHOOT * easeOutBack(t))
        }
        val jiggleT = min(1f, (elapsedMs - EMERGE_RISE_MS) / EMERGE_JIGGLE_MS)
        return jiggleIntro(jiggleT)
    }

    private fun emergeRiseOffset(elapsedMs: Float): Float {
        if (elapsedMs >= EMERGE_RISE_MS) return 0f
        val t = min(1f, max(0f, elapsedMs / EMERGE_RISE_MS))
        return EMERGE_START_Y * (1f - easeOutBack(t))
    }

    private fun applyModelPose(elapsedMs: Float = EMERGE_DURATION_MS.toFloat()) {
        applyModelScale()
        val node = modelNode ?: return
        val pos = node.position
        node.position = Position(
            x = pos.x,
            y = modelRestY + emergeRiseOffset(elapsedMs),
            z = pos.z,
        )
    }

    private var scaleApplyLogTick = 0

    private fun applyModelScale() {
        val node = modelNode ?: return
        val base = modelBaseScale ?: return
        val multiplier = displayedScale * introMultiplier
        val sx = base.x * multiplier
        val sy = base.y * multiplier
        val sz = base.z * multiplier
        // #region agent log
        scaleApplyLogTick += 1
        if (scaleApplyLogTick % 4 == 1 ||
            !sx.isFinite() || !sy.isFinite() || !sz.isFinite() ||
            kotlin.math.abs(sx) < 0.01f
        ) {
            Logger.info(
                "DBG_a996cb",
                "native_scale_apply|" +
                    "tick=$scaleApplyLogTick|" +
                    "baseBefore=${base.x},${base.y},${base.z}|" +
                    "displayed=$displayedScale|intro=$introMultiplier|mult=$multiplier|" +
                    "write=$sx,$sy,$sz|" +
                    "baseId=${System.identityHashCode(base)}|" +
                    "nodeScaleId=${System.identityHashCode(node.scale)}|" +
                    "sameRef=${base === node.scale}|" +
                    "finite=${sx.isFinite() && sy.isFinite() && sz.isFinite()}",
            )
        }
        // #endregion
        node.scale = Scale(sx, sy, sz)
        // #region agent log
        if (scaleApplyLogTick % 4 == 1 || kotlin.math.abs(base.x - sx) > 0.0001f && base === node.scale) {
            Logger.info(
                "DBG_a996cb",
                "native_scale_after|" +
                    "baseAfter=${base.x},${base.y},${base.z}|" +
                    "nodeAfter=${node.scale.x},${node.scale.y},${node.scale.z}|" +
                    "baseMutated=${kotlin.math.abs(base.x - (sx / multiplier.coerceAtLeast(1e-6f))) > 0.001f}|" +
                    "sameRefAfter=${base === node.scale}",
            )
        }
        // #endregion
    }

    private fun ensureScaleSmoothing() {
        cancelScaleSmoothing()
        val from = displayedScale
        val to = scaleFactor
        if (kotlin.math.abs(to - from) < 0.0008f) {
            displayedScale = to
            applyModelScale()
            return
        }
        // Finite ease-out retarget — no infinite per-frame Scale writes (SceneView-safe).
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 180L
            interpolator = android.view.animation.PathInterpolator(0.22f, 1f, 0.36f, 1f)
            addUpdateListener {
                val t = it.animatedValue as Float
                displayedScale = from + (to - from) * t
                applyModelScale()
            }
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                if (scaleAnimator !== animator) return
                displayedScale = scaleFactor
                applyModelScale()
                scaleAnimator = null
                // #region agent log
                Logger.info(
                    "DBG_a996cb",
                    "native_scale_settle|displayed=$displayedScale|target=$scaleFactor|intro=$introMultiplier",
                )
                // #endregion
            }

            override fun onAnimationCancel(animation: Animator) {
                if (scaleAnimator === animator) scaleAnimator = null
            }
        })
        scaleAnimator = animator
        animator.start()
    }

    private fun cancelScaleSmoothing() {
        scaleAnimator?.cancel()
        scaleAnimator = null
    }

    private fun rippleScale(t: Float): Float {
        val eased = easeOutCubic(min(1f, max(0f, t)))
        return EMERGE_RING_SCALE_FROM +
            (EMERGE_RING_SCALE_TO - EMERGE_RING_SCALE_FROM) * eased
    }

    private fun obtainSoftRingBitmap(): Bitmap {
        softRingBitmap?.let { return it }
        val size = EMERGE_RING_BITMAP_SIZE
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        bmp.eraseColor(Color.TRANSPARENT)
        val canvas = Canvas(bmp)
        val cx = size * 0.5f
        val cy = size * 0.5f
        val midR = size * 0.43f
        val band = size * 0.045f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
        }
        // Soft falloff via stacked strokes — peak alpha mid-band, white for tinting.
        val layers = 10
        for (i in 0 until layers) {
            val t = i / (layers - 1f)
            val r = midR - band * 0.5f + band * t
            val falloff = sin(t * PI.toFloat()).coerceIn(0f, 1f)
            paint.strokeWidth = (band / layers) * 2.2f
            paint.color = Color.argb((falloff * 255f).toInt().coerceIn(0, 255), 255, 255, 255)
            canvas.drawCircle(cx, cy, r, paint)
        }
        softRingBitmap = bmp
        return bmp
    }

    /**
     * ImageNode uses image_texture.filamat (sampler only — no "color" uniform).
     * Baking tint+alpha into pixels; setColor() on that material SIGABRTs Filament.
     */
    private fun tintedSoftRingBitmap(rgba: FloatArray, alphaScale: Float): Bitmap {
        val src = obtainSoftRingBitmap()
        val out = src.copy(Bitmap.Config.ARGB_8888, true)
        val aScale = alphaScale.coerceIn(0f, 1f)
        val r = (rgba[0].coerceIn(0f, 1f) * 255f).toInt()
        val g = (rgba[1].coerceIn(0f, 1f) * 255f).toInt()
        val b = (rgba[2].coerceIn(0f, 1f) * 255f).toInt()
        val peakA = rgba[3].coerceIn(0f, 1f)
        val w = out.width
        val h = out.height
        val pixels = IntArray(w * h)
        out.getPixels(pixels, 0, w, 0, 0, w, h)
        for (i in pixels.indices) {
            val srcA = (pixels[i] ushr 24) and 0xff
            if (srcA == 0) continue
            val a = (srcA * peakA * aScale).toInt().coerceIn(0, 255)
            pixels[i] = (a shl 24) or (r shl 16) or (g shl 8) or b
        }
        out.setPixels(pixels, 0, w, 0, 0, w, h)
        return out
    }

    private fun spawnContactRipple() {
        clearRipple()
        if (reducedMotion) return
        if (arSceneView == null) return
        val anchor = anchorNode ?: return
        val loader = materialLoader ?: return

        // Brand: pin gold → orange → cream (baked into bitmap — ImageNode has no color uniform)
        val tints = listOf(
            floatArrayOf(0.992f, 0.722f, 0.075f, 0.55f),
            floatArrayOf(0.886f, 0.443f, 0.129f, 0.40f),
            floatArrayOf(0.925f, 0.910f, 0.765f, 0.28f),
        )
        val rings = ArrayList<ImageNode>(tints.size)
        tints.forEachIndexed { index, rgba ->
            val ring = ImageNode(
                materialLoader = loader,
                bitmap = tintedSoftRingBitmap(rgba, alphaScale = 1f),
                size = Size(EMERGE_RING_PLANE_M, EMERGE_RING_PLANE_M),
                center = Position(y = 0.002f),
                normal = Direction(y = 1f),
            )
            val s0 = EMERGE_RING_SCALE_FROM
            ring.scale = Scale(s0, s0, s0)
            ring.isVisible = index == 0
            anchor.addChildNode(ring)
            rings.add(ring)
        }
        rippleNodes = rings

        val totalMs = EMERGE_RING_MS + EMERGE_RING_STAGGER_MS * (tints.size - 1)
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = totalMs
            interpolator = android.view.animation.LinearInterpolator()
            addUpdateListener {
                val elapsed = currentPlayTime.toFloat()
                var allDone = true
                rings.forEachIndexed { i, ring ->
                    val local = elapsed - i * EMERGE_RING_STAGGER_MS
                    if (local < 0f) {
                        ring.isVisible = false
                        allDone = false
                        return@forEachIndexed
                    }
                    val t = min(1f, local / EMERGE_RING_MS)
                    // Soft alpha is baked into the bitmap; animate scale only
                    // (image_texture has no color/opacity uniform).
                    ring.isVisible = true
                    val s = rippleScale(t)
                    ring.scale = Scale(s, s, s)
                    if (t < 1f) allDone = false
                }
                if (allDone) {
                    clearRipple()
                }
            }
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                if (rippleAnimator !== animator) return
                clearRipple()
            }
        })
        rippleAnimator = animator
        animator.start()
    }

    private fun clearRipple() {
        val animator = rippleAnimator
        rippleAnimator = null
        animator?.cancel()
        // SceneView 2.3.0 ImageNode.destroy() frees the entity before unlinking the
        // renderable → Filament SIGABRT: "Invalid texture still bound to
        // MaterialInstance: 'Transparent Textured'". Detach only; engine teardown
        // via safeDestroySceneView owns the remaining Filament resources.
        for (ring in rippleNodes) {
            try {
                ring.isVisible = false
                ring.parent?.removeChildNode(ring)
            } catch (_: Exception) {
                // Already detached.
            }
        }
        rippleNodes.clear()
    }

    /**
     * Point the skull toward the camera.
     *
     * @param alignViewpoint when true (Recentre), aim +Z at the camera with
     *   pitch+yaw (no roll) so the face squares with the user's view. When
     *   false (post-place), yaw-only + level so emerge yaw animation stays
     *   stable. Camera is converted into the plane-anchor's local space so
     *   hit-pose yaw is correct. Clears any drag pitch/yaw.
     */
    private fun faceCamera(alignViewpoint: Boolean = false) {
        val view = arSceneView ?: return
        val node = modelNode?.takeIf { placed } ?: return
        val camera = view.cameraNode.worldPosition
        val model = node.worldPosition
        if (!camera.x.isFinite() || !camera.y.isFinite() || !camera.z.isFinite() ||
            !model.x.isFinite() || !model.y.isFinite() || !model.z.isFinite()
        ) {
            return
        }

        val parent = node.parent
        val localCam = parent?.getLocalPosition(camera) ?: camera
        val pos = node.position
        val localDx = localCam.x - pos.x
        val localDy = localCam.y - pos.y
        val localDz = localCam.z - pos.z
        if (!localDx.isFinite() || !localDy.isFinite() || !localDz.isFinite()) return

        val horiz = sqrt(localDx * localDx + localDz * localDz)
        if (horiz < 1e-5f) return

        val yawDeg = Math.toDegrees(atan2(localDx.toDouble(), localDz.toDouble())).toFloat()
        if (!yawDeg.isFinite()) return

        if (!alignViewpoint) {
            node.rotation = Rotation(0f, yawDeg, 0f)
            return
        }

        // Full viewpoint align: tip toward camera, no roll.
        val pitchDeg = (-Math.toDegrees(atan2(localDy.toDouble(), horiz.toDouble()))).toFloat()
            .coerceIn(-40f, 40f)
        if (!pitchDeg.isFinite()) {
            node.rotation = Rotation(0f, yawDeg, 0f)
            return
        }
        node.rotation = Rotation(pitchDeg, yawDeg, 0f)
    }

    private fun clearPlacement(keepModel: Boolean) {
        cancelEmergence()
        removeDebugMarker()
        val node = modelNode
        anchorNode?.let { anchor ->
            if (node != null) anchor.removeChildNode(node)
            anchor.destroy()
        }
        anchorNode = null
        placed = false
        if (!keepModel) {
            modelNode = null
            modelBaseScale = null
            modelRestY = 0f
            matteApplied = false
        } else {
            applyModelPose()
        }
    }

    private fun scheduleSessionWatchdog() {
        cancelSessionWatchdog()
        val watchdog = Runnable {
            sessionWatchdog = null
            if (!sessionFrameReceived && arSceneView != null) {
                Logger.error("NativeAr session timed out — no frames received")
                notifyTracking("unavailable", "Camera session timed out")
                detachArView()
                notifySessionEnded()
            }
        }
        sessionWatchdog = watchdog
        mainHandler.postDelayed(watchdog, SESSION_START_TIMEOUT_MS)
    }

    private fun cancelSessionWatchdog() {
        sessionWatchdog?.let { mainHandler.removeCallbacks(it) }
        sessionWatchdog = null
    }

    private fun detachArView() {
        cancelSessionWatchdog()
        sessionFrameReceived = false
        attachCompleted = false
        stopImuWarmup()
        cancelPlaneReveal()
        cancelScaleSmoothing()
        clearPlacement(keepModel = false)
        loadedModelInstance = null
        featurePointHudView?.let { hud ->
            (hud.parent as? ViewGroup)?.removeView(hud)
        }
        featurePointHudView = null
        depthPeekView?.let { peek ->
            (peek.parent as? ViewGroup)?.removeView(peek)
            peek.release()
        }
        depthPeekView = null
        depthPeekPixels = null
        depthModeActive = false
        depthModeResolved = false
        depthPeekTick = 0
        depthPeekHidden = false
        arSceneView?.let { view ->
            destroyPlaneGridTexture(view.engine)
            safeDestroySceneView(view)
            arSceneView = null
        }
        materialLoader = null
        softRingBitmap?.recycle()
        softRingBitmap = null
        surfaceFound = false
        planeVisualReady = false
        lastTrackingKey = null
        arLifecycleOwner = null

        val webView = bridge.webView
        webView.setBackgroundColor(Color.parseColor("#0d1117"))
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
    }

    private fun formatError(ex: Throwable): String {
        val parts = mutableListOf<String>()
        var current: Throwable? = ex
        var depth = 0
        while (current != null && depth < 4) {
            val detail = current.localizedMessage
                ?.takeIf { it.isNotBlank() && !it.equals("null", ignoreCase = true) }
            parts += if (detail != null) {
                "${current.javaClass.simpleName}: $detail"
            } else {
                current.javaClass.simpleName
            }
            current = current.cause
            depth++
        }
        return parts.joinToString(" ← ")
    }

    private fun notifyTracking(state: String, message: String? = null) {
        val key = "$state\u0000${message.orEmpty()}"
        if (key == lastTrackingKey) return
        lastTrackingKey = key
        notifyListeners("trackingChanged", JSObject().apply {
            put("state", state)
            if (message != null) put("message", message)
        })
    }

    private fun notifySessionEnded() {
        notifyListeners("sessionEnded", JSObject())
    }

    override fun handleOnPause() {
        super.handleOnPause()
        val registry = arLifecycleOwner?.registry
        if (registry != null && registry.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
            try {
                registry.handleLifecycleEvent(Lifecycle.Event.ON_PAUSE)
            } catch (_: Exception) {
                // Ignore lifecycle races.
            }
        }
    }

    override fun handleOnResume() {
        super.handleOnResume()
        pendingStartCall?.let { ensureArCoreAndBeginSession(it) }
        val view = arSceneView ?: return
        val registry = arLifecycleOwner?.registry
        if (registry != null &&
            registry.currentState.isAtLeast(Lifecycle.State.STARTED) &&
            !registry.currentState.isAtLeast(Lifecycle.State.RESUMED)
        ) {
            try {
                registry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
            } catch (ex: Exception) {
                Logger.error("NativeAr lifecycle resume failed", ex)
            }
        } else {
            try {
                view.arCore.resume(activity, null)
            } catch (ex: Exception) {
                Logger.error("NativeAr resume failed", ex)
            }
        }
    }

    override fun handleOnDestroy() {
        pendingStartCall = null
        detachArView()
        super.handleOnDestroy()
    }
}
