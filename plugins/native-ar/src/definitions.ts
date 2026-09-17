import type { PluginListenerHandle } from "@capacitor/core";

export type NativeArBackend = "arkit" | "arcore" | "none";

export interface NativeArSupportResult {
  supported: boolean;
  backend: NativeArBackend;
}

export interface NativeArStartOptions {
  /** Capacitor asset-relative path, without a leading slash. */
  modelPath: string;
  reducedMotion?: boolean;
  /** ARCore feature-point HUD. Default true on Android native sessions. */
  featurePointHud?: boolean;
  /** ARCore depth heatmap peek. Default true on Android native sessions. */
  depthPeek?: boolean;
}

export interface NativeArPointOptions {
  /** Native view pixels on Android; points on iOS. */
  x: number;
  /** Native view pixels on Android; points on iOS. */
  y: number;
}

export interface NativeArTrackingEvent {
  state: "initializing" | "ready" | "limited" | "unavailable";
  message?: string;
}

export interface NativeArPlugin {
  isSupported(): Promise<NativeArSupportResult>;
  startSession(options: NativeArStartOptions): Promise<void>;
  stopSession(): Promise<void>;
  onScreenTap(options: NativeArPointOptions): Promise<{ placed: boolean }>;
  moveScreen(options: NativeArPointOptions): Promise<{ moved: boolean }>;
  reposition(): Promise<void>;
  recenter(): Promise<void>;
  rotate(options: { dx: number; dy: number }): Promise<void>;
  setScale(options: { factor: number }): Promise<void>;
  /**
   * Debug/QA only: place model (+ optional matte cube) in front of camera
   * without a plane hit.
   */
  debugPlaceFront(options?: {
    withCube?: boolean;
    demetalize?: boolean;
  }): Promise<{
    placed: boolean;
    textured?: boolean;
    matte?: boolean;
    cube?: boolean;
    modelSizeM?: number;
    scaleFactor?: number;
    baseScaleX?: number;
    baseScaleY?: number;
    baseScaleZ?: number;
    tracking?: string;
    error?: string;
  }>;

  /** Legacy native aliases. */
  isAvailable(): Promise<{ available: boolean }>;
  start(options: NativeArStartOptions): Promise<void>;
  stop(): Promise<void>;
  tap(options: NativeArPointOptions): Promise<{ placed: boolean }>;
  move(options: NativeArPointOptions): Promise<{ moved: boolean }>;

  addListener(
    eventName: "trackingChanged",
    listenerFunc: (event: NativeArTrackingEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "sessionEnded",
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "placed",
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
