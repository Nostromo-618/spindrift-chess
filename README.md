# Spindrift Chess

Pure client-side chess: **human vs Spindrift Engine**. Vue 3 + TypeScript + [Vanduo vd3](https://vanduo.dev). No accounts, no server — all computation runs in the browser.

## Features

- Spindrift Engine with 6 strength levels (1–3 stay CPU-light; 4–6 are time-managed)
- Undo, local persistence (`sdc-*` keys), theme switching via vd3
- CC0 Merida-style piece SVGs

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm run verify   # typecheck + lint + format + unit coverage + baseline + self-play + e2e quick
```

## Tests

| Command                   | What                                                       |
| ------------------------- | ---------------------------------------------------------- |
| `pnpm run test:unit`      | Vitest unit/engine                                         |
| `pnpm run test:coverage`  | Vitest with coverage thresholds                            |
| `pnpm run test:baseline`  | Tactical / timeout / short self-play gate                  |
| `pnpm run test:selfplay`  | Full Spindrift-vs-Spindrift games at levels 1–6 (parallel) |
| `pnpm run test:e2e:quick` | Playwright (excludes Full Game Tests)                      |

Self-play env knobs: `SPINDRIFT_SELFPLAY_GAMES`, `SPINDRIFT_SELFPLAY_MOVETIME`, `SPINDRIFT_SELFPLAY_JOBS`.

## License

MIT — see `LICENSE` and `THIRD_PARTY_NOTICES.md`.
