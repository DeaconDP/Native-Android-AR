/**
 * Placement models — Kenney CC0 furniture/nature + Khronos Duck + a teaching cube.
 * Native Filament loads `models/ar/<id>.glb`; browser paths use `models/<id>.glb`.
 */
export type PlacementAsset =
  | "chair"
  | "plant"
  | "sofa"
  | "table"
  | "lamp"
  | "cactus"
  | "mushroom"
  | "flower"
  | "duck"
  | "rock"
  | "cube";

export type AssetKind = "glb" | "primitive";

export interface PlacementAssetDef {
  id: PlacementAsset;
  label: string;
  kind: AssetKind;
  /** Filename under web/public/models/ (and models/ar/ when kind is glb). */
  file?: string;
  license: string;
  credit: string;
}

export const PLACEMENT_ASSETS: readonly PlacementAssetDef[] = [
  {
    id: "chair",
    label: "Chair",
    kind: "glb",
    file: "chair.glb",
    license: "CC0",
    credit: "Kenney.nl Furniture Kit",
  },
  {
    id: "plant",
    label: "Potted plant",
    kind: "glb",
    file: "plant.glb",
    license: "CC0",
    credit: "Kenney.nl Furniture Kit",
  },
  {
    id: "sofa",
    label: "Sofa",
    kind: "glb",
    file: "sofa.glb",
    license: "CC0",
    credit: "Kenney.nl Furniture Kit",
  },
  {
    id: "table",
    label: "Coffee table",
    kind: "glb",
    file: "table.glb",
    license: "CC0",
    credit: "Kenney.nl Furniture Kit",
  },
  {
    id: "lamp",
    label: "Floor lamp",
    kind: "glb",
    file: "lamp.glb",
    license: "CC0",
    credit: "Kenney.nl Furniture Kit",
  },
  {
    id: "cactus",
    label: "Cactus",
    kind: "glb",
    file: "cactus.glb",
    license: "CC0",
    credit: "Kenney.nl Nature Kit",
  },
  {
    id: "mushroom",
    label: "Mushroom",
    kind: "glb",
    file: "mushroom.glb",
    license: "CC0",
    credit: "Kenney.nl Nature Kit",
  },
  {
    id: "flower",
    label: "Flower",
    kind: "glb",
    file: "flower.glb",
    license: "CC0",
    credit: "Kenney.nl Nature Kit",
  },
  {
    id: "duck",
    label: "Duck",
    kind: "glb",
    file: "duck.glb",
    license: "CC0 / Public Domain",
    credit: "Khronos glTF Sample Models (Blender Duck)",
  },
  {
    id: "rock",
    label: "Rock",
    kind: "glb",
    file: "rock.glb",
    license: "CC0",
    credit: "Kenney.nl Nature Kit",
  },
  {
    id: "cube",
    label: "Cube",
    kind: "glb",
    file: "cube.glb",
    license: "CC0",
    credit: "Generated teaching primitive",
  },
] as const;

export const DEFAULT_PLACEMENT_ASSET: PlacementAsset = "duck";

export const ASSET_LABELS: Record<PlacementAsset, string> = Object.fromEntries(
  PLACEMENT_ASSETS.map((a) => [a.id, a.label]),
) as Record<PlacementAsset, string>;

const byId = new Map(PLACEMENT_ASSETS.map((a) => [a.id, a]));

export function isPlacementAsset(value: string): value is PlacementAsset {
  return byId.has(value as PlacementAsset);
}

export function getAssetDef(id: PlacementAsset): PlacementAssetDef {
  return byId.get(id)!;
}

/** Browser / Quick Look URL (leading slash). */
export function webModelUrlFor(id: PlacementAsset): string {
  const def = getAssetDef(id);
  return `/models/${def.file ?? `${id}.glb`}`;
}

/** Capacitor asset path for native Filament / ARKit (no leading slash). */
export function nativeModelPathFor(id: PlacementAsset): string {
  const def = getAssetDef(id);
  const file = def.file ?? `${id}.glb`;
  return `models/ar/${file}`;
}
