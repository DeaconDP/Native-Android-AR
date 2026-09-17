import type { PlacementAsset, PlacementMode } from "./preferences";
import { DEFAULT_PLACEMENT_ASSET } from "./preferences";
import type { ArMode } from "../native/arBridge";

export type AppPhase = "gate" | "ar";

export interface DebugMetrics {
  fps: number;
  anchorCount: number;
  hasValidHit: boolean;
  cameraPosition: string;
  cameraQuaternion: string;
  depthSupported: boolean;
  lightEstimation: boolean;
  anchorsSupported: boolean;
  placementMode: PlacementMode;
  selectedAsset: PlacementAsset;
  arMode: ArMode | null;
}

export interface AppState {
  phase: AppPhase;
  arMode: ArMode | null;
  placementMode: PlacementMode;
  selectedAsset: PlacementAsset;
  placedCount: number;
  surfaceReady: boolean;
  sessionHint: string | null;
  sessionError: string | null;
  debugEnabled: boolean;
  isClearing: boolean;
  isStarting: boolean;
  showModelPicker: boolean;
  showLearn: boolean;
  learnTopicId: string | null;
  trackingBanner: string | null;
  gateTitle: string;
  gateBody: string;
  gateActionLabel: string | null;
  gateError: boolean;
  metrics: DebugMetrics;
}

type Listener = (state: AppState) => void;

const defaultMetrics = (): DebugMetrics => ({
  fps: 0,
  anchorCount: 0,
  hasValidHit: false,
  cameraPosition: "—",
  cameraQuaternion: "—",
  depthSupported: false,
  lightEstimation: false,
  anchorsSupported: false,
  placementMode: "floor",
  selectedAsset: DEFAULT_PLACEMENT_ASSET,
  arMode: null,
});

export function createAppState(initialAsset: PlacementAsset): AppState & {
  subscribe: (listener: Listener) => () => void;
  patch: (partial: Partial<AppState>) => void;
  patchMetrics: (partial: Partial<DebugMetrics>) => void;
} {
  let state: AppState = {
    phase: "gate",
    arMode: null,
    placementMode: "floor",
    selectedAsset: initialAsset,
    placedCount: 0,
    surfaceReady: false,
    sessionHint: null,
    sessionError: null,
    debugEnabled: false,
    isClearing: false,
    isStarting: false,
    showModelPicker: false,
    showLearn: false,
    learnTopicId: null,
    trackingBanner: null,
    gateTitle: "Deez-Native AR",
    gateBody: "Checking AR support…",
    gateActionLabel: null,
    gateError: false,
    metrics: { ...defaultMetrics(), selectedAsset: initialAsset },
  };

  const listeners = new Set<Listener>();

  const notify = () => listeners.forEach((listener) => listener(state));

  return {
    get phase() {
      return state.phase;
    },
    get arMode() {
      return state.arMode;
    },
    get placementMode() {
      return state.placementMode;
    },
    get selectedAsset() {
      return state.selectedAsset;
    },
    get placedCount() {
      return state.placedCount;
    },
    get surfaceReady() {
      return state.surfaceReady;
    },
    get sessionHint() {
      return state.sessionHint;
    },
    get sessionError() {
      return state.sessionError;
    },
    get debugEnabled() {
      return state.debugEnabled;
    },
    get isClearing() {
      return state.isClearing;
    },
    get isStarting() {
      return state.isStarting;
    },
    get showModelPicker() {
      return state.showModelPicker;
    },
    get showLearn() {
      return state.showLearn;
    },
    get learnTopicId() {
      return state.learnTopicId;
    },
    get trackingBanner() {
      return state.trackingBanner;
    },
    get gateTitle() {
      return state.gateTitle;
    },
    get gateBody() {
      return state.gateBody;
    },
    get gateActionLabel() {
      return state.gateActionLabel;
    },
    get gateError() {
      return state.gateError;
    },
    get metrics() {
      return state.metrics;
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    patch(partial: Partial<AppState>) {
      state = { ...state, ...partial };
      if (
        partial.placementMode !== undefined ||
        partial.selectedAsset !== undefined ||
        partial.arMode !== undefined
      ) {
        state.metrics = {
          ...state.metrics,
          placementMode: state.placementMode,
          selectedAsset: state.selectedAsset,
          arMode: state.arMode,
        };
      }
      notify();
    },
    patchMetrics(partial: Partial<DebugMetrics>) {
      state = { ...state, metrics: { ...state.metrics, ...partial } };
      notify();
    },
  };
}

export type AppStateStore = ReturnType<typeof createAppState>;
