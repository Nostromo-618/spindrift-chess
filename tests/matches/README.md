# Engine comparisons

`compare.ts` loads an immutable baseline exported by `git archive` and the current
working tree in one headless Node process. It never checks out or edits the
baseline ref. No additional dependency installation is needed. Alternatively,
pass `--baseline-dir /path/to/snapshot` (the report then identifies it by its
engine source SHA-256, without claiming a Git revision).

```sh
# Fixed-depth parity and timing, policies 4, 5 and 6; run on an otherwise idle host.
node --import tsx tests/matches/compare.ts --baseline-ref BASELINE_SHA --mode benchmark --depths 3,4 --repeats 3 --output test-results/engine-benchmark.json

# 12 actual games: two opening pairs per level, both colors, equal time budgets.
node --import tsx tests/matches/compare.ts --baseline-ref BASELINE_SHA --mode matches --pairs 2 --movetime 200 --output test-results/engine-matches-equal.json

# 24 games with the candidate receiving two thirds as much thinking time.
node --import tsx tests/matches/compare.ts --baseline-ref BASELINE_SHA --mode matches --pairs 4 --movetime 300 --candidate-time-factor 0.67 --output test-results/engine-matches-faster.json
```

Use `--help` for all controls, including subsets of positions and levels. `all`
runs both phases. Keep CPU-heavy tests and other engine matches stopped while
measuring speed. Changes to engine files during a run invalidate the report and
cause a nonzero exit.

## Fixed-depth measurements

Each level retains its normal search/evaluation policy. Only its public depth
cap is overridden, and `timeout: 0` disables wall-clock stopping. Fresh AI
instances prevent transposition/evaluation cache carry-over, and the evaluator's
module-level pawn cache is cleared before each independent search. Both engines
receive independent copies of the exact same position and history. Each case
has unmeasured warmup pairs, followed by serial measured pairs with alternating
baseline/candidate order. Engine construction and referee work are outside the
search timer. The timer includes the engine's normal event-loop yields.

The suite covers four validated opening lines, the initial board, tactical
middlegames, castling, en passant, promotion, pawn/rook endings and the historical
check-extension regression. Returned move (including exact promotion), score,
completed depth, main/quiescence node counts, TT hits, cutoffs, timeout and ceiling
counters must match. A mismatch exits nonzero and is retained in JSON. This
strict gate is appropriate for optimizations intended to preserve the search
tree; a deliberate search-policy change needs a different acceptance criterion.

Per-search raw data, aggregate time ratios, median paired ratios and geometric
mean ratios are retained. A speedup above 1 means the candidate is faster. A
small or noisy timing difference should not be presented as a reliable gain.

## Engine versus engine games

The baseline's rules and game-state code referee every move, rejecting missing,
illegal or wrong-promotion results. Each engine retains its own AI instance
throughout a game, matching the product's cache reuse. Module-level pawn caches
are cleared between games. Both sides receive the
same reversible game history. There is no opening book after the common eight
opening plies. The opening FEN starts a fresh game-history window for both sides;
repetitions before that FEN are not seeded. Each opening is played twice with engine colors swapped. More
than four pairs repeat the four opening lines and should not be described as
additional independent opening diversity.

Games finish through the referee's chess rules (checkmate, stalemate, threefold,
fifty-move or insufficient-material draw), or count as a **draw** at the ply cap.
There is no material/evaluation win adjudication and no resignation. Reports
distinguish capped draws and store every move's FEN, elapsed time, budget, score,
depth and search counters. Crashes or illegal moves fail the run. Existing
referee limitations, including its approximate insufficient-material rule, apply
equally to both builds.

Small paired matches are regression evidence, not a statistical proof of equal
Elo. Report the sample size, time budgets, W/D/L, capped draws and timing data
together. Same-tree parity supplies a stronger check on an implementation-only
optimization than a handful of games alone, but remains limited to the sampled
positions. Report JSON includes commit/source fingerprints, dirty diff, command,
Node version, host CPU, exact options and FENs for reproducibility.
