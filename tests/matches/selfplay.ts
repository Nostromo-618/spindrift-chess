/**
 * Spindrift Engine vs Spindrift Engine self-play gate (all levels 1–6).
 *
 *   pnpm run test:selfplay
 *   SPINDRIFT_SELFPLAY_GAMES=4 SPINDRIFT_SELFPLAY_MOVETIME=200 SPINDRIFT_SELFPLAY_JOBS=16 pnpm run test:selfplay
 */
import { availableParallelism } from "node:os";
import { AI } from "../../js/engine/AI.js";
import { GameState } from "../../js/engine/GameState.js";
import * as Rules from "../../js/engine/Rules.js";
import { makePlayer, playGame, type EngineBuild } from "./lib/play.js";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;
const gamesPerLevel = intEnv("SPINDRIFT_SELFPLAY_GAMES", 4);
const movetime = intEnv("SPINDRIFT_SELFPLAY_MOVETIME", 200);
const maxPlies = intEnv("SPINDRIFT_SELFPLAY_MAXPLIES", 400);
const jobs = intEnv("SPINDRIFT_SELFPLAY_JOBS", availableParallelism());

const build: EngineBuild = {
  AI: AI as unknown as EngineBuild["AI"],
  GameState: GameState as unknown as EngineBuild["GameState"],
  Rules,
};

interface LevelResult {
  level: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
  failures: string[];
  elapsedMs: number;
}

async function runLevel(level: number): Promise<LevelResult> {
  const started = Date.now();
  let whiteWins = 0;
  let blackWins = 0;
  let draws = 0;
  const failures: string[] = [];

  const gameIndexes = Array.from({ length: gamesPerLevel }, (_, i) => i);
  const concurrency = Math.max(1, Math.floor(jobs / LEVELS.length));
  const results = await mapPool(gameIndexes, concurrency, async () => {
    return playGame({
      driver: { GameState: build.GameState, Rules: build.Rules },
      white: makePlayer(build, "Spindrift-W"),
      black: makePlayer(build, "Spindrift-B"),
      level,
      movetime,
      maxPlies,
    });
  });

  for (const r of results) {
    if (r.reason.includes("threw") || r.reason.includes("no legal move")) {
      failures.push(r.reason);
      continue;
    }
    if (r.winner === "white") whiteWins += 1;
    else if (r.winner === "black") blackWins += 1;
    else draws += 1;
  }

  return {
    level,
    whiteWins,
    blackWins,
    draws,
    failures,
    elapsedMs: Date.now() - started,
  };
}

async function main(): Promise<void> {
  console.log(
    `Spindrift self-play: levels=${LEVELS.join(",")} games/level=${gamesPerLevel} movetime=${movetime}ms jobs≈${jobs}`,
  );

  const started = Date.now();
  const levelResults = await mapPool([...LEVELS], Math.min(jobs, LEVELS.length), runLevel);

  let ok = true;
  for (const r of levelResults.sort((a, b) => a.level - b.level)) {
    const total = r.whiteWins + r.blackWins + r.draws;
    const failed = r.failures.length > 0 || total !== gamesPerLevel;
    if (failed) ok = false;
    console.log(
      `${failed ? "FAIL" : "OK  "} level ${r.level}: W=${r.whiteWins} B=${r.blackWins} D=${r.draws}` +
        ` failures=${r.failures.length} (${(r.elapsedMs / 1000).toFixed(1)}s)`,
    );
    for (const f of r.failures) console.log(`       ${f}`);
  }

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!ok) {
    console.error("SELF-PLAY GATE FAILED");
    process.exit(1);
  }
  console.log("SELF-PLAY GATE OK");
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
