import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { NativeAr } from "native-ar";
import type { NativeArPlacementMode } from "native-ar";
import { isQuickLookSupported, launchQuickLook } from "../ar/quickLook";
import {
  ASSET_LABELS,
  DEFAULT_PLACEMENT_ASSET,
  nativeModelPathFor,
  webModelUrlFor,
  type PlacementAsset,
} from "../state/catalog";
import { loadSelectedAsset } from "../state/preferences";

export type ArMode = "native" | "webxr" | "orbit" | "quicklook" | "chrome";

export type { NativeArPlacementMode };

export function isCapacitorAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export type ArEnterResult =
  | { ok: true; mode: ArMode }
  | { ok: false; error: string };

/** HTTPS origin for Cap Android → Chrome Custom Tabs WebXR handoff. */
export function arChromeOrigin(): string {
  const raw = (import.meta.env.VITE_AR_ORIGIN as string | undefined)?.trim();
  return raw?.replace(/\/$/, "") ?? "";
}

export function canChromeHandoff(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "android" &&
    Boolean(arChromeOrigin())
  );
}

export async function openChromeArHandoff(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const origin = arChromeOrigin();
  if (!origin) {
    return {
      ok: false,
      error:
        "Set VITE_AR_ORIGIN to your HTTPS URL (LAN or public), rebuild, then try again.",
    };
  }
  try {
    await Browser.open({ url: origin });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : `Couldn't open Chrome. Open this URL yourself: ${origin}`,
    };
  }
}

/** Uncompressed GLB for Filament / ARKit native loaders. */
export function nativeModelPath(
  asset: PlacementAsset = loadSelectedAsset(),
): string {
  return nativeModelPathFor(asset);
}

export function webModelUrl(
  asset: PlacementAsset = loadSelectedAsset(),
): string {
  return webModelUrlFor(asset);
}

function visitorError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes("permission") || lower.includes("camera")) {
    return "Camera access is needed to place objects.";
  }
  if (lower.includes("arcore install declined")) {
    return "AR needs Google Play Services for AR. Install it and try again.";
  }
  if (lower.includes("arcore is not supported")) {
    return "AR is not supported on this device.";
  }
  if (
    /lifecycleowner|sessionpaused|camera session timed out|failed to start native ar/i.test(
      raw,
    )
  ) {
    return "Could not start the camera. Force-stop the app and try again.";
  }
  if (raw && !lower.includes("not supported")) {
    return raw;
  }
  return "Could not start AR on this device.";
}

export async function isNativeArSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeAr.isSupported();
    return result.supported;
  } catch {
    return false;
  }
}

/**
 * WebXR immersive-ar — browser Chrome only.
 * Capacitor System WebView cannot run immersive-ar.
 */
export async function isWebXrArSupported(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return false;
  const xr = navigator.xr;
  if (!xr?.isSessionSupported) return false;
  try {
    return await xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

export async function requestWebXrSession(
  overlayRoot: HTMLElement,
): Promise<XRSession> {
  const xr = navigator.xr;
  if (!xr) throw new Error("WebXR is not available.");

  try {
    return await xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["local-floor", "dom-overlay"],
      domOverlay: { root: overlayRoot },
    });
  } catch {
    return xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
    });
  }
}

export async function endWebXrSession(session: XRSession | null): Promise<void> {
  if (!session) return;
  try {
    if (session.end) await session.end();
  } catch {
    /* already ended */
  }
}

export async function startNativeAr(options?: {
  reducedMotion?: boolean;
  asset?: PlacementAsset;
  featurePointHud?: boolean;
  depthPeek?: boolean;
  placementMode?: NativeArPlacementMode;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const asset = options?.asset ?? loadSelectedAsset();
  const placementMode: NativeArPlacementMode = options?.placementMode ?? "plane";
  const imageMode = placementMode === "image";
  try {
    document.documentElement.classList.add("is-ar-native");
    document.body.classList.add("is-ar-native");
    await NativeAr.startSession({
      modelPath: nativeModelPath(asset),
      reducedMotion: options?.reducedMotion === true,
      featurePointHud: imageMode ? false : (options?.featurePointHud ?? true),
      depthPeek: imageMode ? false : (options?.depthPeek ?? true),
      placementMode,
    });
    return { ok: true };
  } catch (e) {
    document.documentElement.classList.remove("is-ar-native");
    document.body.classList.remove("is-ar-native");
    return { ok: false, error: visitorError(e) };
  }
}

export async function stopNativeAr(): Promise<void> {
  try {
    await NativeAr.stopSession();
  } catch {
    /* already stopped */
  } finally {
    document.documentElement.classList.remove("is-ar-native");
    document.body.classList.remove("is-ar-native");
  }
}

export function nativeViewPoint(
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const dpr = window.devicePixelRatio || 1;
  if (Capacitor.getPlatform() === "android") {
    return { x: clientX * dpr, y: clientY * dpr };
  }
  return { x: clientX, y: clientY };
}

export async function nativeOnScreenTap(
  clientX: number,
  clientY: number,
): Promise<boolean> {
  const pt = nativeViewPoint(clientX, clientY);
  const result = await NativeAr.onScreenTap(pt);
  return Boolean(result?.placed);
}

export async function nativeMoveScreen(
  clientX: number,
  clientY: number,
): Promise<boolean> {
  const pt = nativeViewPoint(clientX, clientY);
  const result = await NativeAr.moveScreen(pt);
  return result.moved;
}

export async function nativeRotate(dx: number, dy: number): Promise<void> {
  await NativeAr.rotate({ dx, dy });
}

export async function nativeSetScale(factor: number): Promise<void> {
  await NativeAr.setScale({ factor });
}

export async function nativeRecenter(): Promise<void> {
  await NativeAr.recenter();
}

export async function nativeReposition(): Promise<void> {
  await NativeAr.reposition();
}

export async function nativeDebugPlaceFront(): Promise<boolean> {
  const result = await NativeAr.debugPlaceFront({ withCube: false });
  return Boolean(result?.placed);
}

export { NativeAr };

/** Pick AR mode without slow I/O. */
export async function prepareArMode(): Promise<ArMode> {
  if (await isNativeArSupported()) return "native";
  if (await isWebXrArSupported()) return "webxr";
  if (isQuickLookSupported()) return "quicklook";
  if (canChromeHandoff()) return "chrome";
  return "orbit";
}

export async function prepareAr(): Promise<ArEnterResult> {
  return { ok: true, mode: await prepareArMode() };
}

export async function startWebXrAr(
  overlayRoot: HTMLElement,
): Promise<{ ok: true; session: XRSession } | { ok: false; error: string }> {
  try {
    const session = await requestWebXrSession(overlayRoot);
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: visitorError(e) };
  }
}

export async function exitAr(session: XRSession | null): Promise<void> {
  await endWebXrSession(session);
  await stopNativeAr();
}

export async function tryQuickLookAr(
  asset: PlacementAsset = loadSelectedAsset(),
): Promise<boolean> {
  if (!isQuickLookSupported()) return false;
  const label = ASSET_LABELS[asset] ?? ASSET_LABELS[DEFAULT_PLACEMENT_ASSET];
  return launchQuickLook(webModelUrl(asset), label);
}
