import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  EMERGE_RING_MS,
  EMERGE_RING_OPACITIES,
  EMERGE_RING_STAGGER_MS,
  EMERGE_TOTAL_MS,
  REDUCE_MS,
  easeOutCubic,
  emergeIntroAt,
  emergeRiseY,
  rippleFade,
  rippleScale,
} from "./emergeMotion";

export type WebXrViewerHandle = {
  rotate: (dx: number, dy: number) => void;
  setScale: (factor: number) => void;
  moveScreen: (nx: number, ny: number) => void;
  placeAtScreen: (nx: number, ny: number) => Promise<boolean>;
  recenter: () => void;
  reposition: () => void;
  setModel: (modelUrl: string) => Promise<void>;
  dispose: () => Promise<void>;
};

const HIT_WAIT_FRAMES = 45;
const RIPPLE_COLORS = [0xfdb813, 0xe27121, 0xece8c3] as const;

function matrixFromXrPose(pose: XRPose, target: THREE.Matrix4): void {
  target.fromArray(pose.transform.matrix);
}

/** Viewer-space ray for overlay-normalized coords (y down, 0–1). */
function offsetRayFromNorm(
  nx: number,
  ny: number,
  aspect: number,
  fovYRad: number,
): XRRay {
  const ndcX = nx * 2 - 1;
  const ndcY = -(ny * 2 - 1);
  const tanY = Math.tan(fovYRad / 2);
  const tanX = tanY * aspect;
  let dx = ndcX * tanX;
  let dy = ndcY * tanY;
  let dz = -1;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;
  return new XRRay(
    { x: 0, y: 0, z: 0, w: 1 },
    { x: dx, y: dy, z: dz, w: 0 },
  );
}

function hitKey(nx: number, ny: number): string {
  return `${nx.toFixed(3)},${ny.toFixed(3)}`;
}

export function createWebXrViewer(
  host: HTMLElement,
  session: XRSession,
  modelUrl: string,
  options: {
    reducedMotion?: boolean;
    onSurfaceReady?: () => void;
    onPlaced?: () => void;
    onError?: (message: string) => void;
    onSessionEnd?: () => void;
  } = {},
): WebXrViewerHandle {
  const reducedMotion = options.reducedMotion === true;
  let cancelled = false;
  let placed = false;
  let emerging = false;
  let emergeStart = 0;
  let introMul = 0;
  let fitScale = 1;
  let userScale = 1;
  let displayedScale = 1;
  let surfaceNotified = false;
  let wantMoveApply = false;

  let refSpace: XRReferenceSpace | null = null;
  let viewerSpace: XRReferenceSpace | null = null;
  let centerHitSource: XRHitTestSource | null = null;
  let fingerHitSource: XRHitTestSource | null = null;
  let fingerHitKey: string | null = null;
  let fingerEnsureGen = 0;
  let lastCenterMatrix: THREE.Matrix4 | null = null;
  let lastFingerMatrix: THREE.Matrix4 | null = null;
  let modelGroup: THREE.Group | null = null;

  type PlaceWaiter = {
    resolve: (ok: boolean) => void;
    framesLeft: number;
    key: string;
  };
  const placeWaiters: PlaceWaiter[] = [];

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  renderer.domElement.style.pointerEvents = "none";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

  const contentRoot = new THREE.Group();
  scene.add(contentRoot);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3dd6f5 }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const ripples: Array<{ mesh: THREE.Mesh; start: number; stagger: number }> =
    [];

  const applyUserScale = () => {
    if (!modelGroup) return;
    modelGroup.scale.setScalar(
      fitScale * displayedScale * Math.max(introMul, 0.02),
    );
  };

  let scaleAnimFrom = 1;
  let scaleAnimTo = 1;
  let scaleAnimStart = 0;
  const SCALE_ANIM_MS = 180;

  const tickScaleSmooth = (now: number) => {
    if (emerging) return;
    if (scaleAnimStart <= 0) return;
    const t = Math.min(1, (now - scaleAnimStart) / SCALE_ANIM_MS);
    const eased = 1 - (1 - t) ** 3;
    displayedScale = scaleAnimFrom + (scaleAnimTo - scaleAnimFrom) * eased;
    applyUserScale();
    if (t >= 1) {
      displayedScale = userScale;
      scaleAnimStart = 0;
      applyUserScale();
    }
  };

  const applyContentMatrix = (matrix: THREE.Matrix4) => {
    contentRoot.matrix.copy(matrix);
    contentRoot.matrix.decompose(
      contentRoot.position,
      contentRoot.quaternion,
      contentRoot.scale,
    );
  };

  const faceCamera = () => {
    if (!modelGroup) return;
    const cam = renderer.xr.getCamera();
    const look = new THREE.Vector3();
    cam.getWorldPosition(look);
    look.y = contentRoot.position.y;
    contentRoot.lookAt(look);
  };

  const spawnRipple = (now: number) => {
    RIPPLE_COLORS.forEach((color, i) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.046, 0.052, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: EMERGE_RING_OPACITIES[i] ?? 0.3,
          depthWrite: false,
        }),
      );
      mesh.matrixAutoUpdate = true;
      contentRoot.add(mesh);
      ripples.push({
        mesh,
        start: now,
        stagger: i * EMERGE_RING_STAGGER_MS,
      });
    });
  };

  const placeAtMatrix = (matrix: THREE.Matrix4): boolean => {
    if (!modelGroup || placed) return false;
    applyContentMatrix(matrix);
    placed = true;
    reticle.visible = false;
    emerging = true;
    emergeStart = performance.now();
    introMul = reducedMotion ? 1 : 0.02;
    applyUserScale();
    if (!reducedMotion) spawnRipple(emergeStart);
    faceCamera();
    options.onPlaced?.();
    return true;
  };

  const sampleHits = (
    source: XRHitTestSource,
    frame: XRFrame,
    space: XRReferenceSpace,
    out: THREE.Matrix4,
  ): boolean => {
    const hits = frame.getHitTestResults(source);
    if (hits.length === 0) return false;
    const pose = hits[0].getPose(space);
    if (!pose) return false;
    matrixFromXrPose(pose, out);
    return true;
  };

  const ensureFingerHitSource = async (nx: number, ny: number) => {
    if (!viewerSpace || !session.requestHitTestSource) return;
    const key = hitKey(nx, ny);
    if (fingerHitKey === key && fingerHitSource) return;
    const gen = ++fingerEnsureGen;
    fingerHitSource?.cancel();
    fingerHitSource = null;
    fingerHitKey = key;
    lastFingerMatrix = null;

    const w = host.clientWidth || window.innerWidth || 1;
    const h = host.clientHeight || window.innerHeight || 1;
    const aspect = w / Math.max(h, 1);
    const fovY = (camera.fov * Math.PI) / 180;
    try {
      const source =
        (await session.requestHitTestSource({
          space: viewerSpace,
          offsetRay: offsetRayFromNorm(nx, ny, aspect, fovY),
        })) ?? null;
      if (cancelled || gen !== fingerEnsureGen) {
        source?.cancel();
        return;
      }
      fingerHitSource = source;
    } catch {
      if (gen === fingerEnsureGen) fingerHitSource = null;
    }
  };

  const scratchMatrix = new THREE.Matrix4();

  const onSessionEnded = () => {
    if (!cancelled) options.onSessionEnd?.();
  };
  session.addEventListener("end", onSessionEnded);

  const tickEmerge = (now: number) => {
    if (!emerging || !modelGroup) return;
    const elapsed = now - emergeStart;
    if (reducedMotion) {
      const t = Math.min(1, elapsed / REDUCE_MS);
      introMul = 0.85 + 0.15 * easeOutCubic(t);
      modelGroup.position.y = 0;
      applyUserScale();
      if (t >= 1) {
        introMul = 1;
        emerging = false;
        applyUserScale();
      }
      return;
    }
    if (elapsed < EMERGE_TOTAL_MS) {
      introMul = emergeIntroAt(elapsed, 0.02);
      modelGroup.position.y = emergeRiseY(elapsed);
      applyUserScale();
      return;
    }
    introMul = 1;
    modelGroup.position.y = 0;
    emerging = false;
    applyUserScale();
  };

  const tickRipple = (now: number) => {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const t = (now - r.start - r.stagger) / EMERGE_RING_MS;
      if (t >= 1) {
        contentRoot.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        r.mesh.geometry.dispose();
        ripples.splice(i, 1);
        continue;
      }
      if (t < 0) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.visible = true;
      const s = rippleScale(t);
      r.mesh.scale.set(s, s, s);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (EMERGE_RING_OPACITIES[i] ?? 0.3) * rippleFade(t);
    }
  };

  const attachModel = (url: string): Promise<void> =>
    new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          if (cancelled) {
            resolve();
            return;
          }
          if (modelGroup) {
            contentRoot.remove(modelGroup);
            modelGroup = null;
          }
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3()).length() || 1;
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          fitScale = 0.28 / size;
          userScale = 1;
          displayedScale = 1;
          introMul = 0;
          emerging = false;
          placed = false;
          modelGroup = new THREE.Group();
          modelGroup.add(model);
          contentRoot.add(modelGroup);
          modelGroup.visible = false;
          reticle.visible = Boolean(lastCenterMatrix);
          resolve();
        },
        undefined,
        () => {
          options.onError?.("Could not load model.");
          reject(new Error("Could not load model."));
        },
      );
    });

  void (async () => {
    try {
      await renderer.xr.setSession(session);
      refSpace =
        (await session.requestReferenceSpace("local-floor").catch(() =>
          session.requestReferenceSpace("local"),
        )) ?? null;
      viewerSpace = await session.requestReferenceSpace("viewer");
      if (session.requestHitTestSource && viewerSpace) {
        centerHitSource =
          (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
      }
    } catch (e) {
      options.onError?.(
        e instanceof Error ? e.message : "Could not start the camera.",
      );
      return;
    }

    void attachModel(modelUrl).catch(() => undefined);

    renderer.setAnimationLoop((_time, frame) => {
      if (cancelled || !frame || !refSpace) {
        renderer.render(scene, camera);
        return;
      }
      const now = performance.now();
      tickEmerge(now);
      tickScaleSmooth(now);
      tickRipple(now);

      if (!placed && centerHitSource) {
        if (sampleHits(centerHitSource, frame, refSpace, scratchMatrix)) {
          reticle.matrix.copy(scratchMatrix);
          reticle.visible = true;
          lastCenterMatrix = scratchMatrix.clone();
          if (!surfaceNotified) {
            surfaceNotified = true;
            options.onSurfaceReady?.();
          }
        }
      }

      if (fingerHitSource) {
        if (sampleHits(fingerHitSource, frame, refSpace, scratchMatrix)) {
          lastFingerMatrix = scratchMatrix.clone();
        }
      }

      if (wantMoveApply && placed && !emerging && lastFingerMatrix) {
        applyContentMatrix(lastFingerMatrix);
        wantMoveApply = false;
      }

      for (let i = placeWaiters.length - 1; i >= 0; i--) {
        const waiter = placeWaiters[i];
        waiter.framesLeft -= 1;
        const matrix =
          (fingerHitKey === waiter.key ? lastFingerMatrix : null) ??
          lastCenterMatrix;
        if (matrix && modelGroup) {
          modelGroup.visible = true;
          const ok = placeAtMatrix(matrix);
          placeWaiters.splice(i, 1);
          waiter.resolve(ok);
          continue;
        }
        if (waiter.framesLeft <= 0) {
          placeWaiters.splice(i, 1);
          waiter.resolve(false);
        }
      }

      renderer.render(scene, camera);
    });
  })();

  return {
    rotate(dx, dy) {
      if (emerging || !modelGroup || !placed) return;
      // World yaw (up) + camera-right pitch — not model-local X/Y.
      const yaw = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        dx * 0.025,
      );
      modelGroup.quaternion.premultiply(yaw);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      if (right.lengthSq() > 1e-8) {
        right.normalize();
        const pitch = new THREE.Quaternion().setFromAxisAngle(right, dy * 0.018);
        modelGroup.quaternion.premultiply(pitch);
      }
    },
    setScale(factor) {
      if (emerging || !modelGroup || !placed) return;
      userScale = Math.max(0.2, Math.min(5, factor));
      displayedScale = userScale;
      scaleAnimStart = 0;
      applyUserScale();
    },
    moveScreen(nx, ny) {
      if (emerging || !placed) return;
      wantMoveApply = true;
      void ensureFingerHitSource(nx, ny);
    },
    placeAtScreen(nx, ny) {
      if (!modelGroup) return Promise.resolve(false);
      void ensureFingerHitSource(nx, ny);
      return new Promise<boolean>((resolve) => {
        placeWaiters.push({
          resolve,
          framesLeft: HIT_WAIT_FRAMES,
          key: hitKey(nx, ny),
        });
      });
    },
    recenter() {
      faceCamera();
    },
    reposition() {
      placed = false;
      surfaceNotified = false;
      emerging = false;
      introMul = 0;
      if (modelGroup) modelGroup.visible = false;
      reticle.visible = Boolean(lastCenterMatrix);
    },
    async setModel(nextUrl: string) {
      await attachModel(nextUrl);
    },
    async dispose() {
      cancelled = true;
      session.removeEventListener("end", onSessionEnded);
      renderer.setAnimationLoop(null);
      centerHitSource?.cancel();
      fingerHitSource?.cancel();
      renderer.dispose();
      renderer.domElement.remove();
      try {
        await session.end();
      } catch {
        /* already ended */
      }
    },
  };
}
