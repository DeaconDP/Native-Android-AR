import type { PlacementAsset, PlacementMode } from '../state/preferences';

export type AppPhase = 'gate' | 'ar';

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
}

export interface AppState {
  phase: AppPhase;
  placementMode: PlacementMode;
  selectedAsset: PlacementAsset;
  placedCount: number;
  debugEnabled: boolean;
  isClearing: boolean;
  showModelPicker: boolean;
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
  cameraPosition: '—',
  cameraQuaternion: '—',
  depthSupported: false,
  lightEstimation: false,
  anchorsSupported: false,
  placementMode: 'floor',
  selectedAsset: 'helmet',
});

export function createAppState(initialAsset: PlacementAsset): AppState & {
  subscribe: (listener: Listener) => () => void;
  patch: (partial: Partial<AppState>) => void;
  patchMetrics: (partial: Partial<DebugMetrics>) => void;
} {
  let state: AppState = {
    phase: 'gate',
    placementMode: 'floor',
    selectedAsset: initialAsset,
    placedCount: 0,
    debugEnabled: false,
    isClearing: false,
    showModelPicker: false,
    trackingBanner: null,
    gateTitle: 'Native AR',
    gateBody: 'Checking WebXR support…',
    gateActionLabel: null,
    gateError: false,
    metrics: { ...defaultMetrics(), selectedAsset: initialAsset },
  };

  const listeners = new Set<Listener>();

  return {
    get phase() {
      return state.phase;
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
    get debugEnabled() {
      return state.debugEnabled;
    },
    get isClearing() {
      return state.isClearing;
    },
    get showModelPicker() {
      return state.showModelPicker;
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
      if (partial.placementMode !== undefined || partial.selectedAsset !== undefined) {
        state.metrics = {
          ...state.metrics,
          placementMode: state.placementMode,
          selectedAsset: state.selectedAsset,
        };
      }
      listeners.forEach((listener) => listener(state));
    },
    patchMetrics(partial: Partial<DebugMetrics>) {
      state = { ...state, metrics: { ...state.metrics, ...partial } };
      listeners.forEach((listener) => listener(state));
    },
  };
}

export type AppStateStore = ReturnType<typeof createAppState>;
