import type { ArMode, NativeArPlacementMode } from "../native/arBridge";
import {
  nativeDebugPlaceFront,
  nativeMoveScreen,
  nativeOnScreenTap,
  nativeRecenter,
  nativeReposition,
  nativeRotate,
  nativeSetScale,
} from "../native/arBridge";
import { coachForMilestone, type CoachMilestone } from "../learn/curriculum";
import { EMERGE_TOTAL_MS, REDUCE_MS } from "./emergeMotion";
import type { OrbitViewerHandle } from "./orbit-viewer";
import type { WebXrViewerHandle } from "./webxr-viewer";

const TAP_SLOP = 12;
const SCALE_MIN = 0.2;
const SCALE_MAX = 5;

type Ptr = { x: number; y: number; startX: number; startY: number };

export type SessionUiCallbacks = {
  onPlaced: () => void;
  onHint: (hint: string, topicId: string) => void;
  onError: (message: string | null) => void;
  onExit: () => void;
};

export type SessionUiController = {
  setSurfaceReady: (ready: boolean) => void;
  setPlaced: (placed: boolean) => void;
  dispose: () => void;
  getScale: () => number;
};

function clampScale(v: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));
}

function overlayNorm(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

function updateHint(
  mode: ArMode,
  placed: boolean,
  surfaceReady: boolean,
  onHint: (h: string, topicId: string) => void,
  gestured = false,
  placement: NativeArPlacementMode = "plane",
): void {
  let milestone: CoachMilestone;
  if (mode === "orbit") milestone = "orbit";
  else if (!placed) milestone = surfaceReady ? "ready" : "scan";
  else if (gestured) milestone = "gesture";
  else milestone = "placed";

  const coach = coachForMilestone(mode, milestone, placement);
  onHint(coach.text, coach.topicId);
}

export function mountSessionGestures(
  stage: HTMLElement,
  mode: ArMode,
  backends: {
    webxr?: WebXrViewerHandle | null;
    orbit?: OrbitViewerHandle | null;
  },
  callbacks: SessionUiCallbacks,
  nativePlacement: NativeArPlacementMode = "plane",
): SessionUiController {
  const cameraAr = mode === "native" || mode === "webxr";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const imageMode = nativePlacement === "image";

  let placed = mode === "orbit";
  let surfaceReady = mode === "orbit";
  let gestured = false;
  let learnNudgeSent = false;
  let spawning = false;
  let scale = 1;
  let spawnTimer = 0;
  let pendingMove: { x: number; y: number } | null = null;

  const pointers = new Map<number, Ptr>();
  let pinch: { startDist: number; startScale: number } | null = null;
  /** Two-finger: lock to pinch OR pan so scale doesn't also yank the anchor. */
  let twoFingerMode: "pinch" | "pan" | null = null;
  let lastCentroid: { x: number; y: number } | null = null;
  const velocity = { vx: 0, vy: 0 };
  let pendingRotate = { dx: 0, dy: 0 };
  let pendingScale: number | null = null;
  let flushRaf = 0;
  let momentumRaf = 0;

  const beginSpawnLock = () => {
    spawning = true;
    window.clearTimeout(spawnTimer);
    const ms = reduceMotion ? REDUCE_MS : EMERGE_TOTAL_MS;
    spawnTimer = window.setTimeout(() => {
      spawning = false;
    }, ms);
  };

  updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);

  const listPointers = () => [...pointers.values()];
  const centroidOf = (pts: Ptr[]) => {
    const n = pts.length || 1;
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      y: pts.reduce((s, p) => s + p.y, 0) / n,
    };
  };
  const distOf = (pts: Ptr[]) => {
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const noteGesture = () => {
    if (!placed || learnNudgeSent) return;
    gestured = true;
    learnNudgeSent = true;
    updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
  };

  const applyRotate = (dx: number, dy: number) => {
    noteGesture();
    if (mode === "native") void nativeRotate(dx, dy);
    else if (mode === "webxr") backends.webxr?.rotate(dx, dy);
    else backends.orbit?.rotate(dx, dy);
  };

  const applyScale = (factor: number) => {
    noteGesture();
    scale = clampScale(factor);
    if (mode === "native") void nativeSetScale(scale);
    else if (mode === "webxr") backends.webxr?.setScale(scale);
    else backends.orbit?.setScale(scale);
  };

  const applyMoveScreen = (x: number, y: number) => {
    if (mode === "native") {
      void nativeMoveScreen(x, y);
      return;
    }
    if (mode === "webxr") {
      const n = overlayNorm(x, y, stage.getBoundingClientRect());
      if (n) pendingMove = n;
    }
  };

  const flush = () => {
    flushRaf = 0;
    if (pendingRotate.dx || pendingRotate.dy) {
      applyRotate(pendingRotate.dx, pendingRotate.dy);
      pendingRotate = { dx: 0, dy: 0 };
    }
    if (pendingScale !== null) {
      applyScale(pendingScale);
      pendingScale = null;
    }
    if (pendingMove) {
      backends.webxr?.moveScreen(pendingMove.x, pendingMove.y);
      pendingMove = null;
    }
  };

  const scheduleFlush = () => {
    if (flushRaf) return;
    flushRaf = requestAnimationFrame(flush);
  };

  const queueRotate = (dx: number, dy: number) => {
    if (spawning) return;
    pendingRotate.dx += dx;
    pendingRotate.dy += dy;
    scheduleFlush();
  };

  const pumpMomentum = () => {
    if (reduceMotion || spawning) return;
    const { vx, vy } = velocity;
    if (Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2) return;
    applyRotate(vx, vy);
    velocity.vx *= 0.94;
    velocity.vy *= 0.94;
    momentumRaf = requestAnimationFrame(pumpMomentum);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    stage.setPointerCapture(e.pointerId);
    cancelAnimationFrame(momentumRaf);
    velocity.vx = 0;
    velocity.vy = 0;
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    });
    const pts = listPointers();
    if (pts.length === 2 && placed && !spawning) {
      pinch = { startDist: distOf(pts) || 1, startScale: scale };
      twoFingerMode = null;
      lastCentroid = centroidOf(pts);
      backends.orbit?.noteInteracted();
    } else {
      pinch = null;
      twoFingerMode = null;
      lastCentroid = null;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const ptr = pointers.get(e.pointerId);
    if (!ptr) return;
    if (e.cancelable) e.preventDefault();
    const prevX = ptr.x;
    const prevY = ptr.y;
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    if (!placed || spawning) return;

    const pts = listPointers();
    if (pts.length >= 2) {
      const dist = distOf(pts);
      const c = centroidOf(pts);
      if (pinch && dist > 0) {
        const distRatio = dist / (pinch.startDist || dist);
        const cdx = lastCentroid ? c.x - lastCentroid.x : 0;
        const cdy = lastCentroid ? c.y - lastCentroid.y : 0;
        const centroidTravel = Math.hypot(cdx, cdy);
        if (!twoFingerMode) {
          if (Math.abs(distRatio - 1) > 0.04) twoFingerMode = "pinch";
          else if (centroidTravel > 14) twoFingerMode = "pan";
        }
        if (twoFingerMode === "pinch") {
          pendingScale = clampScale(pinch.startScale * distRatio);
          scheduleFlush();
        } else if (twoFingerMode === "pan" && lastCentroid) {
          if (imageMode) {
            /* Pose is the printed marker. */
          } else if (cameraAr) applyMoveScreen(c.x, c.y);
          else backends.orbit?.pan(cdx, cdy);
        }
      }
      lastCentroid = c;
      return;
    }

    if (!cameraAr && e.shiftKey) {
      backends.orbit?.pan(e.clientX - prevX, e.clientY - prevY);
      return;
    }

    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    velocity.vx = velocity.vx * 0.6 + dx * 0.4;
    velocity.vy = velocity.vy * 0.6 + dy * 0.4;
    queueRotate(dx, dy);
  };

  const onPointerUp = (e: PointerEvent) => {
    const ptr = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    try {
      stage.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }

    const remaining = listPointers();
    if (remaining.length < 2) {
      pinch = null;
      twoFingerMode = null;
      lastCentroid = null;
    } else if (remaining.length === 2 && placed && !spawning) {
      pinch = { startDist: distOf(remaining) || 1, startScale: scale };
      twoFingerMode = null;
      lastCentroid = centroidOf(remaining);
    }

    if (!ptr) return;

    if (!placed && cameraAr) {
      const travel = Math.hypot(ptr.x - ptr.startX, ptr.y - ptr.startY);
      if (travel <= TAP_SLOP && surfaceReady) {
        if (imageMode) {
          // Auto-places when ARCore locks the marker.
          return;
        }
        void (async () => {
          let ok = false;
          if (mode === "native") {
            ok = await nativeOnScreenTap(ptr.x, ptr.y);
          } else {
            const n = overlayNorm(ptr.x, ptr.y, stage.getBoundingClientRect());
            if (!n) return;
            ok = Boolean(await backends.webxr?.placeAtScreen(n.x, n.y));
          }
          if (ok) {
            placed = true;
            beginSpawnLock();
            callbacks.onPlaced();
            callbacks.onError(null);
            updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
          } else {
            callbacks.onError("Scan a flat surface, then tap the highlighted area.");
          }
        })();
      }
      return;
    }

    if (placed && remaining.length === 0 && !spawning) {
      pumpMomentum();
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!placed || spawning) return;
    e.preventDefault();
    applyScale(scale * (e.deltaY > 0 ? 0.94 : 1.06));
    backends.orbit?.noteInteracted();
  };

  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-session-action]");
    const action = target?.dataset.sessionAction;
    if (!action) return;
    e.preventDefault();
    switch (action) {
      case "exit":
        callbacks.onExit();
        break;
      case "reposition":
        if (mode === "native") void nativeReposition();
        else backends.webxr?.reposition();
        placed = false;
        scale = 1;
        updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
        break;
      case "recenter":
        if (mode === "native") void nativeRecenter();
        else if (mode === "webxr") backends.webxr?.recenter();
        else backends.orbit?.resetPose();
        break;
      case "debug-place":
        if (mode === "native") {
          void nativeDebugPlaceFront().then((ok) => {
            if (ok) {
              placed = true;
              callbacks.onPlaced();
              updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
            }
          });
        }
        break;
      default:
        break;
    }
  };

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("wheel", onWheel, { passive: false });
  // Chrome controls live outside the stage (footer)  -  listen on document.
  document.addEventListener("click", onClick);

  if (mode === "orbit") beginSpawnLock();

  return {
    setSurfaceReady(ready) {
      surfaceReady = ready;
      updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
    },
    setPlaced(next) {
      placed = next;
      if (next) beginSpawnLock();
      if (!next) {
        gestured = false;
        learnNudgeSent = false;
      }
      updateHint(mode, placed, surfaceReady, callbacks.onHint, gestured, nativePlacement);
    },
    getScale: () => scale,
    dispose() {
      window.clearTimeout(spawnTimer);
      cancelAnimationFrame(flushRaf);
      cancelAnimationFrame(momentumRaf);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("wheel", onWheel);
      document.removeEventListener("click", onClick);
    },
  };
}
