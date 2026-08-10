import { describe, expect, it } from "vitest";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";
import type { Color, Move, Piece, Square } from "../../../js/engine/types.js";

function childOf(gs: GameState, move: Move): GameState {
  const s = gs.serialize();
  const child = new GameState({
    board: gs.board.slice(),
    activeColor: s.activeColor,
    castlingRights: {
      white: { ...s.castlingRights.white },
      black: { ...s.castlingRights.black },
    },
    enPassantTarget: s.enPassantTarget,
    halfmoveClock: s.halfmoveClock,
    fullmoveNumber: s.fullmoveNumber,
  });
  child.applyMove(move);
  return child;
}

function perft(gs: GameState, depth: number): number {
  const moves = generateLegalMoves(gs.asRulesState());
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(childOf(gs, m), depth - 1);
  return n;
}

function applyLine(moves: [Square, Square][]): GameState {
  let gs = GameState.createStarting("white");
  for (const [from, to] of moves) {
    const legal = generateLegalMoves(gs.asRulesState());
    const mv = legal.find((m) => m.from === from && m.to === to);
    if (!mv) throw new Error(`illegal setup move ${from}${to}`);
    gs = childOf(gs, mv);
  }
  return gs;
}

describe("perft", () => {
  it("matches known start-position counts", () => {
    const start = GameState.createStarting("white");
    expect(perft(start, 1)).toBe(20);
    expect(perft(start, 2)).toBe(400);
    expect(perft(start, 3)).toBe(8902);
    expect(perft(start, 4)).toBe(197281);
  });

  it("is stable on an Italian-style middlegame", () => {
    const line: [Square, Square][] = [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["f8", "c5"],
    ];
    const gs = applyLine(line);
    expect(perft(gs, 3)).toBeGreaterThan(1000);
    expect(perft(gs, 4)).toBeGreaterThan(10_000);
  }, 30_000);
});

// keep Color/Piece referenced for type-only import hygiene in some configs
export type _Keep = Color | Piece;
