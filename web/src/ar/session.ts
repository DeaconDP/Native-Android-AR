import type { AppStateStore } from "../state/app-state";
import {
  isPlacementAsset,
  type PlacementAsset,
} from "../state/catalog";
import { saveSelectedAsset } from "../state/preferences";
import {
  exitAr,
  NativeAr,
  nativeReposition,
  openChromeArHandoff,
  prepareArMode,
  startNativeAr,
  startWebXrAr,
  stopNativeAr,
  tryQuickLookAr,
  webModelUrl,
  type ArMode,
} from "../native/arBridge";
import { createOrbitViewer, type OrbitViewerHandle } from "./orbit-viewer";
import { createWebXrViewer, type WebXrViewerHandle } from "./webxr-viewer";
import { mountSessionGestures, type SessionUiController } from "./session-ui";

export interface ArSessionController {
  end: () => Promise<void>;
  clearAll: () => void;
}

type Runtime = {
  mode: ArMode;
  xrSession: XRSession | null;
  webxr: WebXrViewerHandle | null;
  orbit: OrbitViewerHandle | null;
  gestures: SessionUiController | null;
  trackingUnsub: (() => void) | null;
  stage: HTMLElement | null;
};

let runtime: Runtime | null = null;

function ensureStage(uiRoot: HTMLElement): HTMLElement {
  let stage = uiRoot.querySelector<HTMLElement>(".ar-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.className = "ar-stage";
    uiRoot.appendChild(stage);
  }
  return stage;
}

async function tearDownRuntime(): Promise<void> {
  if (!runtime) return;
  const current = runtime;
  runtime = null;
  current.gestures?.dispose();
  current.trackingUnsub?.();
  current.orbit?.dispose();
  if (current.webxr) {
    await current.webxr.dispose();
  } else if (current.mode === "native") {
    await exitAr(null);
  } else if (current.xrSession) {
    await exitAr(current.xrSession);
  }
  current.stage?.remove();
}

export async function initGate(store: AppStateStore): Promise<void> {
  const mode = await prepareArMode();
  const bodies: Record<ArMode, string> = {
    native: "Mode: native (ARCore / ARKit). Tap How it works to learn the techniques, or Start AR to place.",
    webxr: "Mode: WebXR. Tap How it works to learn the ladder, or Start AR to place.",
    quicklook: "Mode: Quick Look. Tap How it works for the ladder, or Start AR to open it.",
    chrome: "Mode: Chrome handoff. Tap How it works for why, or Start to open WebXR in Chrome.",
    orbit: "Mode: orbit (no camera AR). Tap How it works for the ladder, or Start for 3D orbit.",
  };
  store.patch({
    gateTitle: "Deez-Native AR",
    gateBody: bodies[mode],
    gateActionLabel: "Start AR",
    gateError: false,
    metrics: { ...store.metrics, arMode: mode },
  });
}

async function startSession(
  store: AppStateStore,
  uiRoot: HTMLElement,
): Promise<ArSessionController> {
  const mode = await prepareArMode();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  if (mode === "quicklook") {
    const ok = await tryQuickLookAr(store.selectedAsset);
    if (!ok) {
      throw new Error("Could not open AR Quick Look.");
    }
    store.patch({
      phase: "gate",
      gateTitle: "Quick Look",
      gateBody: "AR Quick Look opened. Dismiss it to return here.",
      gateActionLabel: "Start AR",
      gateError: false,
    });
    return {
      end: async () => undefined,
      clearAll: () => undefined,
    };
  }

  if (mode === "chrome") {
    const result = await openChromeArHandoff();
    if (!result.ok) throw new Error(result.error);
    store.patch({
      phase: "gate",
      gateTitle: "Opened in Chrome",
      gateBody: "Continue AR in the Chrome tab, then return to this app.",
      gateActionLabel: "Start AR",
      gateError: false,
    });
    return {
      end: async () => undefined,
      clearAll: () => undefined,
    };
  }

  await tearDownRuntime();
  const stage = ensureStage(uiRoot);
  stage.classList.toggle("ar-stage--native", mode === "native");
  stage.classList.toggle("ar-stage--webxr", mode === "webxr");
  stage.classList.toggle("ar-stage--orbit", mode === "orbit");

  let xrSession: XRSession | null = null;
  let webxr: WebXrViewerHandle | null = null;
  let orbit: OrbitViewerHandle | null = null;
  let trackingUnsub: (() => void) | null = null;

  store.patch({
    phase: "ar",
    arMode: mode,
    placedCount: 0,
    surfaceReady: mode === "orbit",
    sessionError: null,
    trackingBanner: null,
  });

  if (mode === "native") {
    const started = await startNativeAr({
      reducedMotion,
      asset: store.selectedAsset,
    });
    if (!started.ok) throw new Error(started.error);

    const handle = await NativeAr.addListener("trackingChanged", (event) => {
      const ready = event.state === "ready";
      store.patch({ surfaceReady: ready });
      runtime?.gestures?.setSurfaceReady(ready);
    });
    trackingUnsub = () => {
      void handle.remove();
    };
    const placedHandle = await NativeAr.addListener("placed", () => {
      store.patch({ placedCount: 1 });
      runtime?.gestures?.setPlaced(true);
    });
    const endedHandle = await NativeAr.addListener("sessionEnded", () => {
      void endFromOutside(store);
    });
    const prevUnsub = trackingUnsub;
    trackingUnsub = () => {
      prevUnsub();
      void placedHandle.remove();
      void endedHandle.remove();
    };
  } else if (mode === "webxr") {
    const started = await startWebXrAr(uiRoot);
    if (!started.ok) throw new Error(started.error);
    xrSession = started.session;
    webxr = createWebXrViewer(stage, xrSession, webModelUrl(store.selectedAsset), {
      reducedMotion,
      onSurfaceReady: () => {
        store.patch({ surfaceReady: true });
        runtime?.gestures?.setSurfaceReady(true);
      },
      onPlaced: () => {
        store.patch({ placedCount: 1 });
        runtime?.gestures?.setPlaced(true);
      },
      onError: (message) => store.patch({ sessionError: message }),
      onSessionEnd: () => {
        void endFromOutside(store);
      },
    });
  } else {
    orbit = createOrbitViewer(stage, webModelUrl(store.selectedAsset), {
      reducedMotion,
      onReady: () => {
        store.patch({ placedCount: 1, surfaceReady: true });
        runtime?.gestures?.setPlaced(true);
        runtime?.gestures?.setSurfaceReady(true);
      },
      onError: (message) => store.patch({ sessionError: message }),
    });
  }

  const gestures = mountSessionGestures(
    stage,
    mode,
    { webxr, orbit },
    {
      onPlaced: () => store.patch({ placedCount: 1 }),
      onHint: (hint) => store.patch({ sessionHint: hint }),
      onError: (message) => store.patch({ sessionError: message }),
      onExit: () => {
        void endFromOutside(store);
      },
    },
  );

  runtime = {
    mode,
    xrSession,
    webxr,
    orbit,
    gestures,
    trackingUnsub,
    stage,
  };

  return {
    end: async () => {
      await tearDownRuntime();
      store.patch({
        phase: "gate",
        arMode: null,
        placedCount: 0,
        surfaceReady: false,
        sessionHint: null,
        sessionError: null,
        trackingBanner: null,
      });
      await initGate(store);
    },
    clearAll: () => {
      if (mode === "native") void nativeReposition();
      else webxr?.reposition();
      store.patch({ placedCount: 0 });
      gestures.setPlaced(false);
    },
  };
}

async function endFromOutside(store: AppStateStore): Promise<void> {
  await tearDownRuntime();
  store.patch({
    phase: "gate",
    arMode: null,
    placedCount: 0,
    surfaceReady: false,
    sessionHint: null,
    sessionError: null,
  });
  await initGate(store);
}

export function bindStoreActions(
  store: AppStateStore,
  uiRoot: HTMLElement,
  getController: () => ArSessionController | null,
  setController: (controller: ArSessionController | null) => void,
): void {
  uiRoot.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>("[data-action]");
    const action = actionEl?.dataset.action;
    if (!action) return;

    switch (action) {
      case "start-ar": {
        if (store.phase === "ar" || store.isStarting) return;
        const button = actionEl as HTMLButtonElement;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        store.patch({ isStarting: true });
        try {
          const controller = await startSession(store, uiRoot);
          setController(controller);
        } catch (error) {
          store.patch({
            gateTitle: "Could not start AR",
            gateBody:
              error instanceof Error ? error.message : "Unknown AR error",
            gateActionLabel: "Try again",
            gateError: true,
            phase: "gate",
          });
        } finally {
          store.patch({ isStarting: false });
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
        break;
      }
      case "exit-ar": {
        const controller = getController();
        if (!controller) return;
        const button = actionEl as HTMLButtonElement;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
          await controller.end();
          setController(null);
        } finally {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
        break;
      }
      case "mode-floor":
        store.patch({ placementMode: "floor" });
        break;
      case "mode-wall":
        store.patch({ placementMode: "wall" });
        break;
      case "pick-model":
        store.patch({ showModelPicker: true });
        break;
      case "close-picker":
        if (!target.closest(".picker__item")) {
          store.patch({ showModelPicker: false });
        }
        break;
      case "open-learn":
        store.patch({ showLearn: true, learnTopicId: null });
        break;
      case "close-learn": {
        const inPanel = target.closest("[data-learn-panel]");
        const isCloseBtn = Boolean(target.closest(".icon-btn"));
        if (!inPanel || isCloseBtn) {
          store.patch({ showLearn: false, learnTopicId: null });
        }
        break;
      }
      case "learn-back":
        store.patch({ learnTopicId: null });
        break;
      case "learn-topic": {
        const topicId = actionEl.dataset.learnId ?? null;
        store.patch({ showLearn: true, learnTopicId: topicId });
        break;
      }
      case "toggle-debug":
        store.patch({ debugEnabled: !store.debugEnabled });
        break;
      case "clear-all": {
        const controller = getController();
        // #region agent log
        fetch("http://127.0.0.1:7709/ingest/69ce765a-960d-441f-925a-4fbdc6c1814e", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "53ab5c",
          },
          body: JSON.stringify({
            sessionId: "53ab5c",
            runId: "post-fix",
            hypothesisId: "C",
            location: "session.ts:clear-all",
            message: "clear-all action",
            data: {
              hasController: Boolean(controller),
              isClearing: store.isClearing,
              placedCount: store.placedCount,
              skipped: !controller || store.isClearing || store.placedCount === 0,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (!controller || store.isClearing || store.placedCount === 0) return;
        store.patch({ isClearing: true });
        controller.clearAll();
        await new Promise((resolve) => setTimeout(resolve, 250));
        store.patch({ isClearing: false });
        break;
      }
      default:
        if (action.startsWith("asset-")) {
          const raw = action.replace("asset-", "");
          if (!isPlacementAsset(raw)) break;
          const asset: PlacementAsset = raw;
          const button = actionEl as HTMLButtonElement;
          button.disabled = true;
          button.setAttribute("aria-busy", "true");
          try {
            saveSelectedAsset(asset);
            store.patch({
              selectedAsset: asset,
              showModelPicker: false,
              sessionError: null,
            });
            const current = runtime;
            if (!current) break;

            if (current.mode === "orbit" && current.orbit) {
              await current.orbit.setModel(webModelUrl(asset));
              store.patch({ placedCount: 1, surfaceReady: true });
              current.gestures?.setPlaced(true);
              current.gestures?.setSurfaceReady(true);
            } else if (current.mode === "webxr" && current.webxr) {
              await current.webxr.setModel(webModelUrl(asset));
              store.patch({ placedCount: 0 });
              current.gestures?.setPlaced(false);
            } else if (current.mode === "native") {
              const reducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches;
              await stopNativeAr();
              const started = await startNativeAr({
                reducedMotion,
                asset,
              });
              if (!started.ok) {
                store.patch({ sessionError: started.error });
                break;
              }
              store.patch({ placedCount: 0, surfaceReady: false });
              current.gestures?.setPlaced(false);
              current.gestures?.setSurfaceReady(false);
            }
          } finally {
            button.disabled = false;
            button.removeAttribute("aria-busy");
          }
        }
        break;
    }
  });
}
