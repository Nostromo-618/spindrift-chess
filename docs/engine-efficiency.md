# Engine efficiency investigation — 2026-09-29

Baseline: `aeadf99473d20e8c83f469dfcefd67eb856d7257` (the original `main`).
Development branch: `codex/dev-engine-efficiency`.
Host: Apple M4, macOS 27.0, Node 22.22.3, arm64.

The same search work is approximately 2.2–2.6× faster in the measured workloads,
with identical moves, scores, and search counters in all 216 comparisons
(162 measured pairs and 54 warmups). Equal-time play scored 9 wins, 2 draws,
1 loss. Half-time play scored 11 wins, 7 draws, 6 losses, but level 4's subset
was negative. Keep the implementation improvement and the existing time budgets;
a blanket 50% timer reduction is not established by this experiment.

[Compact results and game move lists](engine-efficiency-results.json) are saved
alongside this report, with source fingerprints and machine information.

## Changes

The search algorithm, evaluation weights, pruning, move order, difficulty depth
caps, and product time budgets remain the same. Two repeated computations were
removed:

- The evaluator builds a packed attack map once while scanning the pieces.
  King pressure, defended pieces, and pawn-restricted mobility share that map.
  Knight/king destinations and sliding rays are precomputed once per module.
  Passed-pawn detection scans the opposing pawns once instead of once for each
  forward rank and adjacent file.
- Legal move generation determines check and absolute pins once per position.
  Outside check, ordinary unpinned moves cannot expose the king, so they skip
  board mutation and another attack scan. Kings, pinned pieces, en passant,
  and check evasions retain the full legality test. Small capture lists also
  keep the direct test, avoiding setup overhead.

The pin-based legality shortcut is a standard engine technique; see the
[Stockfish move generator](https://github.com/official-stockfish/Stockfish/blob/master/src/movegen.cpp).
The implementation here is specific to Spindrift's existing array board and
preserves the original move-list order.

A baseline CPU profile of starting-position depth-8 searches under all three
policies attributed 28.8% of samples to the evaluator's repeated attack queries,
8.3% to garbage collection, and 6.5% to the rules' attack queries. This profile
guided the changes; it is not itself the timing comparison.

## Fixed-depth results

All 108 measured depth-6 search pairs matched exactly across 12 positions and
three levels. The totals below sum the same 36 searches per engine and level;
they are work-weighted speedups, not a claim that every position improves by
the same amount.

| Level | Baseline total | Optimized total | Speedup | Less time for same search | Median paired speedup |
| ----- | -------------: | --------------: | ------: | ------------------------: | --------------------: |
| 4     |       24.126 s |         9.352 s |   2.58× |                     61.2% |                 2.43× |
| 5     |        6.608 s |         2.620 s |   2.52× |                     60.4% |                 2.22× |
| 6     |        5.284 s |         2.275 s |   2.32× |                     56.9% |                 2.12× |

Different levels visit different numbers of nodes at the same nominal depth
because they use different pruning policies. Compare baseline versus optimized
within a row; the times do not rank the difficulty levels' playing strength.

Sparse endings at depth 6 improved by approximately 1.3–1.6×, including the
unchanged event-loop yielding overhead. Most opening/middlegame cases improved
by roughly 2–3×. The geometric mean of paired speedups, which gives tiny and
large searches equal weight, was 2.17× / 2.04× / 1.99× for levels 4 / 5 / 6.

The additional depth-8 subset (Italian, Queen's Gambit, start, pawn ending,
rook ending, promotion) passed all 54 measured search pairs with identical
moves, scores, and counters:

| Level | Baseline total | Optimized total | Speedup | Median paired speedup |
| ----- | -------------: | --------------: | ------: | --------------------: |
| 4     |       55.978 s |        25.074 s |   2.23× |                 2.14× |
| 5     |        8.249 s |         3.798 s |   2.17× |                 1.98× |
| 6     |       10.460 s |         4.741 s |   2.21× |                 2.03× |

In total, 162 measured pairs plus 54 warmup pairs had zero parity failures.

## Half-time headless matches

24 games: four openings (Italian, Queen's Gambit, Sicilian, King's Indian),
both engine colors at each level. Baseline received 300 ms/move and optimized
received 150 ms/move. Every game ended through the referee's normal chess
rules, with zero capped draws, illegal moves, or crashes.

Results are from the optimized engine's perspective:

| Level | Wins | Draws | Losses | Score | Baseline mean move | Optimized mean move |
| ----- | ---: | ----: | -----: | ----: | -----------------: | ------------------: |
| 4     |    1 |     4 |      3 | 37.5% |           234.0 ms |            116.2 ms |
| 5     |    4 |     1 |      3 | 56.3% |           273.4 ms |            135.7 ms |
| 6     |    6 |     2 |      0 | 87.5% |           289.2 ms |            142.6 ms |
| Total |   11 |     7 |      6 | 60.4% |                    |                     |

Mean reported depths were similar: 7.03 → 7.06 at level 4, 8.55 → 8.58 at
level 5, and 8.52 → 8.67 at level 6. These are telemetry comparisons across
different positions, not a substitute for the matched-position benchmarks;
the existing engine can also report a partially searched iteration as completed
when a time limit interrupts root search.

The combined half-time result is encouraging, especially level 6, but level 4
scored below 50%. Eight games per level cannot establish non-inferiority, and
these short time controls do not validate a blanket reduction of the normal
1.5/4/10-second product budgets. The production limits are therefore retained.

## Equal-time control matches

12 additional games used 300 ms/move for both builds, with Italian and Queen's
Gambit openings and colors swapped at every level. Again, there were no capped
draws, illegal moves, or crashes.

| Level | Optimized wins | Draws | Baseline wins | Optimized score |
| ----- | -------------: | ----: | ------------: | --------------: |
| 4     |              4 |     0 |             0 |            100% |
| 5     |              2 |     1 |             1 |           62.5% |
| 6     |              3 |     1 |             0 |           87.5% |
| Total |              9 |     2 |             1 |           83.3% |

This is favorable regression evidence for retaining the current clocks, not
an Elo estimate. The fixed-depth equivalence checks and semantics-preserving
implementation support the no-strength-loss conclusion for equal search work;
the timed matches show how additional completed search can help at equal time.

## Reproduce

Run these sequentially on an otherwise idle host from the project directory:

```sh
node --import tsx tests/matches/compare.ts --baseline-ref aeadf99473d20e8c83f469dfcefd67eb856d7257 --mode benchmark --depths 6 --repeats 3 --output test-results/engine-efficiency/depth6.json
node --import tsx tests/matches/compare.ts --baseline-ref aeadf99473d20e8c83f469dfcefd67eb856d7257 --mode benchmark --depths 8 --positions start,italian,queens-gambit,pawn-endgame,rook-endgame,promotion --repeats 3 --output test-results/engine-efficiency/depth8.json
node --import tsx tests/matches/compare.ts --baseline-ref aeadf99473d20e8c83f469dfcefd67eb856d7257 --mode matches --pairs 4 --movetime 300 --candidate-time-factor 0.5 --max-plies 240 --output test-results/engine-efficiency/half-time-matches.json
node --import tsx tests/matches/compare.ts --baseline-ref aeadf99473d20e8c83f469dfcefd67eb856d7257 --mode matches --pairs 2 --movetime 300 --candidate-time-factor 1 --max-plies 240 --output test-results/engine-efficiency/equal-time-matches.json
```

`pnpm run test:compare` is an alias for `node --import tsx tests/matches/compare.ts`.
Raw reports are generated under the ignored `test-results/` directory and
include exact source fingerprints, options, per-search data, and full games.

## Validation design

The [comparison harness](../tests/matches/README.md) exports the exact baseline
revision to a temporary directory and loads both builds headlessly. The
baseline's rules referee every move.

Fixed-depth comparisons disable the timeout and keep each level's search
policy. Each case has one warmup pair and three measured pairs, run serially
with alternating build order. Both builds start each search with fresh AI
instances and cleared module-level pawn caches. Equality is required for move,
score, completed depth, main nodes, quiescence nodes, transposition-table hits,
cutoffs, timeout, and recursion-ceiling counters.

Matches use paired openings with colors swapped, independent AI instances per
side, and normal cache/history reuse within a game. Checkmate and the existing
referee's draw rules determine results; reaching the ply cap counts as a draw,
never a material-based win. Match telemetry includes every move, position,
budget, elapsed time, score, depth, and search counters.

## Supporting checks

- Final full unit/coverage run: 228 tests in 20 files passed. Coverage met all
  configured gates: statements 91.87%, branches 87.64%, functions 93.8%, lines
  92.9%. Type checking, ESLint, repository-wide formatting, and the production
  build passed.
- An independent replay of all 36 saved games verified every one of the 3,997
  plies against the baseline referee, including each stored FEN and outcome.
- 11,748 seeded and targeted positions produced exactly the same ordered legal
  and capture/promotion move lists as the baseline.
- 4,693 legal positions, both score perspectives and hashed/unhashed evaluation:
  18,772 exact score matches.
- A separate stress comparison matched 80,000 evaluations over 20,000 arbitrary
  boards, including unusual promoted material and missing/duplicate kings.
- Frozen baseline evaluator scores and an independent make/check move-legality
  oracle are included in unit tests. Perft covers starting position depth 4
  (197,281 leaves) and Kiwipete depth 3 (97,862 leaves).

Short component benchmarks found a 3.89× evaluator speedup, 2.35× legal-move
generation speedup, and 1.31× noisy-move generation speedup. These component
numbers must not be presented as whole-engine speedups.

## Scope and limits

Exact search parity is strong evidence that these optimizations preserve the
existing engine's decisions for the same search work. Finite position suites
and small matches cannot prove universal equivalence or establish equal Elo.
Timing depends on JavaScript runtime, hardware, and host load; the measured
ratios need not transfer unchanged to every browser or phone.

The existing engine intentionally fills a time budget at levels 4–6: 1,500 ms
at level 4, 4,000 ms at level 5, and the configured think time (10,000 ms by
default) at level 6. When a depth cap is not reached, faster computation gives
deeper search within that budget. The optimization itself does not shorten
those time limits. Reduced-budget matches test the separate question of
whether some of the gain can instead shorten the wait.

Uncapped mode uses the same optimized functions and level-6 search policy, so
its computation is faster too. Its selected time budget and safety depth cap
of 56 are unchanged; the gain is available for more search within that budget.
Levels 1–3 retain their depth caps of 1/2/3 and their existing randomness and
evaluation policy. They benefit from cheaper shared evaluation/move generation
without being assigned additional search work.

Existing search and cache semantics are preserved, including the pawn cache's
board-dependent passer terms and the referee's existing insufficient-material
rule. Fixing those would change the baseline behavior and require separate
strength validation.
