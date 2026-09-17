import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { USDZExporter } from "three/examples/jsm/exporters/USDZExporter.js";

/**
 * iOS Safari has no WebXR AR — `<a rel="ar">` launches AR Quick Look.
 */
export function isQuickLookSupported(): boolean {
  const a = document.createElement("a");
  return Boolean(a.relList?.supports?.("ar"));
}

async function loadModel(modelUrl: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelUrl);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const target = 0.28;
  root.scale.multiplyScalar(target / maxDim);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = box2.getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.position.y -= box2.min.y - root.position.y;
  return root;
}

/**
 * Export GLB → USDZ blob and open AR Quick Look (must run in user gesture).
 */
export async function launchQuickLook(
  modelUrl: string,
  label: string,
): Promise<boolean> {
  if (!isQuickLookSupported()) return false;

  const scene = new THREE.Scene();
  try {
    scene.add(await loadModel(modelUrl));
  } catch {
    return false;
  }

  const exporter = new USDZExporter();
  let data: Uint8Array;
  try {
    data = await exporter.parseAsync(scene, {
      quickLookCompatible: true,
      ar: {
        anchoring: { type: "plane" },
        planeAnchoring: { alignment: "horizontal" },
      },
    });
  } catch {
    return false;
  }

  const bytes = new Uint8Array(data);
  const blob = new Blob([bytes.buffer], { type: "model/vnd.usdz+zip" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = url;
  const img = document.createElement("img");
  img.alt = label;
  img.width = 1;
  img.height = 1;
  img.style.position = "absolute";
  img.style.width = "1px";
  img.style.height = "1px";
  img.style.opacity = "0";
  img.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  anchor.appendChild(img);
  anchor.style.position = "fixed";
  anchor.style.left = "-9999px";
  document.body.appendChild(anchor);

  try {
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 60_000);
  }
}
