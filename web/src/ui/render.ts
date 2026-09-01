import type { AppState } from '../state/app-state';
import { ASSET_LABELS } from '../state/preferences';

let hudElement: HTMLElement | null = null;
let countElement: HTMLElement | null = null;
let bannerElement: HTMLElement | null = null;
let clearButton: HTMLButtonElement | null = null;

function structuralKey(state: AppState): string {
  return JSON.stringify({
    phase: state.phase,
    placementMode: state.placementMode,
    selectedAsset: state.selectedAsset,
    debugEnabled: state.debugEnabled,
    showModelPicker: state.showModelPicker,
    gateTitle: state.gateTitle,
    gateBody: state.gateBody,
    gateActionLabel: state.gateActionLabel,
    gateError: state.gateError,
    isClearing: state.isClearing,
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
  const inAr = state.phase === 'ar';
  const showGate = !inAr;

  root.innerHTML = `
    <div class="app ${inAr ? 'app--ar' : ''}">
      ${showGate ? renderGate(state) : ''}
      ${inAr ? renderArChrome(state) : ''}
      ${state.showModelPicker ? renderModelPicker(state) : ''}
    </div>
  `;

  hudElement = root.querySelector('.debug-hud');
  countElement = root.querySelector('[data-live="placed-count"]');
  bannerElement = root.querySelector('[data-live="banner"]');
  clearButton = root.querySelector('[data-action="clear-all"]');
  updateLiveRegions(state);
}

function updateLiveRegions(state: AppState): void {
  if (countElement) {
    countElement.textContent = `${state.placedCount} placed`;
  }

  if (clearButton) {
    clearButton.disabled = state.placedCount === 0 || state.isClearing;
    clearButton.setAttribute('aria-busy', String(state.isClearing));
    clearButton.textContent = state.isClearing ? 'Clearing…' : 'Clear all';
  }

  if (bannerElement) {
    if (state.trackingBanner) {
      bannerElement.hidden = false;
      bannerElement.textContent = state.trackingBanner;
    } else {
      bannerElement.hidden = true;
    }
  }

  if (hudElement && state.debugEnabled) {
    hudElement.innerHTML = `
      ${hudLine('FPS', state.metrics.fps.toFixed(1))}
      ${hudLine('Anchors', String(state.metrics.anchorCount))}
      ${hudLine('Hit', state.metrics.hasValidHit ? 'yes' : 'no')}
      ${hudLine('Pose', state.metrics.cameraPosition)}
      ${hudLine('Rot', state.metrics.cameraQuaternion)}
      ${hudLine('Depth', state.metrics.depthSupported ? 'yes' : 'no')}
      ${hudLine('Light', state.metrics.lightEstimation ? 'yes' : 'no')}
      ${hudLine('Anchors API', state.metrics.anchorsSupported ? 'yes' : 'no')}
      ${hudLine('Mode', state.metrics.placementMode)}
      ${hudLine('Asset', ASSET_LABELS[state.metrics.selectedAsset])}
      ${hudLine('Point cloud', 'N/A')}
      ${hudLine('Depth mesh', state.metrics.depthSupported ? 'partial' : 'N/A')}
    `;
  }
}

function renderGate(state: AppState): string {
  const action = state.gateActionLabel
    ? `<button type="button" class="btn btn--primary" data-action="start-ar">${escapeHtml(state.gateActionLabel)}</button>`
    : '';

  return `
    <section class="gate" aria-live="polite">
      <div class="gate__card">
        <h1 class="gate__title">${escapeHtml(state.gateTitle)}</h1>
        <p class="gate__body ${state.gateError ? 'gate__body--error' : ''}">${escapeHtml(state.gateBody)}</p>
        ${action}
      </div>
    </section>
  `;
}

function renderArChrome(state: AppState): string {
  const debugHud = state.debugEnabled
    ? `<aside class="debug-hud" aria-label="Debug HUD"></aside>`
    : '';

  return `
    <div class="banner" data-live="banner" role="status" ${state.trackingBanner ? '' : 'hidden'}>${escapeHtml(state.trackingBanner ?? '')}</div>
    ${debugHud}
    <footer class="controls">
      <div class="controls__row controls__row--meta">
        <span class="controls__count" data-live="placed-count">${state.placedCount} placed</span>
        <button type="button" class="icon-btn" data-action="toggle-debug" aria-label="Debug HUD" title="Debug HUD">
          ${cogIcon(state.debugEnabled)}
        </button>
      </div>
      <div class="controls__row">
        <button type="button" class="chip ${state.placementMode === 'floor' ? 'chip--active' : ''}" data-action="mode-floor">Floor</button>
        <button type="button" class="chip ${state.placementMode === 'wall' ? 'chip--active' : ''}" data-action="mode-wall">Wall</button>
      </div>
      <div class="controls__row">
        <button type="button" class="btn btn--secondary" data-action="pick-model">Model</button>
        <button type="button" class="btn btn--secondary" data-action="clear-all">Clear all</button>
      </div>
      <div class="controls__row">
        <button type="button" class="btn btn--secondary" data-action="exit-ar">Exit AR</button>
      </div>
      <p class="controls__asset">${escapeHtml(ASSET_LABELS[state.selectedAsset])}</p>
      <p class="controls__hint">Tap to place</p>
    </footer>
  `;
}

function renderModelPicker(state: AppState): string {
  const assets = Object.entries(ASSET_LABELS) as [keyof typeof ASSET_LABELS, string][];
  const items = assets
    .map(
      ([key, label]) => `
        <button type="button" class="picker__item ${state.selectedAsset === key ? 'picker__item--active' : ''}" data-action="asset-${key}">
          ${escapeHtml(label)}
        </button>
      `,
    )
    .join('');

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
  const color = active ? '#3dd6f5' : '#8b949e';
  return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53.75.43a1 1 0 0 0 1.32-.43l.66-1.14a1 1 0 0 0-.25-1.28l-.74-.56a7.03 7.03 0 0 0 0-1.37l.74-.56a1 1 0 0 0 .25-1.28l-.66-1.14a1 1 0 0 0-1.32-.43l-.75.43a6.87 6.87 0 0 0-1.19-.69l-.11-.79A1 1 0 0 0 14 2h-1.33a1 1 0 0 0-.99.86l-.11.79a6.87 6.87 0 0 0-1.19.69l-.75-.43a1 1 0 0 0-1.32.43l-.66 1.14a1 1 0 0 0 .25 1.28l.74.56a7.03 7.03 0 0 0 0 1.37l-.74.56a1 1 0 0 0-.25 1.28l.66 1.14a1 1 0 0 0 1.32.43l.75-.43c.37.27.77.5 1.19.69l.11.79a1 1 0 0 0 .99.86H14a1 1 0 0 0 .99-.86l.11-.79c.42-.19.82-.42 1.19-.69Z"/>
    </svg>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function mountUi(root: HTMLElement, subscribe: (listener: (state: AppState) => void) => () => void): void {
  subscribe((state) => renderApp(root, state));
}
