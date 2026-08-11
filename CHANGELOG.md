# Changelog

All notable changes to Spindrift Chess will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-11

### Added

- **EN/LT internationalisation**: Lightweight `useI18n()` composable with locale maps under `src/locales/`, persisting the active locale to `sdc-locale`. Every user-facing string is translated; the brand name “Spindrift” is never altered.
- **Locale switcher**: Header EN/LT segmented control with inline SVG flags and a sliding primary thumb.
- **Translated theme customizer**: App-owned `AppThemeCustomizer` replacing vd3’s English-only panel, reusing vd3 theme preference APIs.
- **Game-end Phosphor icons**: Checkmate, resignation, draw, and stalemate outcomes use tone-coloured Phosphor bold icons instead of emoji.
- **OpenSpec**: `openspec/specs/i18n-and-ui/spec.md` documents i18n and UI icon requirements.

---

## [1.1.0] - 2026-08-11

### Added

- **Singular Extensions**: Extends TT best moves by 1 ply during Level 6 searches when a reduced verification search confirms no alternative move reaches the TT score.
- **Late Move Pruning (LMP)**: Prunes quiet moves at shallow search depths (`depth <= 4`) beyond dynamic per-depth thresholds.
- **Quiet History Malus**: Penalizes quiet moves searched prior to a beta cutoff.
- **Pawn Structure Hash Table**: 8,192-entry cache in `Evaluator.ts` keyed by pawn Zobrist hash.
- **Evaluation Features**: Safe mobility (discounting pawn-attacked squares), backward pawn penalties, king tropism (Chebyshev distance attack pressure), and enhanced rook-on-7th bonuses.

### Optimized

- **Pre-computed LMR Table**: Replaced runtime `Math.log()` calculations with a 64×64 pre-populated lookup table.
- **In-Place Null-Move Search**: Replaced `state.clone()` with `makeNullMove()` / `undoNullMove()`, eliminating memory allocations and GC spikes.
- **Power-of-2 Bitmask TT Indexing**: Resized TT structures (`131,072` / `524,288`) to use fast bitwise `key & mask` indexing instead of `BigInt` modulo.
- **Zero-Allocation Insertion Sort**: Replaced move-wrapping object allocations with an in-place insertion sort over a reusable `Float64Array` score buffer.
- **Incremental Piece Count**: Replaced 64-square `countPieces()` scans with an incrementally updated `nonPawnPieceCount` counter.

### Performance

- Level 6 deep search time reduced by **~21%** (from 10.5s down to 8.3s on benchmark suites).

---

## [1.0.0] - 2026-08-10

### Added

- Initial release of Spindrift Chess.
- Human vs Spindrift AI engine with 6 difficulty levels.
- Vue 3 + Vanduo vd3 UI, local game persistence, undo support, dark/light themes, and custom SVG piece sets.
