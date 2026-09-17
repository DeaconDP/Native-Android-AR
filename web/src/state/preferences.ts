import {
  DEFAULT_PLACEMENT_ASSET,
  isPlacementAsset,
  type PlacementAsset,
} from "./catalog";

export type { PlacementAsset } from "./catalog";
export { ASSET_LABELS, DEFAULT_PLACEMENT_ASSET } from "./catalog";

export type PlacementMode = "floor" | "wall";

const ASSET_KEY = "native_ar_placement_asset";

export function loadSelectedAsset(): PlacementAsset {
  const stored = localStorage.getItem(ASSET_KEY);
  if (stored && isPlacementAsset(stored)) {
    return stored;
  }
  return DEFAULT_PLACEMENT_ASSET;
}

export function saveSelectedAsset(asset: PlacementAsset): void {
  localStorage.setItem(ASSET_KEY, asset);
}
