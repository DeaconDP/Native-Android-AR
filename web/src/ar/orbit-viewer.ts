import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  EMERGE_TOTAL_MS,
  REDUCE_MS,
  easeOutCubic,
  emergeIntroAt,
} from "./emergeMotion";

export type OrbitViewerHandle = {
  rotate: (dx: number, dy: number) => void;
  setScale: (factor: number) => void;
  pan: (dx: number, dy: number) => void;
  resetPose: () => void;
  noteInteracted: () => void;
  setModel: (modelUrl: string) => Promise<void>;
  dispose: () => void;
};

const CAM_POS = new THREE.Vector3(0.35, 0.18, 0.55);
const LOOK_AT = new THREE.Vector3(0, 0.04, 0);

export function createOrbitViewer(
  host: HTMLElement,
  modelUrl: string,
  options: {
    reducedMotion?: boolean;
    onReady?: () => void;
    onError?: (message: string) => void;
  } = {},
): OrbitViewerHandle {
  const reducedMotion = options.reducedMotion === true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
  camera.position.copy(CAM_POS);
  camera.lookAt(LOOK_AT);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.pointerEvents = "none";
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xece8c3, 0x1a2030, 1.1));
  const key = new THREE.DirectionalLight(0xffe8c8, 1.35);
  key.position.set(0.6, 1.1, 0.4);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  let cancelled = false;
  let interacted = false;
  let autoAngle = 0;
  let fitScale = 1;
  let userScale = 1;
  let displayedScale = 1;
  let introMul = 0;
  let emergeStart = 0;
  let emerging = false;
  let frame = 0;

  let applyUserScale = () => {
    root.scale.setScalar(fitScale * displayedScale * Math.max(introMul, 0.02));
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

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const tickEmerge = (now: number) => {
    if (!emerging) return;
    const elapsed = now - emergeStart;
    if (reducedMotion) {
      const t = Math.min(1, elapsed / REDUCE_MS);
      introMul = 0.85 + 0.15 * easeOutCubic(t);
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
      applyUserScale();
      return;
    }
    introMul = 1;
    emerging = false;
    applyUserScale();
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    tickEmerge(now);
    tickScaleSmooth(now);
    if (!reducedMotion && !interacted && root.children.length && !emerging) {
      autoAngle += 0.006;
      root.rotation.y = autoAngle;
    }
    renderer.render(scene, camera);
  };
  tick(performance.now());

  const attachModel = (url: string): Promise<void> =>
    new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          if (cancelled) {
            resolve();
            return;
          }
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3()).length() || 1;
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          fitScale = 0.28 / size;
          userScale = 1;
          displayedScale = 1;
          root.clear();
          root.add(model);
          emerging = true;
          emergeStart = performance.now();
          introMul = reducedMotion ? 1 : 0.02;
          applyUserScale();
          options.onReady?.();
          resolve();
        },
        undefined,
        () => {
          options.onError?.("Could not load model.");
          reject(new Error("Could not load model."));
        },
      );
    });

  void attachModel(modelUrl).catch(() => undefined);

  return {
    rotate(dx, dy) {
      if (emerging) return;
      interacted = true;
      root.rotation.y += dx * 0.025;
      root.rotation.x += dy * 0.018;
      root.rotation.x = Math.max(-1.2, Math.min(1.2, root.rotation.x));
    },
    setScale(factor) {
      if (emerging) return;
      interacted = true;
      userScale = Math.max(0.2, Math.min(5, factor));
      displayedScale = userScale;
      scaleAnimStart = 0;
      applyUserScale();
    },
    pan(dx, dy) {
      interacted = true;
      root.position.x += dx * 0.0022;
      root.position.y -= dy * 0.0022;
      root.position.x = Math.max(-0.45, Math.min(0.45, root.position.x));
      root.position.y = Math.max(-0.35, Math.min(0.35, root.position.y));
    },
    resetPose() {
      userScale = 1;
      displayedScale = 1;
      root.rotation.set(0, 0, 0);
      root.position.set(0, 0, 0);
      applyUserScale();
    },
    noteInteracted() {
      interacted = true;
    },
    async setModel(nextUrl: string) {
      interacted = false;
      autoAngle = 0;
      root.rotation.set(0, 0, 0);
      root.position.set(0, 0, 0);
      await attachModel(nextUrl);
    },
    dispose() {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
