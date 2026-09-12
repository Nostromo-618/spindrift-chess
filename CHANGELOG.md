# Changelog

All notable changes to Spindrift Chess will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-09-12

### Changed

- **Piece artwork**: Clearer king (enlarged collar so it reads apart from a pawn); light and dark outlines aligned. Bishops lost the down-pointing mitre overlay, and the head is a bit edgier (both colours).
- **Locale switcher**: Replaced the segmented EN|LT control with a vd3 Mode Toggle morph (flag + EN/LT) in the header on mobile and desktop.
- **Header chrome**: Slightly smaller title text with a fixed ~28px rook icon; New Game / Undo buttons a bit shorter with matching on-primary contrast for active color-choice segments in dark mode. On narrow phones, header gaps/paddings and the locale toggle tighten so Lithuanian “Spindrift Šachmatai” stays on one line when possible; only very narrow viewports stack the product word under the brand, with a little vertical gap so descenders don’t collide.
- **Board chrome**: Slightly thinner board outline and a touch more corner roundness.
- **First-visit defaults**: Computer strength starts at level 4; Play as defaults to White.
- **Thinking UI**: Depth / nodes / time details only appear in uncapped mode (levels 1–6 keep the navbar brain). On mobile, uncapped thinking sits between New Game and Play as. Uncapped think-time slider max is 180 seconds.
- **Toasts**: Notifications use vd3 bottom-right placement on all viewports (replacing top-right plus the old mobile CSS remap).

---

## [1.2.1] - 2026-08-14

### Changed

- **Piece artwork**: Clearer king (enlarged collar so it reads apart from a pawn); light and dark outlines aligned. Bishops lost the down-pointing mitre overlay, and the head is a bit edgier (both colours).
- **Settings**: Dropped the “Game Settings” title. **Play as** and **Computer strength** (renamed from Spindrift strength) are section headings, with a little extra space above strength.
- **Move history**: Newest-first by default, with an Asc/Dsc switch and hover tooltips for the short labels.

### Added

- **New Game confirm**: If a game already has moves, starting a new one asks for confirmation (progress will be lost). An info toast confirms when a new game starts.

---

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
