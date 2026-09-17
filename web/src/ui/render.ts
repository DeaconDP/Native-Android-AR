import type { AppState } from "../state/app-state";
import { ASSET_LABELS, PLACEMENT_ASSETS } from "../state/catalog";
import { renderLearnSheet } from "./learn-sheet";

let hudElement: HTMLElement | null = null;
let countElement: HTMLElement | null = null;
let bannerElement: HTMLElement | null = null;
let hintElement: HTMLElement | null = null;
let errorElement: HTMLElement | null = null;
let clearButton: HTMLButtonElement | null = null;
let startButton: HTMLButtonElement | null = null;

function structuralKey(state: AppState): string {
  return JSON.stringify({
    phase: state.phase,
    arMode: state.arMode,
    placementMode: state.placementMode,
    selectedAsset: state.selectedAsset,
    debugEnabled: state.debugEnabled,
    showModelPicker: state.showModelPicker,
    showLearn: state.showLearn,
    learnTopicId: state.learnTopicId,
    gateTitle: state.gateTitle,
    gateBody: state.gateBody,
    gateActionLabel: state.gateActionLabel,
    gateError: state.gateError,
    isClearing: state.isClearing,
    isStarting: state.isStarting,
  });
}

export function renderApp(root: HTMLElement, state: AppState, force = false): void {
  const key = structuralKey(state);
  if (force || root.dataset.structuralKey !== key) {
    root.dataset.structuralKey = key;
    mountStructure(root, state);
  }
  updateLiveRegions(state);
}

function mountStructure(root: HTMLElement, state: AppState): void {
  const inAr = state.phase === "ar";
  const showGate = !inAr;
  const existingStage = root.querySelector(".ar-stage");

  root.innerHTML = `
    <div class="app ${inAr ? "app--ar" : ""} ${state.arMode === "native" ? "app--native" : ""}">
      ${showGate ? renderGate(state) : ""}
      ${inAr ? renderArChrome(state) : ""}
      ${state.showModelPicker ? renderModelPicker(state) : ""}
      ${state.showLearn ? renderLearnSheet(state.learnTopicId, state.arMode, state.metrics.arMode, state.phase) : ""}
    </div>
  `;

  if (existingStage && inAr) {
    root.appendChild(existingStage);
  }

  hudElement = root.querySelector(".debug-hud");
  countElement = root.querySelector('[data-live="placed-count"]');
  bannerElement = root.querySelector('[data-live="banner"]');
  hintElement = root.querySelector('[data-live="hint"]');
  errorElement = root.querySelector('[data-live="session-error"]');
  clearButton = root.querySelector('[data-action="clear-all"]');
  startButton = root.querySelector('[data-action="start-ar"]');
  updateLiveRegions(state);
}

function updateLiveRegions(state: AppState): void {
  if (countElement) {
    countElement.textContent = `${state.placedCount} placed`;
  }

  if (clearButton) {
    clearButton.disabled = state.placedCount === 0 || state.isClearing;
    clearButton.setAttribute("aria-busy", String(state.isClearing));
    clearButton.textContent = state.isClearing ? "Clearing…" : "Clear / Reposition";
  }

  if (startButton) {
    startButton.disabled = state.isStarting;
    startButton.setAttribute("aria-busy", String(state.isStarting));
    startButton.textContent = state.isStarting
      ? "Starting..."
      : (state.gateActionLabel ?? "Start AR");
  }

  if (bannerElement) {
    if (state.trackingBanner) {
      bannerElement.hidden = false;
      bannerElement.textContent = state.trackingBanner;
    } else {
      bannerElement.hidden = true;
    }
  }

  if (hintElement) {
    hintElement.textContent = state.sessionHint ?? "";
    hintElement.hidden = !state.sessionHint;
  }

  if (errorElement) {
    errorElement.textContent = state.sessionError ?? "";
    errorElement.hidden = !state.sessionError;
  }

  if (hudElement && state.debugEnabled) {
    hudElement.innerHTML = `
      ${hudLine("Mode", state.metrics.arMode ?? "—")}
      ${hudLine("FPS", state.metrics.fps.toFixed(1))}
      ${hudLine("Anchors", String(state.metrics.anchorCount))}
      ${hudLine("Surface", state.surfaceReady ? "ready" : "scanning")}
      ${hudLine("Hit", state.metrics.hasValidHit ? "yes" : "no")}
      ${hudLine("Pose", state.metrics.cameraPosition)}
      ${hudLine("Asset", ASSET_LABELS[state.metrics.selectedAsset])}
    `;
  }
}

const BRAND_NAME = "Deez-Native AR";

function renderGate(state: AppState): string {
  const primary = state.gateActionLabel
    ? `<button type="button" class="btn btn--primary" data-action="start-ar" ${state.isStarting ? "disabled" : ""}>${escapeHtml(state.isStarting ? "Starting..." : state.gateActionLabel)}</button>`
    : "";
  const situational =
    state.gateTitle && state.gateTitle !== BRAND_NAME
      ? `<p class="gate__status">${escapeHtml(state.gateTitle)}</p>`
      : "";

  return `
    <section class="gate" aria-live="polite">
      <div class="gate__card">
        <img class="gate__seal" src="/brand/deez-native-seal.svg" width="120" height="120" alt="" decoding="async" />
        <h1 class="gate__brand">${BRAND_NAME}</h1>
        ${situational}
        <p class="gate__body ${state.gateError ? "gate__body--error" : ""}">${escapeHtml(state.gateBody)}</p>
        <div class="gate__actions">
          ${primary}
          <button type="button" class="btn btn--secondary" data-action="pick-model">Model · ${escapeHtml(ASSET_LABELS[state.selectedAsset])}</button>
          <button type="button" class="btn btn--secondary" data-action="open-learn">How it works</button>
        </div>
      </div>
    </section>
  `;
}

function renderArChrome(state: AppState): string {
  const debugHud = state.debugEnabled
    ? `<aside class="debug-hud" aria-label="Debug HUD"></aside>`
    : "";
  const cameraAr = state.arMode === "native" || state.arMode === "webxr";
  const nativeDebug =
    state.arMode === "native" && state.debugEnabled
      ? `<button type="button" class="btn btn--secondary" data-session-action="debug-place">Debug place</button>`
      : "";

  return `
    <div class="banner" data-live="banner" role="status" ${state.trackingBanner ? "" : "hidden"}>${escapeHtml(state.trackingBanner ?? "")}</div>
    <p class="ar-hint" data-live="hint" ${state.sessionHint ? "" : "hidden"}>${escapeHtml(state.sessionHint ?? "")}</p>
    <p class="ar-error" data-live="session-error" role="alert" ${state.sessionError ? "" : "hidden"}>${escapeHtml(state.sessionError ?? "")}</p>
    ${debugHud}
    <footer class="controls">
      <div class="controls__row controls__row--meta">
        <span class="controls__count" data-live="placed-count">${state.placedCount} placed</span>
        <div class="controls__meta-actions">
          <button type="button" class="btn btn--ghost btn--compact" data-action="open-learn">Learn</button>
          <button type="button" class="icon-btn" data-action="toggle-debug" aria-label="Settings / debug" title="Settings">
          ${cogIcon(state.debugEnabled)}
        </button>
        </div>
      </div>
      ${
        cameraAr
          ? `<div class="controls__row">
        <button type="button" class="btn btn--secondary" data-session-action="reposition">Reposition</button>
        <button type="button" class="btn btn--secondary" data-session-action="recenter">Recentre</button>
      </div>`
          : ""
      }
      <div class="controls__row">
        <button type="button" class="btn btn--secondary" data-action="pick-model">Model</button>
        <button type="button" class="btn btn--secondary" data-action="clear-all">Clear / Reposition</button>
        ${nativeDebug}
      </div>
      <div class="controls__row">
        <button type="button" class="btn btn--secondary" data-action="exit-ar" data-session-action="exit">Exit AR</button>
      </div>
      <p class="controls__asset">${escapeHtml(ASSET_LABELS[state.selectedAsset])} · ${escapeHtml(state.arMode ?? "—")}</p>
    </footer>
  `;
}

function renderModelPicker(state: AppState): string {
  const items = PLACEMENT_ASSETS.map(
    (asset) => `
        <button type="button" class="picker__item ${state.selectedAsset === asset.id ? "picker__item--active" : ""}" data-action="asset-${asset.id}">
          <span class="picker__label">${escapeHtml(asset.label)}</span>
          <span class="picker__meta">${escapeHtml(asset.credit)}</span>
        </button>
      `,
  ).join("");

  return `
    <div class="picker-backdrop" data-action="close-picker">
      <section class="picker" role="dialog" aria-label="Choose object">
        <header class="picker__header">
          <h2>Choose object</h2>
          <button type="button" class="icon-btn" data-action="close-picker" aria-label="Close">✕</button>
        </header>
        <div class="picker__list">${items}</div>
      </section>
    </div>
  `;
}

function hudLine(label: string, value: string): string {
  return `<div class="debug-hud__line"><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`;
}

function cogIcon(active: boolean): string {
  const color = active ? "#3dd6f5" : "#8b949e";
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.36-.22.65-.5.9-.82l.9.34a1 1 0 0 0 1.26-.63l.3-1a1 1 0 0 0-.57-1.22l-.86-.4c.03-.28.05-.56.05-.84s-.02-.56-.05-.84l.86-.4a1 1 0 0 0 .57-1.22l-.3-1a1 1 0 0 0-1.26-.63l-.9.34c-.25-.32-.54-.6-.9-.82l.16-.94A1 1 0 0 0 17.1 2h-1.2a1 1 0 0 0-.98.8l-.16.94c-.4.1-.77.27-1.12.48l-.9-.34a1 1 0 0 0-1.26.63l-.3 1a1 1 0 0 0 .57 1.22l.86.4c-.03.28-.05.56-.05.84s.02.56.05.84l-.86.4a1 1 0 0 0-.57 1.22l.3 1a1 1 0 0 0 1.26.63l.9-.34c.35.21.72.38 1.12.48l.16.94a1 1 0 0 0 .98.8h1.2a1 1 0 0 0 .98-.8l.16-.94Z"/>
    </svg>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mountUi(
  root: HTMLElement,
  subscribe: (listener: (state: AppState) => void) => () => void,
): void {
  subscribe((state) => renderApp(root, state));
}
