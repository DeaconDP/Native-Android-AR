import './styles.css';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import { bindStoreActions, initGate } from './ar/session';
import { createAppState } from './state/app-state';
import { loadSelectedAsset } from './state/preferences';
import { mountUi } from './ui/render';
import type { ArSessionController } from './ar/session';

/** Cap ships bundled assets — SW precache often keeps a stale UI after installDebug. */
async function clearNativeServiceWorkers(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function registerWebServiceWorker(): void {
  if (Capacitor.isNativePlatform()) return;
  registerSW({ immediate: true });
}

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
  throw new Error('Missing #ui-root');
}

const store = createAppState(loadSelectedAsset());
let controller: ArSessionController | null = null;

mountUi(uiRoot, store.subscribe);
bindStoreActions(
  store,
  uiRoot,
  () => controller,
  (next) => {
    controller = next;
  },
);

void (async () => {
  await clearNativeServiceWorkers();
  registerWebServiceWorker();
  await initGate(store);
})();
