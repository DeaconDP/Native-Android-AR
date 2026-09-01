import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PlacementAsset } from '../state/preferences';

const gltfLoader = new GLTFLoader();
let helmetTemplate: THREE.Group | null = null;

async function loadHelmetTemplate(): Promise<THREE.Group> {
  if (helmetTemplate) {
    return helmetTemplate.clone(true);
  }

  const gltf = await gltfLoader.loadAsync('/models/helmet.glb');
  helmetTemplate = gltf.scene;
  helmetTemplate.scale.setScalar(0.25);
  return helmetTemplate.clone(true);
}

function createPrimitive(asset: PlacementAsset): THREE.Object3D {
  switch (asset) {
    case 'cube': {
      const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const material = new THREE.MeshStandardMaterial({ color: 0x3dd6f5 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.06;
      return mesh;
    }
    case 'sphere': {
      const geometry = new THREE.SphereGeometry(0.08, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: 0xff7b72 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.08;
      return mesh;
    }
    case 'cylinder': {
      const geometry = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 32);
      const material = new THREE.MeshStandardMaterial({ color: 0x7ee787 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0.08;
      return mesh;
    }
    default:
      throw new Error(`Unknown primitive asset: ${asset}`);
  }
}

export async function createPlacementObject(asset: PlacementAsset): Promise<THREE.Object3D> {
  if (asset === 'helmet') {
    return loadHelmetTemplate();
  }
  return createPrimitive(asset);
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
