import * as THREE from 'three';
import { createReticle, placeAtHit, updateReticle } from './placement';
import { pickHitResult } from './hit-test';
import { AnchorManager } from '../scene/anchors';
import type { AppStateStore } from '../state/app-state';
import { saveSelectedAsset } from '../state/preferences';
import { assessWebXrCapability, formatSessionStartError } from './capabilities';

export interface ArSessionController {
  end: () => Promise<void>;
  clearAll: () => void;
}

export async function checkWebXrSupport(): Promise<boolean> {
  const capability = await assessWebXrCapability();
  return capability.ok;
}

export async function startArSession(
  store: AppStateStore,
  uiRoot: HTMLElement,
): Promise<ArSessionController> {
  const capability = await assessWebXrCapability();
  if (!capability.ok) {
    throw new Error(capability.body);
  }

  if (!navigator.xr) {
    throw new Error('WebXR not available');
  }

  let session: XRSession;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: [
        'dom-overlay',
        'plane-detection',
        'anchors',
        'light-estimation',
        'depth-sensing',
      ],
      domOverlay: { root: uiRoot },
    });
  } catch (error) {
    throw new Error(formatSessionStartError(error));
  }

  const anchorsSupported = session.enabledFeatures?.includes('anchors') ?? false;
  const depthSupported = session.enabledFeatures?.includes('depth-sensing') ?? false;
  const lightEstimation = session.enabledFeatures?.includes('light-estimation') ?? false;

  store.patch({
    phase: 'ar',
    trackingBanner: 'Move your phone to detect surfaces',
  });
  store.patchMetrics({
    depthSupported,
    lightEstimation,
    anchorsSupported,
  });

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));

  const anchorManager = new AnchorManager();
  const reticle = createReticle();
  scene.add(reticle);

  let hitTestSource: XRHitTestSource | null = null;

  let frameCount = 0;
  let lastFpsTime = performance.now();
  let fps = 0;

  const clearAll = () => {
    anchorManager.clear(scene);
    store.patch({ placedCount: 0 });
  };

  session.addEventListener('end', () => {
    clearAll();
    renderer.setAnimationLoop(null);
    hitTestSource?.cancel();
    renderer.dispose();
    renderer.domElement.remove();
    store.patch({
      phase: 'gate',
      trackingBanner: null,
      gateTitle: 'Native AR',
      gateBody: 'Session ended. Tap Start AR to try again.',
      gateActionLabel: 'Start AR',
      gateError: false,
    });
  });

  const onSelect = async () => {
    if (!hitTestSource || !reticle.visible) return;

    const frame = renderer.xr.getFrame();
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!frame || !referenceSpace) return;

    const results = frame.getHitTestResults(hitTestSource);
    const hit = pickHitResult(results, store.placementMode, referenceSpace);
    if (!hit) return;

    const group = await placeAtHit(
      hit,
      referenceSpace,
      scene,
      store.selectedAsset,
      anchorManager,
      anchorsSupported,
    );
    if (group) {
      store.patch({ placedCount: anchorManager.count, trackingBanner: null });
    }
  };

  session.addEventListener('select', onSelect);

  if (!session.requestHitTestSource) {
    await session.end();
    renderer.domElement.remove();
    renderer.dispose();
    throw new Error('Hit test is not supported in this WebXR session.');
  }

  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
  if (!hitTestSource) {
    await session.end();
    renderer.domElement.remove();
    renderer.dispose();
    throw new Error('Hit testing unavailable on this device');
  }

  const onFrame = (_time: number, frame: XRFrame) => {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    frameCount += 1;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
    }

    anchorManager.updateFromFrame(frame, referenceSpace);
    const hasValidHit = updateReticle(
      frame,
      referenceSpace,
      hitTestSource,
      reticle,
      store.placementMode,
    );

    const pose = frame.getViewerPose(referenceSpace);
    let cameraPosition = '—';
    let cameraQuaternion = '—';
    if (pose) {
      const pos = pose.transform.position;
      const ori = pose.transform.orientation;
      cameraPosition = `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
      cameraQuaternion = `${ori.x.toFixed(2)}, ${ori.y.toFixed(2)}, ${ori.z.toFixed(2)}, ${ori.w.toFixed(2)}`;
    }

    store.patchMetrics({
      fps,
      anchorCount: anchorManager.count,
      hasValidHit,
      cameraPosition,
      cameraQuaternion,
      placementMode: store.placementMode,
      selectedAsset: store.selectedAsset,
    });

    store.patch({
      placedCount: anchorManager.count,
      trackingBanner: hasValidHit ? null : 'Move your phone to detect surfaces',
    });

    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(onFrame);
  await renderer.xr.setSession(session);

  return {
    end: async () => {
      await session.end();
    },
    clearAll,
  };
}

export async function initGate(store: AppStateStore): Promise<void> {
  const capability = await assessWebXrCapability();
  if (!capability.ok) {
    store.patch({
      gateTitle: capability.title,
      gateBody: capability.body,
      gateActionLabel: null,
      gateError: true,
    });
    return;
  }

  store.patch({
    gateTitle: 'Native AR',
    gateBody: 'Tap to place objects on floors or walls using WebXR.',
    gateActionLabel: 'Start AR',
    gateError: false,
  });
}

export function bindStoreActions(
  store: AppStateStore,
  uiRoot: HTMLElement,
  getController: () => ArSessionController | null,
  setController: (controller: ArSessionController | null) => void,
): void {
  uiRoot.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>('[data-action]');
    const action = actionEl?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'start-ar': {
        if (store.phase === 'ar') return;
        const button = actionEl as HTMLButtonElement;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
          const controller = await startArSession(store, uiRoot);
          setController(controller);
        } catch (error) {
          store.patch({
            gateTitle: 'Could not start AR',
            gateBody: formatSessionStartError(error),
            gateActionLabel: 'Try again',
            gateError: true,
            phase: 'gate',
          });
        } finally {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
        break;
      }
      case 'exit-ar': {
        const controller = getController();
        if (!controller) return;
        const button = actionEl as HTMLButtonElement;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        try {
          await controller.end();
          setController(null);
        } finally {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
        break;
      }
      case 'mode-floor':
        store.patch({ placementMode: 'floor' });
        break;
      case 'mode-wall':
        store.patch({ placementMode: 'wall' });
        break;
      case 'pick-model':
        store.patch({ showModelPicker: true });
        break;
      case 'close-picker':
        if (!target.closest('.picker__item')) {
          store.patch({ showModelPicker: false });
        }
        break;
      case 'toggle-debug':
        store.patch({ debugEnabled: !store.debugEnabled });
        break;
      case 'clear-all': {
        const controller = getController();
        if (!controller || store.isClearing || store.placedCount === 0) return;
        store.patch({ isClearing: true });
        controller.clearAll();
        await new Promise((resolve) => setTimeout(resolve, 250));
        store.patch({ isClearing: false });
        break;
      }
      default:
        if (action.startsWith('asset-')) {
          const asset = action.replace('asset-', '') as typeof store.selectedAsset;
          store.patch({ selectedAsset: asset, showModelPicker: false });
          saveSelectedAsset(asset);
        }
        break;
    }
  });
}
