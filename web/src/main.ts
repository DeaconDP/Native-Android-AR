import './styles.css';
import { bindStoreActions, initGate } from './ar/session';
import { createAppState } from './state/app-state';
import { loadSelectedAsset } from './state/preferences';
import { mountUi } from './ui/render';
import type { ArSessionController } from './ar/session';

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

void initGate(store);
