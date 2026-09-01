export type PlacementAsset = 'helmet' | 'cube' | 'sphere' | 'cylinder';

export type PlacementMode = 'floor' | 'wall';

const ASSET_KEY = 'native_ar_placement_asset';

export const ASSET_LABELS: Record<PlacementAsset, string> = {
  helmet: 'Helmet (GLB)',
  cube: 'Cube',
  sphere: 'Sphere',
  cylinder: 'Cylinder',
};

export function loadSelectedAsset(): PlacementAsset {
  const stored = localStorage.getItem(ASSET_KEY);
  if (stored === 'helmet' || stored === 'cube' || stored === 'sphere' || stored === 'cylinder') {
    return stored;
  }
  return 'helmet';
}

export function saveSelectedAsset(asset: PlacementAsset): void {
  localStorage.setItem(ASSET_KEY, asset);
}
