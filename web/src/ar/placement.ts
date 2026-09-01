import * as THREE from 'three';
import { pickHitResult } from './hit-test';
import { createPlacementObject } from '../scene/assets';
import { AnchorManager } from '../scene/anchors';
import type { PlacementMode } from '../state/preferences';

export function createReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x3dd6f5,
    opacity: 0.85,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

export async function placeAtHit(
  hitResult: XRHitTestResult,
  referenceSpace: XRReferenceSpace,
  scene: THREE.Scene,
  asset: Parameters<typeof createPlacementObject>[0],
  anchorManager: AnchorManager,
  anchorsSupported: boolean,
): Promise<THREE.Group | null> {
  if (anchorsSupported && hitResult.createAnchor) {
    try {
      const anchor = await hitResult.createAnchor();
      const object = await createPlacementObject(asset);
      const entry = anchorManager.add(anchor, object);
      scene.add(entry.group);
      return entry.group;
    } catch {
      // Fall through to pose-only placement.
    }
  }

  const pose = hitResult.getPose(referenceSpace);
  if (!pose) return null;

  const object = await createPlacementObject(asset);
  const group = new THREE.Group();
  group.matrix.fromArray(pose.transform.matrix);
  group.matrixAutoUpdate = false;
  group.add(object);
  scene.add(group);
  anchorManager.addFree(group, object);
  return group;
}

export function updateReticle(
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  hitTestSource: XRHitTestSource | null,
  reticle: THREE.Mesh,
  placementMode: PlacementMode,
): boolean {
  if (!hitTestSource) {
    reticle.visible = false;
    return false;
  }

  const results = frame.getHitTestResults(hitTestSource);
  const hit = pickHitResult(results, placementMode, referenceSpace);
  if (!hit) {
    reticle.visible = false;
    return false;
  }

  const pose = hit.getPose(referenceSpace);
  if (!pose) {
    reticle.visible = false;
    return false;
  }

  reticle.visible = true;
  reticle.matrix.fromArray(pose.transform.matrix);
  return true;
}
