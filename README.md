# Spindrift Chess

<p align="left">
  <img src="public/brand/spindrift-rook.svg" alt="Spindrift Chess" width="48" height="48" />
</p>

**Play:** [spindriftchess.online](https://spindriftchess.online)

Browser chess: human vs the Spindrift Engine. Vue 3 + TypeScript + [vd3](https://vd3.vanduo.dev/). No accounts or server — everything runs client-side.

Brand mark: amber rook at [`public/brand/spindrift-rook.svg`](public/brand/spindrift-rook.svg) (also used as [`public/favicon.svg`](public/favicon.svg)).

Behavioral contracts live under [`openspec/`](openspec/).

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm run verify     # typecheck, lint, format, coverage, baseline, self-play, e2e quick
```

## Piece artwork

The original Spindrift pieces are generated from
[`assets/pieces/spindrift-icon-bundle.svg`](assets/pieces/spindrift-icon-bundle.svg):

```bash
node scripts/extract-spindrift-pieces.mjs
node scripts/review-spindrift-pieces.mjs  # height study in test-results/piece-review/review.html
```

Board and promotion images use a 100% square canvas and the accepted "halfway"
height proportions: the average of each original visible height and the FIDE
physical ratio, with the king held at its enlarged size. CSS scales width and
height uniformly and aligns the visible feet at 95.1% of the square. The original
SVG paths and aspect ratios are unchanged. Per-piece transforms are documented
in `src/styles/board.css`.
The review offers original sizes, FIDE physical ratios, a halfway comparison,
and individual height controls. It scales complete pieces uniformly and does
not write assets or change game settings.

## License

MIT — see `LICENSE` and `THIRD_PARTY_NOTICES.md`.
