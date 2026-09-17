import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const svgPath = path.join(root, "public/brand/deez-native-seal.svg");
const svg = fs.readFileSync(svgPath, "utf8");

function writePng(size, outRel) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  // Inline the seal SVG as a nested group scaled into the padded square
  const innerSvg = svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/role="img"[^>]*/, "")
    .replace(/<title>[^<]*<\/title>/, "");

  const wrapped = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d1117"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 256 256">
    ${innerSvg}
  </svg>
</svg>`;

  const resvg = new Resvg(wrapped, { fitTo: { mode: "width", value: size } });
  const out = path.join(root, outRel);
  fs.writeFileSync(out, resvg.render().asPng());
  console.log("wrote", outRel, size);
}

writePng(192, "public/icons/icon-192.png");
writePng(512, "public/icons/icon-512.png");
