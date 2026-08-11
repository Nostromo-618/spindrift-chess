# Spindrift Chess

<p align="left">
  <img src="public/brand/spindrift-rook.svg" alt="Spindrift Chess" width="48" height="48" />
</p>

**Play:** [spindriftchess.com](https://spindriftchess.com)

Browser chess: human vs the Spindrift Engine. Vue 3 + TypeScript + [vd3](https://vd3.vanduo.dev/). No accounts or server — everything runs client-side.

Brand mark: amber rook at [`public/brand/spindrift-rook.svg`](public/brand/spindrift-rook.svg) (also used as [`public/favicon.svg`](public/favicon.svg)).

Behavioral contracts live under [`openspec/`](openspec/).

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm run verify     # typecheck, lint, format, coverage, baseline, self-play, e2e quick
```

## License

MIT — see `LICENSE` and `THIRD_PARTY_NOTICES.md`.
