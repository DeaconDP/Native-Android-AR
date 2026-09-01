import * as THREE from 'three';
import { disposeObject } from './assets';

export interface PlacedAnchor {
  id: string;
  anchor: XRAnchor | null;
  group: THREE.Group;
  object: THREE.Object3D;
}

export class AnchorManager {
  private readonly placed: PlacedAnchor[] = [];
  private idCounter = 0;

  get count(): number {
    return this.placed.length;
  }

  get groups(): THREE.Group[] {
    return this.placed.map((entry) => entry.group);
  }

  add(anchor: XRAnchor, object: THREE.Object3D): PlacedAnchor {
    const group = new THREE.Group();
    group.add(object);
    const entry: PlacedAnchor = {
      id: `anchor-${++this.idCounter}`,
      anchor,
      group,
      object,
    };
    this.placed.push(entry);
    return entry;
  }

  addFree(group: THREE.Group, object: THREE.Object3D): PlacedAnchor {
    const entry: PlacedAnchor = {
      id: `free-${++this.idCounter}`,
      anchor: null,
      group,
      object,
    };
    this.placed.push(entry);
    return entry;
  }

  clear(scene: THREE.Scene): void {
    for (const entry of this.placed) {
      scene.remove(entry.group);
      disposeObject(entry.object);
      entry.anchor?.delete();
    }
    this.placed.length = 0;
  }

  updateFromFrame(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    for (const entry of this.placed) {
      if (!entry.anchor) continue;
      const pose = frame.getPose(entry.anchor.anchorSpace, referenceSpace);
      if (!pose) continue;
      entry.group.matrix.fromArray(pose.transform.matrix);
      entry.group.matrixAutoUpdate = false;
    }
  }
}
