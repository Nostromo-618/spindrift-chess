/**
 * Serial, headless comparison against an immutable git baseline.
 *
 * node --import tsx tests/matches/compare.ts --baseline-ref HEAD --mode benchmark
 * node --import tsx tests/matches/compare.ts --baseline-ref HEAD --mode matches --pairs 2
 *
 * See tests/matches/README.md for methodology and reporting limitations.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AI, SearchInfo } from "../../js/engine/AI.js";
import type { GameState } from "../../js/engine/GameState.js";
import type { Move, Color } from "../../js/engine/types.js";

interface Build {
  AI: typeof AI;
  GameState: typeof GameState;
  Rules: typeof import("../../js/engine/Rules.js");
  fen: typeof import("../../js/engine/fen.js");
  evaluator: typeof import("../../js/engine/Evaluator.js");
}

interface Options {
  baselineRef?: string;
  baselineDir?: string;
  mode: "benchmark" | "matches" | "all";
  levels: number[];
  depths: number[];
  repeats: number;
  warmups: number;
  pairs: number;
  movetime: number;
  candidateTimeFactor: number;
  maxPlies: number;
  positions?: string[];
  output: string;
}

interface Position {
  name: string;
  fen: string;
}

interface SearchRecord extends SearchInfo {
  move: string;
  elapsedMs: number;
}

interface BenchmarkRecord {
  level: number;
  depth: number;
  position: Position;
  repeat: number;
  first: "baseline" | "candidate";
  baseline: SearchRecord;
  candidate: SearchRecord;
  differences: string[];
  speedup: number;
}

interface MatchMove extends SearchRecord {
  ply: number;
  color: Color;
  engine: "baseline" | "candidate";
  budgetMs: number;
  fen: string;
}

interface MatchRecord {
  level: number;
  pair: number;
  opening: Position;
  candidateColor: Color;
  winner: Color | null;
  candidateScore: number;
  reason: string;
  capped: boolean;
  finalFen: string;
  moves: MatchMove[];
}

// These opening lines are validated by the baseline referee, then recorded as FENs.
const OPENING_LINES = [
  { name: "italian", moves: "e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6" },
  { name: "queens-gambit", moves: "d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7" },
  { name: "sicilian", moves: "e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6" },
  { name: "kings-indian", moves: "d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6" },
];

const EXTRA_POSITIONS: Position[] = [
  { name: "start", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
  { name: "middlegame", fen: "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R w - - 0 10" },
  { name: "kiwipete", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1" },
  { name: "en-passant", fen: "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3" },
  { name: "pawn-endgame", fen: "8/1p1k4/1P6/8/8/8/5PPP/4K3 w - - 0 1" },
  { name: "rook-endgame", fen: "8/5pk1/6p1/7p/7P/5KP1/5P2/1R3r2 w - - 0 40" },
  { name: "promotion", fen: "8/P7/8/8/8/8/1p6/4K2k w - - 0 1" },
  { name: "check-regression", fen: "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20" },
];

function parseOptions(): Options {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`Usage: node --import tsx tests/matches/compare.ts --baseline-ref REF [options]
  --baseline-dir DIR          Use an existing baseline snapshot instead of git archive
  --mode benchmark|matches|all (default all)
  --levels 4,5,6              Level policies to exercise
  --depths 3                  Fixed depths for benchmark, timeout disabled
  --repeats 3 --warmups 1     Measured pairs and unmeasured warmup pairs per case
  --positions NAME,...       Benchmark subset (default all 12)
  --pairs 2                  Opening pairs per level: 2 * pairs games per level
  --movetime 200              Baseline milliseconds per move
  --candidate-time-factor 1  Candidate budget multiplier (e.g. 0.67)
  --max-plies 400             Draw if still ongoing at this many played plies
  --output PATH              JSON report (default test-results/engine-comparison.json)
Benchmark positions: ${[...OPENING_LINES, ...EXTRA_POSITIONS].map((p) => p.name).join(", ")}`);
    process.exit(0);
  }
  const values = new Map<string, string>();
  const allowed = new Set([
    "baseline-ref",
    "baseline-dir",
    "mode",
    "levels",
    "depths",
    "repeats",
    "warmups",
    "positions",
    "pairs",
    "movetime",
    "candidate-time-factor",
    "max-plies",
    "output",
  ]);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const value = args[i + 1];
    if (
      !args[i]?.startsWith("--") ||
      !key ||
      !allowed.has(key) ||
      !value ||
      value.startsWith("--")
    ) {
      throw new Error(`Invalid option ${args[i] ?? ""}; use --help`);
    }
    if (values.has(key)) throw new Error(`Repeated option --${key}`);
    values.set(key, value);
  }
  const number = (key: string, fallback: number, allowZero = false, integer = true): number => {
    const value = Number(values.get(key) ?? fallback);
    if (
      !Number.isFinite(value) ||
      (allowZero ? value < 0 : value <= 0) ||
      (integer && !Number.isInteger(value))
    ) {
      throw new Error(`Invalid --${key}`);
    }
    return value;
  };
  const list = (key: string, fallback: string, min: number, max: number): number[] => {
    const result = (values.get(key) ?? fallback).split(",").map(Number);
    if (!result.length || result.some((n) => !Number.isInteger(n) || n < min || n > max)) {
      throw new Error(`Invalid --${key}`);
    }
    return [...new Set(result)];
  };
  const mode = values.get("mode") ?? "all";
  if (mode !== "benchmark" && mode !== "matches" && mode !== "all")
    throw new Error("Invalid --mode");
  if (values.has("baseline-ref") === values.has("baseline-dir")) {
    throw new Error("Specify exactly one of --baseline-ref or --baseline-dir");
  }
  return {
    baselineRef: values.get("baseline-ref"),
    baselineDir: values.get("baseline-dir"),
    mode,
    levels: list("levels", "4,5,6", 4, 6),
    depths: list("depths", "3", 1, 12),
    repeats: number("repeats", 3),
    warmups: number("warmups", 1, true),
    pairs: number("pairs", 2),
    movetime: number("movetime", 200),
    candidateTimeFactor: number("candidate-time-factor", 1, false, false),
    maxPlies: number("max-plies", 400),
    positions: values.get("positions")?.split(","),
    output: resolve(values.get("output") ?? "test-results/engine-comparison.json"),
  };
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function loadBuild(directory: string): Promise<Build> {
  const load = (file: string): Promise<Record<string, unknown>> =>
    import(pathToFileURL(join(directory, "js/engine", file)).href);
  const [ai, state, rules, fen, evaluator] = await Promise.all([
    load("AI.ts"),
    load("GameState.ts"),
    load("Rules.ts"),
    load("fen.ts"),
    load("Evaluator.ts"),
  ]);
  return { AI: ai.AI, GameState: state.GameState, Rules: rules, fen, evaluator } as Build;
}

function sourceHash(directory: string): string {
  const hash = createHash("sha256");
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(directory, relative), { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name.endsWith(".ts")) {
        hash
          .update(child)
          .update("\0")
          .update(readFileSync(join(directory, child)))
          .update("\0");
      }
    }
  };
  walk("js/engine");
  return hash.digest("hex");
}

function moveId(move: Move | null): string {
  return move ? `${move.from}${move.to}${move.promotion?.toLowerCase() ?? ""}` : "(none)";
}

function stateFromFen(build: Build, fen: string): GameState {
  const gs = new build.GameState(build.fen.parseFen(fen));
  gs.recordRepetitionKey();
  gs.updateResult();
  return gs;
}

function openings(build: Build): Position[] {
  return OPENING_LINES.map(({ name, moves }) => {
    const gs = build.GameState.createStarting("white");
    for (const id of moves.split(" ")) {
      const legal = build.Rules.generateLegalMoves(gs.asRulesState()).find(
        (move) => moveId(move) === id,
      );
      if (!legal) throw new Error(`Illegal opening move ${name}: ${id}`);
      gs.applyMove(legal);
    }
    return { name, fen: build.fen.gameStateToFen(gs) };
  });
}

async function search(
  ai: AI,
  gs: GameState,
  level: number,
  timeout: number,
  referee: Build,
): Promise<SearchRecord> {
  // Independent copies prevent either engine from changing the referee's board/history.
  const serialized = structuredClone({ ...gs.serialize(), ...gs.asRulesState() });
  const history = structuredClone(gs.getReversibleHistory());
  const started = performance.now();
  const move = await ai.findBestMove(serialized, {
    level,
    forColor: gs.activeColor,
    timeout,
    history,
  });
  const elapsedMs = performance.now() - started;
  const info = ai.getLastSearchInfo();
  const id = moveId(move);
  const legal = referee.Rules.generateLegalMoves(gs.asRulesState());
  if (!move || !legal.some((candidate) => moveId(candidate) === id)) {
    throw new Error(`Illegal engine move ${id} from ${referee.fen.gameStateToFen(gs)}`);
  }
  if (info.bestScore !== null && !Number.isFinite(info.bestScore))
    throw new Error(`Nonfinite score for ${id}`);
  return { move: id, elapsedMs, ...info };
}

function differences(a: SearchRecord, b: SearchRecord): string[] {
  const fields = [
    "move",
    "bestScore",
    "depthCompleted",
    "nodes",
    "qNodes",
    "ttHits",
    "cutoffs",
    "timedOut",
    "plyCeilingHits",
    "qCeilingHits",
  ] as const;
  return fields.filter((field) => a[field] !== b[field]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function benchmarkSummary(records: BenchmarkRecord[], levels: number[]) {
  return levels.map((level) => {
    const rows = records.filter((row) => row.level === level);
    const baselineMs = rows.reduce((sum, row) => sum + row.baseline.elapsedMs, 0);
    const candidateMs = rows.reduce((sum, row) => sum + row.candidate.elapsedMs, 0);
    return {
      level,
      searches: rows.length,
      parityFailures: rows.filter((row) => row.differences.length).length,
      baselineMs,
      candidateMs,
      aggregateSpeedup: baselineMs / candidateMs,
      medianPairedSpeedup: median(rows.map((row) => row.speedup)),
      geometricMeanSpeedup: Math.exp(
        rows.reduce((sum, row) => sum + Math.log(row.speedup), 0) / rows.length,
      ),
    };
  });
}

function matchSummary(records: MatchRecord[], levels: number[]) {
  return levels.map((level) => {
    const games = records.filter((game) => game.level === level);
    const candidateWins = games.filter((game) => game.candidateScore === 1).length;
    const baselineWins = games.filter((game) => game.candidateScore === 0).length;
    const draws = games.filter((game) => game.candidateScore === 0.5).length;
    const engineStats = (["baseline", "candidate"] as const).map((engine) => {
      const moves = games.flatMap((game) => game.moves.filter((move) => move.engine === engine));
      const elapsedMs = moves.reduce((sum, move) => sum + move.elapsedMs, 0);
      const nodes = moves.reduce((sum, move) => sum + move.nodes + move.qNodes, 0);
      return {
        engine,
        moves: moves.length,
        elapsedMs,
        averageMoveMs: elapsedMs / moves.length,
        averageDepth: moves.reduce((sum, move) => sum + move.depthCompleted, 0) / moves.length,
        nodes,
        nodesPerSecond: (nodes / elapsedMs) * 1000,
      };
    });
    return {
      level,
      games: games.length,
      candidateWins,
      baselineWins,
      draws,
      cappedDraws: games.filter((game) => game.capped).length,
      candidateScore: (candidateWins + draws / 2) / games.length,
      engineStats,
    };
  });
}

async function playMatch(
  baseline: Build,
  candidate: Build,
  options: Options,
  opening: Position,
  level: number,
  pair: number,
  candidateColor: Color,
): Promise<MatchRecord> {
  const gs = stateFromFen(baseline, opening.fen);
  baseline.evaluator.clearPawnHash();
  candidate.evaluator.clearPawnHash();
  const ais = { baseline: new baseline.AI(), candidate: new candidate.AI() };
  const moves: MatchMove[] = [];
  while (!gs.isGameOver() && moves.length < options.maxPlies) {
    const color = gs.activeColor;
    const engine = color === candidateColor ? "candidate" : "baseline";
    const budgetMs = Math.max(
      1,
      Math.round(options.movetime * (engine === "candidate" ? options.candidateTimeFactor : 1)),
    );
    const result = await search(ais[engine], gs, level, budgetMs, baseline);
    moves.push({
      ply: moves.length + 1,
      color,
      engine,
      budgetMs,
      fen: baseline.fen.gameStateToFen(gs),
      ...result,
    });
    const legal = baseline.Rules.generateLegalMoves(gs.asRulesState()).find(
      (move) => moveId(move) === result.move,
    )!;
    gs.applyMove(legal);
    if (moves.length % 50 === 0)
      console.log(`  L${level} ${opening.name} candidate=${candidateColor}: ${moves.length} plies`);
  }
  const winner = gs.result?.outcome === "checkmate" ? (gs.result.winner ?? null) : null;
  const capped = !gs.isGameOver();
  return {
    level,
    pair,
    opening,
    candidateColor,
    winner,
    candidateScore: winner === null ? 0.5 : winner === candidateColor ? 1 : 0,
    reason: capped ? "draw at ply cap" : (gs.result?.reason ?? gs.result?.outcome ?? "draw"),
    capped,
    finalFen: baseline.fen.gameStateToFen(gs),
    moves,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const candidateDir = process.cwd();
  const startedAt = new Date().toISOString();
  let temp: string | undefined;
  const baselineCommit = options.baselineRef
    ? git("rev-parse", "--verify", `${options.baselineRef}^{commit}`)
    : null;
  try {
    let baselineDir = options.baselineDir ? resolve(options.baselineDir) : undefined;
    if (!baselineDir) {
      temp = mkdtempSync(join(tmpdir(), "spindrift-compare-"));
      baselineDir = temp;
      const archive = execFileSync(
        "git",
        ["archive", baselineCommit!, "js/engine", "package.json"],
        { maxBuffer: 32 * 1024 * 1024 },
      );
      execFileSync("tar", ["-x", "-C", baselineDir], { input: archive });
    }
    const [baseline, candidate] = await Promise.all([
      loadBuild(baselineDir),
      loadBuild(candidateDir),
    ]);
    const provenance = {
      startedAt,
      command: process.argv,
      baselineCommit,
      baselineDir: options.baselineDir ?? "temporary git archive",
      baselineEngineSha256: sourceHash(baselineDir),
      candidateCommit: git("rev-parse", "HEAD"),
      candidateBranch: git("branch", "--show-current"),
      candidateStatus: git("status", "--short"),
      candidateEngineSha256: sourceHash(candidateDir),
      candidateEngineDiff: git("diff", "HEAD", "--", "js/engine"),
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      execution:
        "serial; alternating build order; fresh AI per fixed-depth search; persistent AI per game side",
    };
    const benchmark: BenchmarkRecord[] = [];
    const matches: MatchRecord[] = [];
    const failures: string[] = [];
    const save = (complete = false): void => {
      mkdirSync(dirname(options.output), { recursive: true });
      writeFileSync(
        options.output,
        JSON.stringify(
          {
            provenance,
            options,
            complete,
            updatedAt: new Date().toISOString(),
            limitations: [
              "Timing depends on host load; run benchmark without other CPU-heavy tasks.",
              "A small match sample cannot establish Elo equivalence or prove universal absence of strength loss.",
              "Fixed-depth parity proves the reported moves, scores and search counters match only on the sampled positions.",
              "Ply-capped games count as draws regardless of material/evaluation; no resignations.",
            ],
            failures,
            benchmarkSummary: benchmark.length ? benchmarkSummary(benchmark, options.levels) : [],
            matchSummary: matches.length ? matchSummary(matches, options.levels) : [],
            benchmark,
            matches,
          },
          null,
          2,
        ) + "\n",
      );
    };
    save();
    try {
      const openingPositions = openings(baseline);
      if (options.mode !== "matches") {
        const allPositions = [...openingPositions, ...EXTRA_POSITIONS];
        for (const name of options.positions ?? [])
          if (!allPositions.some((p) => p.name === name))
            throw new Error(`Unknown position ${name}`);
        const positions = allPositions.filter(
          (p) => !options.positions || options.positions.includes(p.name),
        );
        let orderIndex = 0;
        for (const level of options.levels)
          for (const depth of options.depths)
            for (const position of positions) {
              console.log(
                `Benchmark L${level} depth=${depth} ${position.name}: ${options.warmups} warmup + ${options.repeats} measured pairs`,
              );
              for (let repeat = -options.warmups; repeat < options.repeats; repeat++) {
                const first = orderIndex++ % 2 === 0 ? "baseline" : "candidate";
                const results = {} as Record<"baseline" | "candidate", SearchRecord>;
                for (const label of first === "baseline"
                  ? (["baseline", "candidate"] as const)
                  : (["candidate", "baseline"] as const)) {
                  const build = label === "baseline" ? baseline : candidate;
                  build.evaluator.clearPawnHash();
                  const ai = new build.AI();
                  ai.depthForLevel[level] = depth;
                  results[label] = await search(
                    ai,
                    stateFromFen(baseline, position.fen),
                    level,
                    0,
                    baseline,
                  );
                  if (results[label].timedOut || results[label].depthCompleted !== depth)
                    throw new Error(`Incomplete fixed-depth search: ${label} ${position.name}`);
                }
                const diff = differences(results.baseline, results.candidate);
                if (repeat >= 0)
                  benchmark.push({
                    level,
                    depth,
                    position,
                    repeat,
                    first,
                    ...results,
                    differences: diff,
                    speedup: results.baseline.elapsedMs / results.candidate.elapsedMs,
                  });
                if (diff.length)
                  failures.push(
                    `L${level} depth=${depth} ${position.name} repeat=${repeat}: ${diff.join(", ")}`,
                  );
              }
              save();
            }
        console.log(JSON.stringify(benchmarkSummary(benchmark, options.levels), null, 2));
      }
      if (options.mode !== "benchmark") {
        // Each opening is played with both colors; alternate which color is played first.
        for (const level of options.levels)
          for (let pair = 0; pair < options.pairs; pair++) {
            const opening = openingPositions[pair % openingPositions.length]!;
            const colors: Color[] = pair % 2 ? ["black", "white"] : ["white", "black"];
            for (const candidateColor of colors) {
              console.log(
                `Match L${level} pair=${pair + 1}/${options.pairs} ${opening.name} candidate=${candidateColor}`,
              );
              const result = await playMatch(
                baseline,
                candidate,
                options,
                opening,
                level,
                pair,
                candidateColor,
              );
              matches.push(result);
              console.log(
                `  ${result.reason}; winner=${result.winner ?? "draw"}; plies=${result.moves.length}`,
              );
              save();
            }
          }
        console.log(JSON.stringify(matchSummary(matches, options.levels), null, 2));
      }
      if (sourceHash(candidateDir) !== provenance.candidateEngineSha256)
        failures.push(
          "Candidate engine source changed during this run; results are not attributable to final files",
        );
      save(true);
    } catch (error) {
      failures.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
      save();
      throw error;
    }
    console.log(`Report: ${options.output}`);
    if (failures.length) {
      console.error(`${failures.length} comparison failure(s)`);
      process.exitCode = 1;
    }
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
