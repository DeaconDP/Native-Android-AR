import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  getAssetDef,
  webModelUrlFor,
  type PlacementAsset,
} from "../state/catalog";

const gltfLoader = new GLTFLoader();
const templateCache = new Map<string, THREE.Group>();

async function loadGlbTemplate(url: string): Promise<THREE.Group> {
  const cached = templateCache.get(url);
  if (cached) {
    return cached.clone(true);
  }
  const gltf = await gltfLoader.loadAsync(url);
  const template = gltf.scene;
  const box = new THREE.Box3().setFromObject(template);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  template.position.sub(center);
  template.scale.setScalar(0.28 / size);
  templateCache.set(url, template);
  return template.clone(true);
}

export async function createPlacementObject(
  asset: PlacementAsset,
): Promise<THREE.Object3D> {
  const def = getAssetDef(asset);
  if (def.kind !== "glb") {
    throw new Error(`Unsupported asset kind for ${asset}`);
  }
  return loadGlbTemplate(webModelUrlFor(asset));
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
