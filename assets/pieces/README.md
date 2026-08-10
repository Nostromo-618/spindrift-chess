# Spindrift piece artwork

Original Spindrift Chess piece set. Licensed under the project MIT License
(see `/LICENSE`). Do not treat these as third-party assets.

## Source of truth

[`spindrift-icon-bundle.svg`](spindrift-icon-bundle.svg) — single 2048×2048
sprite with six unique pieces (one colorway: dark body + light highlights).

Grid layout (columns left→right, rows top→bottom):

```text
Knight (N)    King (K)    Queen (Q)
Rook (R)      Bishop (B)  Pawn (P)
```

## Regenerating shipped SVGs

Do **not** hand-edit files under `public/pieces/spindrift/`. Regenerate:

```bash
node scripts/extract-spindrift-pieces.mjs
```

That script:

1. Crops each 3×2 cell by path centroid.
2. Writes black pieces (`bK`…`bP`) with near-black bodies, crushed graphite
   highlights, and a solid outer-contour underlay so hollow path cutouts read
   as filled (not board-through transparent).
3. Writes white pieces (`wK`…`wP`) by recoloring dark fills to `#F1EFED` and
   highlight fills/gradient stops to `#6B6A68` (same path geometry), then adds a
   thick `#11141A` silhouette stroke underlay (~10.5% of the piece’s shorter side)
   so whites stay readable on light squares.
4. Writes `public/favicon.svg` from the black Knight.

Board display also leaves tile margin and slightly shortens pieces via CSS
(`.chess-piece-img` in `src/styles/board.css`: 88% box + `scaleY(0.93)`).

## Board wiring

[`js/ui/BoardView.ts`](../../js/ui/BoardView.ts) loads
`{BASE_URL}pieces/spindrift/{w|b}{K|Q|R|B|N|P}.svg`.
