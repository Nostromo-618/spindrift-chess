# engine-selfplay-harness Specification

## Purpose

Quality-gate harness for Spindrift Engine self-play. This is **not** a product
feature — the shipped app is human vs Spindrift Engine only.

## Requirements

### Requirement: All-levels Spindrift-vs-Spindrift self-play

The project SHALL provide a headless Node harness that plays complete games of
Spindrift Engine against itself at **every** strength level 1–6, and reports
win/loss/draw counts per level. Crashes, thrown errors, and illegal-move returns
SHALL fail the gate.

#### Scenario: Self-play gate covers every level

- **WHEN** `pnpm run test:selfplay` is run
- **THEN** levels 1 through 6 each play the configured number of games to a
  terminal result (checkmate, stalemate, draw, or adjudication)

#### Scenario: Illegal or crashing moves fail the gate

- **WHEN** a side returns a move that is not legal, or throws during search
- **THEN** the harness records a failure and exits non-zero

### Requirement: Parallel local execution

Local runs SHALL parallelize across levels (and games within a level) up to the
host's available parallelism, overridable via `SPINDRIFT_SELFPLAY_JOBS`.

#### Scenario: Jobs env is respected

- **WHEN** `SPINDRIFT_SELFPLAY_JOBS` is set to a positive integer
- **THEN** the harness uses that concurrency budget

### Requirement: Fair and terminating games

Harness games SHALL use identical time budgets for both sides and SHALL
terminate via standard draw rules or adjudication (ply cap / stable losing eval)
so a match cannot run forever.

#### Scenario: Games do not run unbounded

- **WHEN** a game reaches the configured ply cap without a terminal chess result
- **THEN** the harness adjudicates the game rather than continuing indefinitely
