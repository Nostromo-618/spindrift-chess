import { describe, expect, it } from "vitest";
import { AI, SearchState } from "../../../js/engine/AI.js";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";
import { algebraicToIndex } from "../../../js/engine/Board.js";
import type { Board, Color, Move, Piece, RulesState } from "../../../js/engine/types.js";

function buildState(pieces: [string, Piece][], activeColor: Color = "white"): RulesState {
  const board: Board = new Array(64).fill(null);
  for (const [sq, p] of pieces) {
    board[algebraicToIndex(sq as never)] = p;
  }
  return {
    board,
    activeColor,
    castlingRights: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 40,
  };
}

describe("AI - Transposition Table", () => {
  it("computes consistent Zobrist hashes", () => {
    const state = GameState.createStarting("white");
    const ai = new AI();
    const hash1 = ai.computeZobristHash(state.asRulesState());
    const hash2 = ai.computeZobristHash(state.asRulesState());
    expect(hash1).toBe(hash2);

    const moves = generateLegalMoves(state.asRulesState());
    const e4 = moves.find((m) => m.from === "e2" && m.to === "e4")!;
    state.applyMove(e4);
    expect(ai.computeZobristHash(state.asRulesState())).not.toBe(hash1);
  });

  it("stores and retrieves TT entries", () => {
    const ai = new AI();
    const state = GameState.createStarting("white");
    const hash = ai.computeZobristHash(state.asRulesState());
    const move: Move = { from: "e2", to: "e4", piece: "wP", captured: null };
    ai.storeTable(hash, 3, 100, 0, move, 0);
    expect(ai.probeTable(hash, 3, -1000, 1000, 0)).toBe(100);
  });

  it("keeps TT length at default size", () => {
    const ai = new AI();
    for (let i = 0; i < 200_000; i++) {
      ai.storeTable(BigInt(i), 1, i, 0, null, 0);
    }
    expect(ai.transpositionTable.length).toBe(131_072);
  });

  it("replaces shallower entries with deeper searches", () => {
    const ai = new AI();
    const hash = ai.computeZobristHash(GameState.createStarting("white").asRulesState());
    ai.storeTable(hash, 2, 50, 0, null, 0);
    ai.storeTable(hash, 4, 100, 0, null, 0);
    expect(ai.probeTable(hash, 3, -1000, 1000, 0)).toBe(100);
  });

  it("handles exact / lower / upper flags", () => {
    const ai = new AI();
    const hash = ai.computeZobristHash(GameState.createStarting("white").asRulesState());
    ai.storeTable(hash, 3, 100, 0, null, 0);
    expect(ai.probeTable(hash, 3, -1000, 1000, 0)).toBe(100);
    ai.storeTable(hash, 3, 200, 1, null, 0);
    expect(ai.probeTable(hash, 3, -1000, 150, 0)).toBe(200);
    ai.storeTable(hash, 3, 50, 2, null, 0);
    expect(ai.probeTable(hash, 3, 60, 1000, 0)).toBe(50);
  });

  it("rejects index collisions with different keys", () => {
    const ai = new AI();
    ai.ttSize = 1;
    ai.transpositionTable = new Array(1);
    ai.storeTable(1n, 3, 111, 0, { from: "e2", to: "e4", piece: "wP", captured: null }, 0);
    expect(ai.probeTable(1n, 3, -1000, 1000, 0)).toBe(111);
    expect(ai.probeTable(2n, 3, -1000, 1000, 0)).toBeNull();
    expect(ai.probeTTMove(2n)).toBeNull();
  });
});

describe("AI - Move Ordering", () => {
  it("orders moves and tracks killers / history", () => {
    const ai = new AI();
    const state = GameState.createStarting("white");
    let moves = generateLegalMoves(state.asRulesState());
    state.applyMove(moves.find((m) => m.from === "e2" && m.to === "e4")!);
    moves = generateLegalMoves(state.asRulesState());
    state.applyMove(moves.find((m) => m.from === "e7" && m.to === "e5")!);
    const whiteMoves = generateLegalMoves(state.asRulesState());
    const ordered = ai.orderMoves(whiteMoves, 3, null, null, state.board, 3);
    expect(ordered.length).toBeGreaterThan(0);

    const startMoves = generateLegalMoves(GameState.createStarting("white").asRulesState());
    ai.storeKillerMove(startMoves[0]!, 3);
    expect(ai.isKillerMove(startMoves[0]!, 3)).toBe(true);

    const e4 = startMoves.find((m) => m.from === "e2" && m.to === "e4")!;
    ai.updateHistory(e4, 3);
    expect(ai.getHistoryScore(e4)).toBeGreaterThan(0);
  });
});

describe("AI - Search & Difficulty", () => {
  it("exposes search primitives and depth / randomness maps", () => {
    const ai = new AI();
    expect(new SearchState(GameState.createStarting("white"))).toBeTruthy();
    expect(typeof ai.quiescence).toBe("function");
    expect(typeof ai.minimax).toBe("function");
    expect(typeof ai.progressiveDeepeningSearch).toBe("function");
    expect(AI.NULL_MOVE_REDUCTION).toBeDefined();

    expect(ai.depthForLevel[1]).toBe(1);
    expect(ai.depthForLevel[3]).toBe(3);
    expect(ai.depthForLevel[5]!).toBeGreaterThanOrEqual(5);
    expect(ai.depthForLevel[6]!).toBeGreaterThanOrEqual(7);

    expect(ai.randomness[1]!).toBeGreaterThan(ai.randomness[3]!);
    expect(ai.randomness[3]!).toBeGreaterThan(0);
    expect(ai.randomness[4]).toBe(0);
    expect(ai.randomness[5]).toBe(0);
    expect(ai.randomness[6]).toBe(0);
  });

  it("finds a move within time at levels 1 and 3", async () => {
    const ai = new AI();
    const state = GameState.createStarting("white");
    const start1 = performance.now();
    const move1 = await ai.findBestMove(state, { level: 1, forColor: "black", timeout: 5000 });
    expect(move1).not.toBeNull();
    expect(performance.now() - start1).toBeLessThan(5000);

    const start3 = performance.now();
    const move3 = await ai.findBestMove(state, { level: 3, forColor: "black", timeout: 10000 });
    expect(move3).not.toBeNull();
    expect(performance.now() - start3).toBeLessThan(10000);
  });
});

describe("AI - Edge Cases", () => {
  it("returns null when no legal moves", async () => {
    // Mate: black king trapped with no escape (simplified K+Q vs K mate pattern)
    const mate: RulesState = {
      board: (() => {
        const b: Board = new Array(64).fill(null);
        b[algebraicToIndex("a8" as never)] = "bK";
        b[algebraicToIndex("a7" as never)] = "wQ";
        b[algebraicToIndex("b6" as never)] = "wK";
        return b;
      })(),
      activeColor: "black",
      castlingRights: {
        white: { kingSide: false, queenSide: false },
        black: { kingSide: false, queenSide: false },
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 40,
    };
    const legal = generateLegalMoves(mate);
    const move = await new AI().findBestMove(mate, { level: 3, forColor: "black", timeout: 2000 });
    expect(!!move).toBe(legal.length > 0);
  });

  it("promotes when forcing a promotion", async () => {
    const promotion = buildState(
      [
        ["e1", "wK"],
        ["h8", "bK"],
        ["a7", "wP"],
      ],
      "white",
    );
    const move = await new AI().findBestMove(promotion, {
      level: 3,
      forColor: "white",
      timeout: 3000,
    });
    expect(move?.promotion).toBeTruthy();
  });

  it("returns a legal opening move", async () => {
    const move = await new AI().findBestMove(GameState.createStarting("white"), {
      level: 1,
      forColor: "white",
      timeout: 3000,
    });
    expect(move).not.toBeNull();
  });
});

describe("AI - Uncapped search", () => {
  const sparse: [string, Piece][] = [
    ["e1", "wK"],
    ["e8", "bK"],
    ["a2", "wP"],
  ];
  const forcing: [string, Piece][] = [
    ["e1", "wK"],
    ["h8", "bK"],
    ["a7", "wP"],
  ];

  it("deepens past the level-6 depth cap when uncapped", async () => {
    // Production level-6 cap stays high; prove uncapped ignores it with a
    // temporary low ceiling so CI hosts don't need to reach depth 22 in wall time.
    expect(new AI().depthForLevel[6]).toBe(22);

    const artificialCap = 4;
    const cappedAI = new AI();
    cappedAI.depthForLevel[6] = artificialCap;
    await cappedAI.findBestMove(buildState(sparse), {
      level: 6,
      forColor: "white",
      timeout: 2000,
    });
    const cappedDepth = cappedAI.getLastSearchInfo().depthCompleted;

    const uncappedAI = new AI();
    uncappedAI.depthForLevel[6] = artificialCap;
    await uncappedAI.findBestMove(buildState(sparse), {
      level: 6,
      forColor: "white",
      timeout: 2000,
      uncapped: true,
    });
    const uncappedDepth = uncappedAI.getLastSearchInfo().depthCompleted;

    expect(cappedDepth).toBeLessThanOrEqual(artificialCap);
    expect(uncappedDepth).toBeGreaterThan(artificialCap);
    expect(uncappedDepth).toBeLessThanOrEqual(56);
  }, 15_000);

  it("is deterministic on a forcing promotion", async () => {
    const run = async () => {
      const ai = new AI();
      const move = await ai.findBestMove(buildState(forcing), {
        level: 6,
        forColor: "white",
        timeout: 800,
        uncapped: true,
      });
      return { from: move?.from, to: move?.to, promotion: move?.promotion ?? null };
    };
    const first = await run();
    const second = await run();
    expect(first.from).toBe("a7");
    expect(first.to).toBe("a8");
    expect(second).toEqual(first);
  }, 15_000);

  it("respects the time budget", async () => {
    const ai = new AI();
    const start = Date.now();
    const move = await ai.findBestMove(buildState(sparse), {
      level: 6,
      forColor: "white",
      timeout: 400,
      uncapped: true,
    });
    expect(move).not.toBeNull();
    expect(Date.now() - start).toBeLessThan(1400);
  }, 10_000);

  it("keeps capped levels shallow", async () => {
    const ai = new AI();
    const move = await ai.findBestMove(GameState.createStarting("white"), {
      level: 3,
      forColor: "white",
      timeout: 5000,
    });
    expect(move).not.toBeNull();
    expect(ai.getLastSearchInfo().depthCompleted).toBeLessThanOrEqual(3);
  });
});
