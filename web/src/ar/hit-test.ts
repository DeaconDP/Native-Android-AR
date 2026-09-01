import type { PlacementMode } from '../state/preferences';

export function normalMatchesPlacementMode(
  normal: { x: number; y: number; z: number },
  mode: PlacementMode,
): boolean {
  const absY = Math.abs(normal.y);
  if (mode === 'floor') {
    return absY > 0.7;
  }
  return absY < 0.3;
}

function hitPoseNormal(
  result: XRHitTestResult,
  referenceSpace: XRReferenceSpace,
): { x: number; y: number; z: number } | null {
  const pose = result.getPose(referenceSpace);
  if (!pose) return null;

  const matrix = pose.transform.matrix;
  const normalX = matrix[4];
  const normalY = matrix[5];
  const normalZ = matrix[6];
  const length = Math.hypot(normalX, normalY, normalZ) || 1;
  return {
    x: normalX / length,
    y: normalY / length,
    z: normalZ / length,
  };
}

/**
 * Prefer a hit matching floor/wall mode; fall back to the first hit with a pose
 * so early tracking still shows a reticle (Cube AR pattern).
 */
export function pickHitResult(
  results: XRHitTestResult[],
  mode: PlacementMode,
  referenceSpace: XRReferenceSpace,
): XRHitTestResult | null {
  let firstWithPose: XRHitTestResult | null = null;

  for (const result of results) {
    const normal = hitPoseNormal(result, referenceSpace);
    if (!normal) continue;

    if (!firstWithPose) {
      firstWithPose = result;
    }

    if (normalMatchesPlacementMode(normal, mode)) {
      return result;
    }
  }

  return firstWithPose;
}
