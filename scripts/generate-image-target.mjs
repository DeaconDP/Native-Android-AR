/**
 * One-shot generator for the teaching image-target PNG.
 * High-contrast unique geometry (not copyrighted art) for ARCore Augmented Images.
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const WHITE = [255, 255, 255];
const BLACK = [13, 17, 23];
const CREAM = [236, 230, 195];
const ORANGE = [226, 113, 33];
const GOLD = [253, 184, 19];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pixels = Buffer.alloc(SIZE * SIZE * 3, 255);

function setPx(x, y, rgb) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 3;
  pixels[i] = rgb[0];
  pixels[i + 1] = rgb[1];
  pixels[i + 2] = rgb[2];
}

function fillRect(x0, y0, x1, y1, rgb) {
  const xa = Math.max(0, Math.min(x0, x1) | 0);
  const xb = Math.min(SIZE - 1, Math.max(x0, x1) | 0);
  const ya = Math.max(0, Math.min(y0, y1) | 0);
  const yb = Math.min(SIZE - 1, Math.max(y0, y1) | 0);
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) setPx(x, y, rgb);
  }
}

function fillCircle(cx, cy, r, rgb) {
  const rr = r * r;
  const x0 = Math.max(0, (cx - r) | 0);
  const x1 = Math.min(SIZE - 1, (cx + r) | 0);
  const y0 = Math.max(0, (cy - r) | 0);
  const y1 = Math.min(SIZE - 1, (cy + r) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) setPx(x, y, rgb);
    }
  }
}

function strokeCircle(cx, cy, r, thickness, rgb) {
  const rOut = r + thickness * 0.5;
  const rIn = Math.max(0, r - thickness * 0.5);
  const rrOut = rOut * rOut;
  const rrIn = rIn * rIn;
  const x0 = Math.max(0, (cx - rOut) | 0);
  const x1 = Math.min(SIZE - 1, (cx + rOut) | 0);
  const y0 = Math.max(0, (cy - rOut) | 0);
  const y1 = Math.min(SIZE - 1, (cy + rOut) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d <= rrOut && d >= rrIn) setPx(x, y, rgb);
    }
  }
}

function fillPoly(points, rgb) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(...ys)));
  const n = points.length;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = points[i][0];
        const yi = points[i][1];
        const xj = points[j][0];
        const yj = points[j][1];
        const intersect =
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) setPx(x, y, rgb);
    }
  }
}

function hashBits(x, y) {
  let n = (x * 73856093) ^ (y * 19349663) ^ 0x5deece66d;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

fillRect(0, 0, SIZE - 1, SIZE - 1, WHITE);

const margin = 48;
fillRect(margin, margin, SIZE - 1 - margin, SIZE - 1 - margin, BLACK);
const inner = margin + 28;
fillRect(inner, inner, SIZE - 1 - inner, SIZE - 1 - inner, CREAM);

const cellOrigin = 96;
const cellCount = 14;
const cell = 59;
for (let gy = 0; gy < cellCount; gy++) {
  for (let gx = 0; gx < cellCount; gx++) {
    const bits = hashBits(gx + 3, gy * 7 + 11);
    const x0 = cellOrigin + gx * cell;
    const y0 = cellOrigin + gy * cell;
    const pad = 5;
    const x1 = x0 + cell - pad;
    const y1 = y0 + cell - pad;
    const mx = (x0 + x1) >> 1;
    const my = (y0 + y1) >> 1;
    if ((bits & 1) === 0) fillRect(x0, y0, mx, my, BLACK);
    if ((bits & 2) === 0) fillRect(mx, y0, x1, my, BLACK);
    if ((bits & 4) === 0) fillRect(x0, my, mx, y1, BLACK);
    if ((bits & 8) === 0) fillRect(mx, my, x1, y1, BLACK);
    if ((bits & 16) !== 0) fillCircle(mx, my, 7, (bits & 32) !== 0 ? ORANGE : BLACK);
  }
}

fillRect(72, 72, 250, 250, WHITE);
fillRect(92, 92, 230, 230, BLACK);
fillRect(118, 118, 204, 204, GOLD);
fillRect(142, 142, 180, 180, BLACK);

fillPoly(
  [
    [780, 90],
    [940, 90],
    [940, 250],
    [860, 250],
    [860, 170],
    [780, 170],
  ],
  ORANGE,
);
fillPoly(
  [
    [800, 110],
    [920, 110],
    [920, 150],
    [840, 150],
    [840, 230],
    [800, 230],
  ],
  BLACK,
);

fillCircle(180, 820, 110, BLACK);
fillCircle(180, 820, 78, CREAM);
fillCircle(180, 820, 48, ORANGE);
fillCircle(180, 820, 22, BLACK);

fillPoly(
  [
    [760, 760],
    [960, 820],
    [790, 960],
    [720, 880],
  ],
  BLACK,
);
fillPoly(
  [
    [790, 800],
    [910, 828],
    [808, 920],
    [760, 860],
  ],
  GOLD,
);

strokeCircle(512, 512, 210, 22, BLACK);
strokeCircle(512, 512, 150, 16, ORANGE);
fillPoly(
  [
    [512, 330],
    [560, 470],
    [700, 490],
    [590, 575],
    [630, 710],
    [512, 630],
    [394, 710],
    [434, 575],
    [324, 490],
    [464, 470],
  ],
  BLACK,
);
fillCircle(512, 512, 36, GOLD);
fillCircle(512, 512, 16, BLACK);

const rng = mulberry32(0x0dee5);
for (let i = 0; i < 28; i++) {
  const x = 140 + rng() * 740;
  const y = 140 + rng() * 740;
  const w = 18 + rng() * 42;
  const h = 12 + rng() * 36;
  const color = rng() > 0.55 ? BLACK : rng() > 0.4 ? ORANGE : GOLD;
  if (rng() > 0.45) fillRect(x, y, x + w, y + h, color);
  else fillCircle(x, y, w * 0.45, color);
}

fillRect(40, 40, SIZE - 41, 56, BLACK);
fillRect(40, SIZE - 57, SIZE - 41, SIZE - 41, BLACK);
fillRect(40, 40, 56, SIZE - 41, BLACK);
fillRect(SIZE - 57, 40, SIZE - 41, SIZE - 41, BLACK);

const png = encodePng(SIZE, SIZE, pixels);
const here = dirname(fileURLToPath(import.meta.url));
const targets = [
  resolve(here, "../plugins/native-ar/android/src/main/assets/markers/deez_image_target.png"),
  resolve(here, "../web/public/markers/deez_image_target.png"),
];
for (const dest of targets) {
  await mkdir(dirname(dest), { recursive: true });
  await new Promise((resolveP, reject) => {
    const out = createWriteStream(dest);
    out.on("error", reject);
    out.on("finish", resolveP);
    out.end(png);
  });
  console.log("wrote", dest, png.length, "bytes");
}
