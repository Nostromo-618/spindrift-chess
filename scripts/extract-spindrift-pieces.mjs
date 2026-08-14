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
/**
 * Shared silhouette/inner-hole stroke as a fraction of the piece bbox’s
 * shorter side. Drawn under the body fill so the visible inner line is the
 * half of the stroke that sits in each hole. Both colors stroke the full
 * compound path (outer + holes); black is a color invert of white.
 */
const OUTLINE_FRAC = 0.105;
/** Near-black body for black pieces — invert of WHITE_BODY. */
const BLACK_BODY = "#11141A";
/**
 * Cream highlight on black pieces — invert of white’s light source fills
 * (WHITE_BODY), at the same opacities white uses.
 */
const BLACK_HIGHLIGHT = "#F1EFED";
/** Full-compound outline on black pieces — invert of WHITE_OUTLINE. */
const BLACK_OUTLINE = "#F1EFED";
/** King collar hole enlargement (around centroid). */
const KING_COLLAR_SCALE = 1.85;
/**
 * Bishop mitre hole scale around its centroid. Slightly taller than wide so the
 * existing slit reads more diamond/angular — not a new ornament.
 */
const BISHOP_MITRE_SCALE_X = 1.1;
const BISHOP_MITRE_SCALE_Y = 1.18;
/**
 * Pinch the outer mitre (and the scaled head hole) toward the centerline at the
 * apex. 0 = unchanged; 1 = collapse to a line. Modest: bulbous cap → a point.
 */
const BISHOP_HEAD_PINCH = 0.2;
/** Extra upward lift of the apex, as a fraction of head height (pinch zone). */
const BISHOP_HEAD_POINT_LIFT = 0.07;
/** Skip hole subpaths smaller than this (crumb scratches in hole detection). */
const HOLE_MIN_SIDE = 5;

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
  if (fill === DARK_RGB) return color === "white" ? WHITE_BODY : BLACK_BODY;
  if (isLightFill(fill)) return color === "white" ? WHITE_HIGHLIGHT : BLACK_HIGHLIGHT;
  return fill;
}

/**
 * Invert gradient stop colors the same way as fills. Stop opacities are kept.
 * @param {string} gradientXml
 * @param {"black" | "white"} color
 */
function mapGradient(gradientXml, color) {
  return gradientXml.replace(/stop-color="(rgb\([^"]+\))"/g, (_m, rgb) => {
    return `stop-color="${mapFill(rgb, color)}"`;
  });
}

/**
 * Split a compound path into closed subpaths (outer + holes).
 * @param {string} d
 * @returns {string[]}
 */
function splitClosedSubpaths(d) {
  /** @type {string[]} */
  const out = [];
  const re = /[Mm][^Mm]*/g;
  let m;
  while ((m = re.exec(d))) {
    const part = m[0].trim();
    if (part) out.push(part);
  }
  return out;
}

/**
 * Map every absolute coordinate pair in a path through `fn`. Relative commands
 * are rare in this bundle (Recraft exports absolute); if any appear we leave
 * them untouched by requiring absolute M/L/C/Q/S/T/A/H/V/Z only.
 * @param {string} d
 * @param {(x: number, y: number) => [number, number]} fn
 */
function mapPathCoords(d, fn) {
  const tokens = d.match(/[MmZzLlHhVvCcSsQqTtAa]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return d;
  /** @type {string[]} */
  const out = [];
  let i = 0;
  let cmd = "";
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[MmZzLlHhVvCcSsQqTtAa]$/.test(t)) {
      cmd = t;
      out.push(t);
      i += 1;
      continue;
    }
    // Absolute pair-consuming commands
    if ("MLT".includes(cmd)) {
      const x = Number(tokens[i]);
      const y = Number(tokens[i + 1]);
      const [nx, ny] = fn(x, y);
      out.push(fmtNum(nx), fmtNum(ny));
      i += 2;
      if (cmd === "M") cmd = "L";
      if (cmd === "m") cmd = "l";
      continue;
    }
    if (cmd === "C" || cmd === "c") {
      for (let k = 0; k < 3; k++) {
        const x = Number(tokens[i]);
        const y = Number(tokens[i + 1]);
        const [nx, ny] = fn(x, y);
        out.push(fmtNum(nx), fmtNum(ny));
        i += 2;
      }
      continue;
    }
    if (cmd === "Q" || cmd === "q" || cmd === "S" || cmd === "s") {
      for (let k = 0; k < 2; k++) {
        const x = Number(tokens[i]);
        const y = Number(tokens[i + 1]);
        const [nx, ny] = fn(x, y);
        out.push(fmtNum(nx), fmtNum(ny));
        i += 2;
      }
      continue;
    }
    if (cmd === "H" || cmd === "h") {
      // Horizontal: need current Y — fall back to leaving number as-is via pair fn with y=0
      // Bundle paths use absolute C/L almost exclusively; H is uncommon.
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    if (cmd === "V" || cmd === "v") {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    if (cmd === "A" || cmd === "a") {
      // rx ry rot large sweep x y — transform only endpoint
      out.push(tokens[i], tokens[i + 1], tokens[i + 2], tokens[i + 3], tokens[i + 4]);
      const x = Number(tokens[i + 5]);
      const y = Number(tokens[i + 6]);
      const [nx, ny] = fn(x, y);
      out.push(fmtNum(nx), fmtNum(ny));
      i += 7;
      continue;
    }
    // Unknown / relative leftovers: pass through
    out.push(t);
    i += 1;
  }
  return out.join(" ");
}

/** @param {number} n */
function fmtNum(n) {
  const r = Math.round(n * 1000) / 1000;
  return String(r);
}

/**
 * Scale a path around its centroid.
 * @param {string} d
 * @param {number} sx
 * @param {number} sy
 */
function scalePathAroundCentroid(d, sx, sy) {
  const bb = pathBBox(d);
  if (!bb) return d;
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  return mapPathCoords(d, (x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}

/**
 * Largest DARK_RGB silhouette among piece paths (compound body).
 * @param {ReturnType<typeof parsePaths>} piecePaths
 */
function mainSilhouette(piecePaths) {
  let best = null;
  let bestArea = 0;
  for (const p of piecePaths) {
    if (p.fill !== DARK_RGB) continue;
    const area = (p.bbox.maxX - p.bbox.minX) * (p.bbox.maxY - p.bbox.minY);
    if (area > bestArea) {
      bestArea = area;
      best = p;
    }
  }
  return best;
}

/**
 * Hole descriptors for a compound silhouette (skip outer contour).
 * @param {string} d
 */
function holeInfos(d) {
  const subs = splitClosedSubpaths(d);
  /** @type {{ index: number, d: string, bbox: NonNullable<ReturnType<typeof pathBBox>>, area: number, aspect: number }[]} */
  const holes = [];
  for (let i = 1; i < subs.length; i++) {
    const bb = pathBBox(subs[i]);
    if (!bb) continue;
    const w = bb.maxX - bb.minX;
    const h = bb.maxY - bb.minY;
    if (w < HOLE_MIN_SIDE || h < HOLE_MIN_SIDE) continue;
    holes.push({
      index: i,
      d: subs[i],
      bbox: bb,
      area: w * h,
      aspect: w / h,
    });
  }
  return { subs, holes };
}

/**
 * Enlarge the king’s neck/collar hole so it reads distinctly from a pawn.
 * @param {ReturnType<typeof parsePaths>} piecePaths
 */
function enlargeKingCollar(piecePaths) {
  const sil = mainSilhouette(piecePaths);
  if (!sil) return;
  const { subs, holes } = holeInfos(sil.d);
  if (holes.length === 0) return;

  // Body cavity = largest hole; base slot = very wide flat hole near the bottom.
  const body = holes.reduce((a, b) => (b.area > a.area ? b : a));
  const baseCandidates = holes.filter((h) => h.aspect > 4);
  const base =
    baseCandidates.length > 0
      ? baseCandidates.reduce((a, b) => (b.bbox.minY > a.bbox.minY ? b : a))
      : null;

  // Collar: highest remaining hole under the crown (often a wide band, not the body).
  const remaining = holes.filter((h) => h !== body && h !== base);
  if (remaining.length === 0) return;
  remaining.sort((a, b) => a.bbox.minY - b.bbox.minY);
  const collar = remaining[0];

  // Scale mostly on the shorter axis so a flat collar gets bulk without eating the crown.
  let sx = KING_COLLAR_SCALE;
  let sy = KING_COLLAR_SCALE;
  if (collar.aspect > 2) {
    sx = Math.min(1.35, KING_COLLAR_SCALE);
    sy = KING_COLLAR_SCALE;
  }
  const scaled = scalePathAroundCentroid(collar.d, sx, sy);
  const scaledBb = pathBBox(scaled);
  if (!scaledBb) return;

  // Clamp: do not overlap crown (above) or body cavity (below) by more than a small gap.
  const gap = 8;
  const crownLimit = sil.bbox.minY + (collar.bbox.minY - sil.bbox.minY) * 0.35;
  const bodyTop = body.bbox.minY;
  let finalD = scaled;
  if (scaledBb.minY < crownLimit + gap || scaledBb.maxY > bodyTop - gap) {
    const maxUp = Math.max(4, collar.bbox.minY - (crownLimit + gap));
    const maxDown = Math.max(4, bodyTop - gap - collar.bbox.maxY);
    const halfH = (collar.bbox.maxY - collar.bbox.minY) / 2;
    const maxSy = Math.min((halfH + maxUp) / halfH, (halfH + maxDown) / halfH, KING_COLLAR_SCALE);
    const clampedSy = Math.max(1.25, Math.min(sy, maxSy));
    const clampedSx = collar.aspect > 2 ? Math.min(sx, 1.35) : Math.min(sx, clampedSy);
    finalD = scalePathAroundCentroid(collar.d, clampedSx, clampedSy);
  }

  subs[collar.index] = finalD.endsWith("z") || finalD.endsWith("Z") ? finalD : `${finalD} z`;
  sil.d = subs.join(" ");
  const nb = pathBBox(sil.d);
  if (nb) sil.bbox = nb;
}

/**
 * Sharpen the bishop mitre: scale the existing head hole slightly (more diamond)
 * and pinch the outer silhouette’s top toward a point. No mirrored-down overlay.
 * @param {ReturnType<typeof parsePaths>} piecePaths
 */
function sharpenBishopHead(piecePaths) {
  const sil = mainSilhouette(piecePaths);
  if (!sil) return;
  const { subs, holes } = holeInfos(sil.d);
  if (holes.length < 2) return;

  const body = holes.reduce((a, b) => (b.area > a.area ? b : a));
  // Head = highest near-square hole that is not the body cavity.
  const headCandidates = holes
    .filter((h) => h !== body && h.aspect >= 0.6 && h.aspect <= 1.5)
    .sort((a, b) => a.bbox.minY - b.bbox.minY);
  const head = headCandidates[0];
  if (!head) return;

  let sx = BISHOP_MITRE_SCALE_X;
  let sy = BISHOP_MITRE_SCALE_Y;
  const scaled = scalePathAroundCentroid(head.d, sx, sy);
  const scaledBb = pathBBox(scaled);
  const gap = 8;
  if (scaledBb && scaledBb.maxY > body.bbox.minY - gap) {
    const halfH = (head.bbox.maxY - head.bbox.minY) / 2;
    const maxDown = Math.max(4, body.bbox.minY - gap - head.bbox.maxY);
    const maxSy = Math.min(BISHOP_MITRE_SCALE_Y, (halfH + maxDown) / halfH);
    sy = Math.max(1.05, maxSy);
    sx = Math.min(sx, sy);
  }
  const finalHead = scalePathAroundCentroid(head.d, sx, sy);
  subs[head.index] =
    finalHead.endsWith("z") || finalHead.endsWith("Z") ? finalHead : `${finalHead} z`;

  const outerBb = pathBBox(subs[0]);
  const headBb = pathBBox(subs[head.index]) || head.bbox;
  if (!outerBb) {
    sil.d = subs.join(" ");
    const nb = pathBBox(sil.d);
    if (nb) sil.bbox = nb;
    return;
  }
  const cx = (head.bbox.minX + head.bbox.maxX) / 2;
  const apexY = outerBb.minY;
  const pinchBaseY = headBb.maxY;
  const headH = pinchBaseY - apexY;
  if (headH >= 8) {
    const pinchSub = (d) =>
      mapPathCoords(d, (x, y) => {
        if (y >= pinchBaseY) return [x, y];
        const t = Math.max(0, Math.min(1, (pinchBaseY - y) / headH));
        const w = t * t;
        return [
          cx + (x - cx) * (1 - BISHOP_HEAD_PINCH * w),
          y - BISHOP_HEAD_POINT_LIFT * headH * w,
        ];
      });
    subs[0] = pinchSub(subs[0]);
    subs[head.index] = pinchSub(subs[head.index]);
  }

  sil.d = subs.join(" ");
  const nb = pathBBox(sil.d);
  if (nb) sil.bbox = nb;
}

/**
 * Shared under-fill outline of a compound silhouette (outer + all holes).
 * @param {string} d
 * @param {string} stroke
 * @param {number} strokeW
 */
function outlinePath(d, stroke, strokeW) {
  return `<path fill="none" stroke="${stroke}" stroke-width="${strokeW.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>`;
}

/**
 * @param {{ piecePaths: ReturnType<typeof parsePaths>, gradients: Map<string, string>, color: "black" | "white", label: string, code?: string }} opts
 */
function buildSvg({ piecePaths, gradients, color, label, code }) {
  // Mutate copies so white/black runs don't share path edits.
  const paths = piecePaths.map((p) => ({ ...p, bbox: { ...p.bbox } }));

  if (code === "K") enlargeKingCollar(paths);
  if (code === "B") sharpenBishopHead(paths);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of paths) {
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
  const strokeW = Math.max(8, Math.min(width, height) * OUTLINE_FRAC);
  const outlineStroke = color === "white" ? WHITE_OUTLINE : BLACK_OUTLINE;

  /** @type {Set<string>} */
  const used = new Set();
  for (const p of paths) {
    const m = p.fill.match(/^url\(#(.+)\)$/);
    if (m) used.add(m[1]);
  }

  const defsParts = [];
  for (const id of used) {
    const g = gradients.get(id);
    if (g) defsParts.push(mapGradient(g, color));
  }

  const layers = [];

  // Under-fill outline: full compound (outer + holes). Black is a color invert
  // of white (cream ring including the outer contour). Holes stay even-odd empty.
  for (const p of paths) {
    if (p.fill !== DARK_RGB) continue;
    layers.push(outlinePath(p.d, outlineStroke, strokeW));
  }

  for (const p of paths) {
    const fill = mapFill(p.fill, color);
    const op = p.fillOpacity !== null ? ` fill-opacity="${p.fillOpacity}"` : "";
    layers.push(`<path fill="${fill}"${op} d="${p.d}"/>`);
  }

  // Expand viewBox so under-fill outlines are not clipped (both colors).
  const outlinePad = strokeW;
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
  const whiteSvg = buildSvg({
    piecePaths,
    gradients,
    color: "white",
    label: "Spindrift Chess",
    code: "R",
  });
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
      // Fresh copy per color so collar/head mutations don't leak.
      const pathsCopy = piecePaths.map((p) => ({ ...p, bbox: { ...p.bbox } }));
      const svg = buildSvg({ piecePaths: pathsCopy, gradients, color, label, code });
      const out = join(OUT_DIR, `${prefix}${code}.svg`);
      writeFileSync(out, svg, "utf8");
      console.log(`Wrote ${out} (${pathsCopy.length} paths)`);
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
