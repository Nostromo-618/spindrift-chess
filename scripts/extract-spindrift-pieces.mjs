#!/usr/bin/env node
/**
 * Extract Spindrift chess piece SVGs from the master icon bundle.
 *
 * Source: assets/pieces/spindrift-icon-bundle.svg (3×2 grid)
 * Output: public/pieces/spindrift/{w,b}{K,Q,R,B,N,P}.svg
 *         public/brand/spindrift-rook.svg + public/favicon.svg (amber white-rook)
 *
 * Layout:
 *   N  K  Q
 *   R  B  P
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUNDLE = join(ROOT, "assets/pieces/spindrift-icon-bundle.svg");
const OUT_DIR = join(ROOT, "public/pieces/spindrift");
const BRAND_DIR = join(ROOT, "public/brand");
const BRAND_ROOK = join(BRAND_DIR, "spindrift-rook.svg");
const FAVICON = join(ROOT, "public/favicon.svg");
/** vd3 Open Color Amber swatch — dark-theme primary yellow. */
const BRAND_AMBER = "#f59f00";

const BUNDLE_SIZE = 2048;
const COLS = 3;
const ROWS = 2;
const CELL_W = BUNDLE_SIZE / COLS;
const CELL_H = BUNDLE_SIZE / ROWS;
const PAD = 24;

/** @type {Record<string, { col: number, row: number }>} */
const CELL_MAP = {
  N: { col: 0, row: 0 },
  K: { col: 1, row: 0 },
  Q: { col: 2, row: 0 },
  R: { col: 0, row: 1 },
  B: { col: 1, row: 1 },
  P: { col: 2, row: 1 },
};

const DARK_RGB = "rgb(17,20,26)";
const LIGHT_RGB = "rgb(241,239,237)";
const WHITE_BODY = "#F1EFED";
const WHITE_HIGHLIGHT = "#6B6A68";
const WHITE_OUTLINE = "#11141A";
/** Outline stroke as a fraction of the piece bbox’s smaller side. */
const WHITE_OUTLINE_FRAC = 0.105;
/** Near-black body for black pieces (same as source silhouette). */
const BLACK_BODY = "#11141A";
/**
 * Cool graphite highlight for black pieces — keeps subtle form without chalky
 * white interiors. Paired with crushed opacities in mapFillOpacity.
 */
const BLACK_HIGHLIGHT = "#3A4250";
/** Scale + cap for original light-highlight opacities on black pieces. */
const BLACK_HIGHLIGHT_OPACITY_SCALE = 0.22;
const BLACK_HIGHLIGHT_OPACITY_MAX = 0.14;

/**
 * @param {string} d
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function pathBBox(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 4) return null;
  const xs = [];
  const ys = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(Number(nums[i]));
    ys.push(Number(nums[i + 1]));
  }
  if (!xs.length) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/**
 * @param {string} text
 * @returns {Map<string, string>}
 */
function parseGradients(text) {
  const defsMatch = text.match(/<defs>([\s\S]*?)<\/defs>/);
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!defsMatch) return map;
  const defs = defsMatch[1];
  const re = /<linearGradient\b[^>]*\bid="([^"]+)"[\s\S]*?<\/linearGradient>/g;
  let m;
  while ((m = re.exec(defs))) {
    map.set(m[1], m[0]);
  }
  return map;
}

/**
 * @param {string} text
 */
function parsePaths(text) {
  const re = /<path\b([^>]*)\/?>/g;
  /** @type {{ attrs: string, d: string, fill: string, fillOpacity: string | null, bbox: NonNullable<ReturnType<typeof pathBBox>>, col: number, row: number }[]} */
  const paths = [];
  let m;
  while ((m = re.exec(text))) {
    const attrs = m[1];
    const dMatch = attrs.match(/\sd="([^"]+)"/);
    if (!dMatch) continue;
    const d = dMatch[1];
    const bbox = pathBBox(d);
    if (!bbox) continue;
    const fillMatch = attrs.match(/\sfill="([^"]+)"/);
    const fill = fillMatch ? fillMatch[1] : DARK_RGB;
    const opMatch = attrs.match(/\sfill-opacity="([^"]+)"/);
    const fillOpacity = opMatch ? opMatch[1] : null;
    const cx = (bbox.minX + bbox.maxX) / 2;
    const cy = (bbox.minY + bbox.maxY) / 2;
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(cx / CELL_W)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(cy / CELL_H)));
    paths.push({ attrs, d, fill, fillOpacity, bbox, col, row });
  }
  return paths;
}

/**
 * @param {string} fill
 * @returns {boolean}
 */
function isLightFill(fill) {
  return fill === LIGHT_RGB || /^rgb\(\s*2[0-9]{2}/.test(fill);
}

/**
 * @param {string} fill
 * @param {"black" | "white"} color
 */
function mapFill(fill, color) {
  if (fill.startsWith("url(#")) return fill;
  if (color === "black") {
    if (fill === DARK_RGB) return BLACK_BODY;
    if (isLightFill(fill)) return BLACK_HIGHLIGHT;
    return fill;
  }
  if (fill === DARK_RGB) return WHITE_BODY;
  if (isLightFill(fill)) return WHITE_HIGHLIGHT;
  return fill;
}

/**
 * @param {string} fill
 * @param {string | null} fillOpacity
 * @param {"black" | "white"} color
 * @returns {string | null}
 */
function mapFillOpacity(fill, fillOpacity, color) {
  if (color !== "black" || fillOpacity === null) return fillOpacity;
  const op = Number(fillOpacity);
  if (!Number.isFinite(op)) return fillOpacity;
  // Solidify near-opaque body paths.
  if (fill === DARK_RGB && op >= 0.9) return null;
  if (!isLightFill(fill) && !fill.startsWith("url(#")) return fillOpacity;
  // Crush chalky highlight translucency into a faint graphite sheen.
  const crushed = Math.min(BLACK_HIGHLIGHT_OPACITY_MAX, op * BLACK_HIGHLIGHT_OPACITY_SCALE);
  return crushed.toFixed(4);
}

/**
 * @param {string} gradientXml
 * @param {"black" | "white"} color
 */
function mapGradient(gradientXml, color) {
  if (color === "white") {
    return gradientXml.replace(/stop-color="rgb\([^"]+\)"/g, `stop-color="${WHITE_HIGHLIGHT}"`);
  }
  // Black: graphite stops + heavily reduced opacity.
  return gradientXml
    .replace(/stop-color="rgb\([^"]+\)"/g, `stop-color="${BLACK_HIGHLIGHT}"`)
    .replace(/stop-opacity="([^"]+)"/g, (_m, raw) => {
      const op = Number(raw);
      if (!Number.isFinite(op)) return `stop-opacity="${raw}"`;
      const crushed = Math.min(BLACK_HIGHLIGHT_OPACITY_MAX, op * BLACK_HIGHLIGHT_OPACITY_SCALE);
      return `stop-opacity="${crushed.toFixed(4)}"`;
    });
}

/**
 * Outer contour of a compound path (first closed subpath). Used to underlay
 * black pieces so intentional hole cutouts read as filled, not transparent.
 * @param {string} d
 */
function outerSubpath(d) {
  const m = d.match(/^[Mm][\s\S]*?[Zz]/);
  return m ? m[0].trim() : d;
}

/**
 * @param {{ piecePaths: ReturnType<typeof parsePaths>, gradients: Map<string, string>, color: "black" | "white", label: string }} opts
 */
function buildSvg({ piecePaths, gradients, color, label }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of piecePaths) {
    minX = Math.min(minX, p.bbox.minX);
    minY = Math.min(minY, p.bbox.minY);
    maxX = Math.max(maxX, p.bbox.maxX);
    maxY = Math.max(maxY, p.bbox.maxY);
  }
  minX -= PAD;
  minY -= PAD;
  maxX += PAD;
  maxY += PAD;
  const width = maxX - minX;
  const height = maxY - minY;

  /** @type {Set<string>} */
  const used = new Set();
  for (const p of piecePaths) {
    const m = p.fill.match(/^url\(#(.+)\)$/);
    if (m) used.add(m[1]);
  }

  const defsParts = [];
  for (const id of used) {
    const g = gradients.get(id);
    if (g) defsParts.push(mapGradient(g, color));
  }

  const layers = [];

  // Black pieces: solid outer-contour underlay so hollow compound-path interiors
  // show near-black instead of the board square.
  if (color === "black") {
    for (const p of piecePaths) {
      if (p.fill !== DARK_RGB) continue;
      // Prefer the largest body silhouette; skip tiny accent crumbs.
      const area = (p.bbox.maxX - p.bbox.minX) * (p.bbox.maxY - p.bbox.minY);
      if (area < 8000) continue;
      layers.push(`<path fill="${BLACK_BODY}" d="${outerSubpath(p.d)}"/>`);
    }
  }

  // White pieces: thick dark silhouette underlay for contrast on light squares.
  if (color === "white") {
    const strokeW = Math.max(8, Math.min(width, height) * WHITE_OUTLINE_FRAC);
    for (const p of piecePaths) {
      if (p.fill !== DARK_RGB) continue;
      layers.push(
        `<path fill="none" stroke="${WHITE_OUTLINE}" stroke-width="${strokeW.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" d="${p.d}"/>`,
      );
    }
  }

  for (const p of piecePaths) {
    const fill = mapFill(p.fill, color);
    const mappedOp = mapFillOpacity(p.fill, p.fillOpacity, color);
    const op = mappedOp !== null ? ` fill-opacity="${mappedOp}"` : "";
    layers.push(`<path fill="${fill}"${op} d="${p.d}"/>`);
  }

  // Expand viewBox slightly so white outlines are not clipped.
  const outlinePad =
    color === "white" ? Math.max(8, Math.min(width, height) * WHITE_OUTLINE_FRAC) : 0;
  const vbX = minX - outlinePad;
  const vbY = minY - outlinePad;
  const vbW = width + outlinePad * 2;
  const vbH = height + outlinePad * 2;

  const pathXml = layers.join("\n  ");
  const defsBlock = defsParts.length > 0 ? `<defs>\n  ${defsParts.join("\n  ")}\n</defs>\n` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="512" height="512" role="img" aria-label="${label}">
${defsBlock}  ${pathXml}
</svg>
`;
}

/**
 * Solid amber rook for navbar / favicon (board pieces stay multi-tone).
 * @param {{ piecePaths: ReturnType<typeof parsePaths>, gradients: Map<string, string> }} args
 */
function buildBrandRook({ piecePaths, gradients }) {
  const whiteSvg = buildSvg({ piecePaths, gradients, color: "white", label: "Spindrift Chess" });
  const vb = (whiteSvg.match(/viewBox="([^"]+)"/) || [])[1];
  const bodyPaths = [...whiteSvg.matchAll(/<path fill="#F1EFED" d="([^"]+)"\/>/g)].map((m) => m[1]);
  if (!vb || bodyPaths.length === 0) {
    throw new Error("Failed to derive brand rook from white rook SVG");
  }
  const paths = bodyPaths.map((d) => `  <path fill="${BRAND_AMBER}" d="${d}"/>`).join("\n");
  return { vb, pathsXml: paths };
}

function main() {
  const text = readFileSync(BUNDLE, "utf8");
  const gradients = parseGradients(text);
  const paths = parsePaths(text);
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(BRAND_DIR, { recursive: true });

  /** @type {ReturnType<typeof parsePaths> | null} */
  let rookWhitePaths = null;

  for (const [code, cell] of Object.entries(CELL_MAP)) {
    const piecePaths = paths.filter((p) => p.col === cell.col && p.row === cell.row);
    if (piecePaths.length === 0) {
      throw new Error(`No paths found for piece ${code} at (${cell.col},${cell.row})`);
    }

    for (const color of /** @type {const} */ (["black", "white"])) {
      const prefix = color === "black" ? "b" : "w";
      const label = `${color} ${code}`;
      const svg = buildSvg({ piecePaths, gradients, color, label });
      const out = join(OUT_DIR, `${prefix}${code}.svg`);
      writeFileSync(out, svg, "utf8");
      console.log(`Wrote ${out} (${piecePaths.length} paths)`);
      if (code === "R" && color === "white") rookWhitePaths = piecePaths;
    }
  }

  if (!rookWhitePaths) throw new Error("White rook paths missing for brand icon");
  const { vb, pathsXml } = buildBrandRook({ piecePaths: rookWhitePaths, gradients });
  const brand = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="512" height="512" role="img" aria-label="Spindrift Chess">
${pathsXml}
</svg>
`;
  const favicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="32" height="32">
${pathsXml}
</svg>
`;
  writeFileSync(BRAND_ROOK, brand, "utf8");
  writeFileSync(FAVICON, favicon, "utf8");
  console.log(`Wrote ${BRAND_ROOK}`);
  console.log(`Wrote ${FAVICON}`);
}

main();
