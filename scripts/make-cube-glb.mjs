/**
 * Tiny teaching cube GLB (untextured PBR, cyan).
 * Usage: node scripts/make-cube-glb.mjs [out.glb]
 */
import { Document, NodeIO } from "@gltf-transform/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "web", "public", "models", "cube.glb");

const positions = new Float32Array([
  // +X
  0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
  // -X
  -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5,
  // +Y
  -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
  // -Y
  -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
  // +Z
  0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
  // -Z
  -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
]);

const normals = new Float32Array([
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0,
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
]);

const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14,
  15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
]);

const document = new Document();
const buffer = document.createBuffer();
const position = document
  .createAccessor()
  .setType("VEC3")
  .setArray(positions)
  .setBuffer(buffer);
const normal = document
  .createAccessor()
  .setType("VEC3")
  .setArray(normals)
  .setBuffer(buffer);
const index = document
  .createAccessor()
  .setType("SCALAR")
  .setArray(indices)
  .setBuffer(buffer);

const material = document
  .createMaterial("cube")
  .setBaseColorFactor([0.239, 0.839, 0.961, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.65);

const prim = document
  .createPrimitive()
  .setAttribute("POSITION", position)
  .setAttribute("NORMAL", normal)
  .setIndices(index)
  .setMaterial(material);

const mesh = document.createMesh("cube").addPrimitive(prim);
const node = document.createNode("cube").setMesh(mesh);
document.createScene("cube").addChild(node);

const out = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;
fs.mkdirSync(path.dirname(out), { recursive: true });
await new NodeIO().write(out, document);
console.log(`Wrote ${path.relative(ROOT, out)}`);
