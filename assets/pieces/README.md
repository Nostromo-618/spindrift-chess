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
2. **King** — enlarges the neck/collar hole (~1.85× around its centroid, clamped
   so it does not merge with the crown or body cavity) so the king reads apart
   from a pawn.
3. **Shared under-fill outline** — strokes dark silhouettes at ~10.5% of the
   piece’s shorter side _before_ the body fill. Both colors stroke the **full
   compound path** (outer + holes) at that shared width. White uses `#11141A`;
   black is a color invert (`#F1EFED`), including the outer cream ring. The fill
   covers the half of each hole stroke that sits in the body, so inner structure
   matches. Holes stay even-odd empty (board shows through) on both colors.
   ViewBox padding matches the outline width so strokes are not clipped and
   board scaling stays aligned.
4. **Bishop** — post-process the shared silhouette (both colors) before outline
   and fills: drop any mirrored-mitre overlay; pinch the outer mitre toward a
   point (`BISHOP_HEAD_PINCH` 0.2, apex lift 0.07 of head height) and slightly
   scale the existing head hole (~1.10× wide / 1.18× tall around its centroid,
   clamped above the body cavity) so the slit reads more diamond/angular. No
   new down-pointing ornament and no extra fill.
5. Writes white pieces (`wK`…`wP`) by recoloring dark fills to `#F1EFED` and
   highlight fills/gradient stops to `#6B6A68` (same path geometry, original
   opacities).
6. Writes black pieces (`bK`…`bP`) as a **color invert of white**: same layer
   order and path geometry; stroke `#F1EFED`, body `#11141A`, light
   fills/gradient stops `#F1EFED` at the same opacities as white (no crushed
   graphite sheen, no extra underlay).
7. Writes `public/brand/spindrift-rook.svg` and `public/favicon.svg` as a solid
   amber white-rook mark for the navbar / favicon.

Board display also leaves tile margin and slightly shortens pieces via CSS
(`.chess-piece-img` in `src/styles/board.css`: 88% box + `scaleY(0.93)`).

## Board wiring

[`js/ui/BoardView.ts`](../../js/ui/BoardView.ts) loads
`{BASE_URL}pieces/spindrift/{w|b}{K|Q|R|B|N|P}.svg`.
