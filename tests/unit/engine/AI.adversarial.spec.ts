/**
 * Adversarial search reliability + strength/speed sanity for the ply-ceiling fix.
 *
 * Goals:
 * 1. Stack overflow cannot be provoked by pathological / tactical positions.
 * 2. MAX_PLY / MAX_QPLY do not fire during normal L4–L6 searches (no strength loss).
 * 3. Known tactics still resolve correctly (strength preserved).
 * 4. Throughput under fixed time stays in a healthy band (speed not gutted).
 */
import { describe, expect, it } from "vitest";
import { AI, MAX_PLY, MAX_QPLY, SearchState } from "../../../js/engine/AI.js";
import { parseFen } from "../../../js/engine/fen.js";
import { generateLegalMoves, isInCheck } from "../../../js/engine/Rules.js";
import { GameState } from "../../../js/engine/GameState.js";
import type { Color, Move } from "../../../js/engine/types.js";

function moveKey(m: Move | null): string {
  if (!m) return "";
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

function legalKeys(fen: string): Set<string> {
  return new Set(generateLegalMoves(parseFen(fen)).map((m) => moveKey(m)));
}

async function searchFen(
  fen: string,
  opts: { level?: number; timeout?: number; uncapped?: boolean; forColor?: Color } = {},
) {
  const state = parseFen(fen);
  const color = opts.forColor ?? state.activeColor;
  const ai = new AI();
  const move = await ai.findBestMove(state, {
    level: opts.level ?? 6,
    forColor: color,
    timeout: opts.timeout ?? 2000,
    uncapped: opts.uncapped,
  });
  return { ai, move, state, color, info: ai.getLastSearchInfo() };
}

function instrumentMaxPly(ai: AI): { maxMinimaxPly: () => number; maxQDepth: () => number } {
  let maxMinimaxPly = 0;
  let maxQDepth = 0;
  const origM = ai.minimax.bind(ai);
  const origQ = ai.quiescence.bind(ai);
  ai.minimax = ((...args: Parameters<AI["minimax"]>) => {
    const ply = args[10] ?? 0;
    if (ply > maxMinimaxPly) maxMinimaxPly = ply;
    return origM(...args);
  }) as AI["minimax"];
  ai.quiescence = ((...args: Parameters<AI["quiescence"]>) => {
    const qDepth = args[9] ?? 0;
    if (qDepth > maxQDepth) maxQDepth = qDepth;
    return origQ(...args);
  }) as AI["quiescence"];
  return {
    maxMinimaxPly: () => maxMinimaxPly,
    maxQDepth: () => maxQDepth,
  };
}

/** Corpus of positions that historically stress search / quiescence / promotions. */
const ADVERSARIAL_FENS: { name: string; fen: string; note: string }[] = [
  {
    name: "reported-crash-middlegame",
    fen: "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20",
    note: "original worker stack-overflow board",
  },
  {
    name: "side-to-move-in-check",
    fen: "4k3/8/8/7Q/8/8/1q6/R3K2R b KQ - 0 1",
    note: "king in check with heavy pieces",
  },
  {
    name: "promotion-race",
    fen: "8/P7/8/8/8/8/1p6/4K2k w - - 0 1",
    note: "both sides about to promote",
  },
  {
    name: "underpromotion-tactics",
    fen: "3r4/2P1k3/8/8/8/8/8/4K3 w - - 0 1",
    note: "promotion while rook hangs / checks",
  },
  {
    name: "dense-capture-net",
    fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    note: "Kiwipete — high branching / captures",
  },
  {
    name: "en-passant-tactical",
    fen: "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
    note: "en passant available in open position",
  },
  {
    name: "queen-rook-king-hunt",
    fen: "4k3/8/8/8/8/8/4Q3/R3K3 w Q - 0 1",
    note: "forcing checks toward mate",
  },
  {
    name: "opposite-castling-messy",
    fen: "r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R w - - 0 10",
    note: "sharp middlegame after opposite castling",
  },
  {
    name: "advanced-passer-storm",
    fen: "8/1p1k4/1P6/8/8/8/5PPP/4K3 w - - 0 1",
    note: "passed pawns near promotion",
  },
  {
    name: "bare-kings-plus-checks",
    fen: "8/8/1q6/4k3/8/4K3/1Q6/8 w - - 0 1",
    note: "queen checks / perpetual patterns",
  },
  {
    name: "back-rank-mate-net",
    fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
    note: "classic back-rank theme",
  },
  {
    name: "smothered-mate-pattern",
    fen: "6rk/6pp/8/4N3/8/8/8/4K3 w - - 0 1",
    note: "knight mating patterns near corner",
  },
];

describe("AI - Adversarial stack & reliability", () => {
  it.each(ADVERSARIAL_FENS)(
    "survives $name at level 6 without throw or illegal move",
    async ({ fen }) => {
      const keys = legalKeys(fen);
      expect(keys.size).toBeGreaterThan(0);
      const { move, info } = await searchFen(fen, { level: 6, timeout: 2500 });
      expect(move).not.toBeNull();
      expect(keys.has(moveKey(move))).toBe(true);
      expect(info.depthCompleted).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(info.nodes)).toBe(true);
    },
    12_000,
  );

  it("survives every adversarial FEN at levels 4 and 5", async () => {
    for (const level of [4, 5] as const) {
      for (const { fen, name } of ADVERSARIAL_FENS) {
        const keys = legalKeys(fen);
        const { move, info } = await searchFen(fen, { level, timeout: 1200 });
        expect(move, `${name} L${level}`).not.toBeNull();
        expect(keys.has(moveKey(move)), `${name} L${level} illegal`).toBe(true);
        expect(info.depthCompleted).toBeGreaterThanOrEqual(1);
      }
    }
  }, 120_000);

  it("survives uncapped search on the crash FEN and Kiwipete", async () => {
    for (const fen of [
      "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20",
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    ]) {
      const keys = legalKeys(fen);
      const { move, info } = await searchFen(fen, {
        level: 6,
        timeout: 3000,
        uncapped: true,
      });
      expect(move).not.toBeNull();
      expect(keys.has(moveKey(move))).toBe(true);
      expect(info.depthCompleted).toBeGreaterThanOrEqual(1);
    }
  }, 20_000);

  it("repeated crash-FEN searches stay legal and stable", async () => {
    const fen = "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20";
    const keys = legalKeys(fen);
    const moves = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { move, info } = await searchFen(fen, { level: 6, timeout: 4000 });
      expect(move).not.toBeNull();
      expect(keys.has(moveKey(move))).toBe(true);
      expect(info.plyCeilingHits).toBe(0);
      expect(info.qCeilingHits).toBe(0);
      moves.add(moveKey(move));
    }
    // Level 6 is deterministic — all trials should agree.
    expect(moves.size).toBe(1);
  }, 45_000);

  it("quiescence on a capture-heavy node returns finite scores", () => {
    const fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    const ai = new AI();
    ai.repetitionSet = new Set();
    const state = new SearchState(parseFen(fen));
    const score = ai.quiescence(state, -1e9, 1e9, "white", 0, undefined, undefined, 6, 0, 0);
    expect(score).not.toBeNull();
    expect(Number.isFinite(score!)).toBe(true);
  });

  it("draw-by-repetition inside quiescence returns 0", () => {
    const fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    const ai = new AI();
    const state = new SearchState(parseFen(fen));
    ai.repetitionSet = new Set([state.hash]);
    const score = ai.quiescence(state, -1e9, 1e9, "white", 42, undefined, undefined, 6, 1, 0);
    expect(score).toBe(0);
  });
});

describe("AI - Strength preserved (ceilings idle in normal play)", () => {
  it("never hits ply/Q ceilings on the adversarial corpus at L6", async () => {
    let globalMaxPly = 0;
    let globalMaxQ = 0;

    for (const { fen, name } of ADVERSARIAL_FENS) {
      const ai = new AI();
      const probe = instrumentMaxPly(ai);
      const state = parseFen(fen);
      await ai.findBestMove(state, {
        level: 6,
        forColor: state.activeColor,
        timeout: 2000,
      });
      const info = ai.getLastSearchInfo();
      expect(info.plyCeilingHits, name).toBe(0);
      expect(info.qCeilingHits, name).toBe(0);
      globalMaxPly = Math.max(globalMaxPly, probe.maxMinimaxPly());
      globalMaxQ = Math.max(globalMaxQ, probe.maxQDepth());
    }

    // Healthy margin: normal tactical search stays well below the safety rails.
    expect(globalMaxPly).toBeLessThan(MAX_PLY / 2);
    expect(globalMaxQ).toBeLessThan(MAX_QPLY);
    // And we did actually search some depth (instrumentation worked).
    expect(globalMaxPly).toBeGreaterThan(0);
  }, 90_000);

  it("hits decisive tactics at level 6 (strength smoke)", async () => {
    const cases: { fen: string; expectAny: string[]; name: string }[] = [
      {
        name: "hanging queen",
        fen: "3q2k1/8/8/8/8/8/8/3Q2K1 w - - 0 1",
        expectAny: ["d1d8"],
      },
      {
        name: "promote to queen",
        fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
        expectAny: ["a7a8Q"],
      },
      {
        name: "take hanging rook",
        fen: "3r2k1/8/8/8/8/8/8/3Q2K1 w - - 0 1",
        expectAny: ["d1d8"],
      },
      {
        name: "back rank mate",
        fen: "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
        expectAny: ["d1d8"],
      },
      {
        name: "mate in one with queen",
        fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        expectAny: ["f7f8", "f7g8", "f7h7", "f7g7"],
      },
    ];

    let hits = 0;
    for (const c of cases) {
      const { move, info } = await searchFen(c.fen, { level: 6, timeout: 1500 });
      const key = moveKey(move);
      const hit = c.expectAny.includes(key);
      if (hit) hits += 1;
      expect(info.plyCeilingHits).toBe(0);
      expect(move, c.name).not.toBeNull();
    }
    // Require a strong majority — all five is ideal; allow one miss under time.
    expect(hits).toBeGreaterThanOrEqual(4);
  }, 20_000);

  it("level 6 is deterministic on forcing tactics", async () => {
    const fen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    const a = await searchFen(fen, { level: 6, timeout: 800 });
    const b = await searchFen(fen, { level: 6, timeout: 800 });
    expect(moveKey(a.move)).toBe(moveKey(b.move));
    expect(moveKey(a.move)).toBe("a7a8Q");
  }, 10_000);

  it("levels 1-3 stay shallow (CPU-light policy unchanged)", async () => {
    for (const level of [1, 2, 3] as const) {
      const { info, move } = await searchFen(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        { level, timeout: 3000 },
      );
      expect(move).not.toBeNull();
      expect(info.depthCompleted).toBeLessThanOrEqual(level === 1 ? 1 : level);
    }
  }, 20_000);
});

describe("AI - Speed sanity", () => {
  it("completes a 1s start-position L6 search with healthy node throughput", async () => {
    const started = performance.now();
    const { move, info } = await searchFen(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      { level: 6, timeout: 1000 },
    );
    const elapsed = performance.now() - started;
    expect(move).not.toBeNull();
    expect(info.plyCeilingHits).toBe(0);
    expect(info.qCeilingHits).toBe(0);
    expect(info.depthCompleted).toBeGreaterThanOrEqual(3);
    // Throughput floor — absolute node counts vary a lot across hosts (CI shared
    // runners often land in the low thousands for 1s). Assert a soft floor plus
    // nodes/ms so a gutted hot path still fails without flake on slow runners.
    expect(info.nodes).toBeGreaterThan(1_000);
    expect(info.nodes / Math.max(elapsed, 1)).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(2500);
  }, 10_000);

  it("returns promptly on a 5ms budget", async () => {
    const started = performance.now();
    const { move } = await searchFen(
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
      { level: 6, timeout: 5 },
    );
    expect(move).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  }, 5_000);
});

describe("AI - Multi-ply game reliability", () => {
  it("plays 24 legal plies from start at level 4 without errors", async () => {
    const gs = GameState.createStarting("white");
    const ai = new AI();
    for (let i = 0; i < 24; i++) {
      const legal = generateLegalMoves(gs.asRulesState());
      expect(legal.length).toBeGreaterThan(0);
      const move = await ai.findBestMove(gs, {
        level: 4,
        forColor: gs.activeColor,
        timeout: 400,
      });
      expect(move).not.toBeNull();
      expect(
        legal.some(
          (m) =>
            m.from === move!.from &&
            m.to === move!.to &&
            (m.promotion ?? null) === (move!.promotion ?? null),
        ),
      ).toBe(true);
      expect(ai.getLastSearchInfo().plyCeilingHits).toBe(0);
      gs.applyMove(move!);
      if (gs.isGameOver()) break;
    }
  }, 30_000);

  it("plays 16 plies from the crash FEN at level 6 without ceiling hits", async () => {
    const fen = "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20";
    const gs = new GameState({
      ...parseFen(fen),
      playerColor: "white",
    });
    const ai = new AI();
    for (let i = 0; i < 16; i++) {
      if (gs.isGameOver()) break;
      const legal = generateLegalMoves(gs.asRulesState());
      if (legal.length === 0) break;
      const move = await ai.findBestMove(gs, {
        level: 6,
        forColor: gs.activeColor,
        timeout: 800,
        history: gs.getReversibleHistory(),
      });
      expect(move).not.toBeNull();
      const info = ai.getLastSearchInfo();
      expect(info.plyCeilingHits).toBe(0);
      expect(info.qCeilingHits).toBe(0);
      gs.applyMove(move!);
    }
  }, 30_000);
});

describe("AI - Ceiling instrumentation", () => {
  it("records plyCeilingHits when forced to MAX_PLY", () => {
    const ai = new AI();
    ai.repetitionSet = new Set();
    ai.resetSearchInfo();
    const state = new SearchState(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"));
    const score = ai.minimax(
      state,
      3,
      -1e9,
      1e9,
      "white",
      true,
      6,
      undefined,
      undefined,
      true,
      MAX_PLY,
    );
    expect(Number.isFinite(score!)).toBe(true);
    expect(ai.getLastSearchInfo().plyCeilingHits).toBeGreaterThan(0);
  });

  it("records qCeilingHits when forced to MAX_QPLY", () => {
    const ai = new AI();
    ai.repetitionSet = new Set();
    ai.resetSearchInfo();
    const state = new SearchState(
      parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"),
    );
    const score = ai.quiescence(state, -1e9, 1e9, "white", 0, undefined, undefined, 6, 0, MAX_QPLY);
    expect(Number.isFinite(score!)).toBe(true);
    expect(ai.getLastSearchInfo().qCeilingHits).toBeGreaterThan(0);
  });

  it("check extension still applies below the ply ceiling", () => {
    // Side to move in check — extension path must remain active (strength).
    const fen = "4k3/8/8/7Q/8/8/8/4K2R b K - 0 1";
    const state = parseFen(fen);
    expect(isInCheck(state)).toBe(true);
    const ai = new AI();
    ai.repetitionSet = new Set();
    ai.resetSearchInfo();
    const ss = new SearchState(state);
    // depth 1 + in-check extension should search children (nodes > 1).
    const score = ai.minimax(ss, 1, -1e9, 1e9, "black", true, 6, undefined, undefined, true, 0);
    expect(score).not.toBeNull();
    expect(ai.getLastSearchInfo().nodes).toBeGreaterThan(1);
    expect(ai.getLastSearchInfo().plyCeilingHits).toBe(0);
  });
});
