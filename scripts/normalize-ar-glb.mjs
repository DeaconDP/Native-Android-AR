/**
 * Normalize AR GLBs for Filament/SceneView under fixed directional light.
 *
 * Usage:
 *   node scripts/normalize-ar-glb.mjs              # all catalog sources
 *   node scripts/normalize-ar-glb.mjs [in] [out]   # single file
 *
 * Keeps textures and PBR factors on textured models. Softens extreme
 * emissive and near-mirror roughness so unlit Filament still reads detail.
 * Bare (untextured) materials get a matte dielectric fallback.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  center,
  flatten,
  getBounds,
  unpartition,
} from "@gltf-transform/functions";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = path.join(ROOT, "web", "public", "models");
const AR_DIR = path.join(MODELS_DIR, "ar");

/** Source GLBs that ship in the picker (exclude legacy samples). */
const CATALOG_FILES = [
  "chair.glb",
  "plant.glb",
  "sofa.glb",
  "table.glb",
  "lamp.glb",
  "cactus.glb",
  "mushroom.glb",
  "flower.glb",
  "duck.glb",
  "rock.glb",
  "cube.glb",
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

async function normalizeOne(input, output) {
  const document = await io.read(input);
  const root = document.getRoot();

  await document.transform(unpartition(), flatten(), center({ pivot: "center" }));

  const scene = root.getDefaultScene() || root.listScenes()[0];
  if (scene) {
    const { min, max } = getBounds(scene);
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const maxDim = Math.max(...size);
    if (Number.isFinite(maxDim) && maxDim > 1e-6) {
      const s = 1 / maxDim;
      for (const node of root.listNodes()) {
        if (node.getMesh()) {
          const cur = node.getScale();
          node.setScale([cur[0] * s, cur[1] * s, cur[2] * s]);
        }
      }
      await document.transform(flatten(), center({ pivot: "center" }));
    }
  }

  for (const mat of root.listMaterials()) {
    const textured = !!mat.getBaseColorTexture();
    const em = mat.getEmissiveFactor();
    const emMax = Math.max(em[0], em[1], em[2]);
    if (emMax > 0.25) {
      mat.setEmissiveFactor([
        clamp01(em[0] * 0.05),
        clamp01(em[1] * 0.05),
        clamp01(em[2] * 0.05),
      ]);
    }
    if (!textured) {
      mat.setMetallicFactor(0);
      if (mat.getRoughnessFactor() < 0.35) {
        mat.setRoughnessFactor(0.65);
      }
    } else if (
      mat.getRoughnessFactor() < 0.2 &&
      !mat.getMetallicRoughnessTexture()
    ) {
      mat.setRoughnessFactor(0.35);
    }
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await io.write(output, document);
  console.log(
    `Normalized ${path.relative(ROOT, input)} → ${path.relative(ROOT, output)}`,
  );
}

async function normalizeCatalog() {
  for (const file of CATALOG_FILES) {
    const input = path.join(MODELS_DIR, file);
    if (!fs.existsSync(input)) {
      console.warn(`Skip missing ${file}`);
      continue;
    }
    await normalizeOne(input, path.join(AR_DIR, file));
  }
}

if (process.argv[2]) {
  const input = path.resolve(process.argv[2]);
  const output = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(AR_DIR, path.basename(input));
  await normalizeOne(input, output);
} else {
  await normalizeCatalog();
}
