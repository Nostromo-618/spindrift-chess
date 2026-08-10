# CLAUDE.md

Guidance for agents working in this repository.

## Source of truth

Project specifications live under **`openspec/`**. Read the relevant capability
spec (`engine-search`, `engine-evaluation`, `engine-strength-levels`,
`engine-selfplay-harness`) before changing engine behavior.

## Commands

pnpm (pinned via `packageManager`) and Node ≥ 20.19.

```bash
pnpm dev
pnpm build
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run test:unit
pnpm run test:coverage
pnpm run test:baseline
pnpm run test:selfplay
pnpm run test:e2e:quick
pnpm run verify
```

## Architecture

- **`js/`** — framework-agnostic TypeScript (no Vue imports). `js/engine/` is the
  Spindrift Engine. `js/engineAdapter.ts` + `js/ai.worker.ts` run search off the
  main thread. `js/ui/BoardView.ts` is the imperative board renderer.
- **`src/`** — Vue 3 + vd3 UI. `useGameStore.ts` owns the `Game` singleton.

Product mode is **human vs Spindrift Engine only**. There is no Tomitank and no
engine-match UI. Self-play exists only as a test/quality gate.

## Constraints

- Levels 1–3 must stay CPU-light; 4–6 may use real CPU within movetime.
- Production dependencies: `vue` + `@vanduo-oss/vd3` only.
- Storage namespace: `sdc-*`.
- Strict TypeScript; Vitest for unit, Playwright for e2e.
