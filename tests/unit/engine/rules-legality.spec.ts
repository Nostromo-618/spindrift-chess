import { describe, expect, it } from "vitest";
import { algebraicToIndex } from "../../../js/engine/Board.js";
import { GameState } from "../../../js/engine/GameState.js";
import { parseFen } from "../../../js/engine/fen.js";
import {
  generateCaptureMoves,
  generateLegalMoves,
  generatePseudoLegalMoves,
  isInCheck,
} from "../../../js/engine/Rules.js";
import type { Move, Piece, RulesState } from "../../../js/engine/types.js";

/** Deliberately slow oracle: apply each move on a copy, then test the king. */
function referenceLegalMoves(state: RulesState): Move[] {
  return generatePseudoLegalMoves(state).filter((move) => {
    const board = state.board.slice();
    const from = algebraicToIndex(move.from);
    const to = algebraicToIndex(move.to);
    const white = state.activeColor === "white";
    board[from] = null;
    board[to] = move.promotion ? (`${white ? "w" : "b"}${move.promotion}` as Piece) : move.piece;
    if (move.isEnPassant) board[to + (white ? -8 : 8)] = null;
    if (move.isCastleKingSide || move.isCastleQueenSide) {
      const rank = white ? 0 : 56;
      const rookFrom = rank + (move.isCastleKingSide ? 7 : 0);
      const rookTo = rank + (move.isCastleKingSide ? 5 : 3);
      board[rookTo] = board[rookFrom] ?? null;
      board[rookFrom] = null;
    }
    return board.includes(white ? "wK" : "bK") && !isInCheck({ ...state, board });
  });
}

function checkAgainstReference(state: RulesState): Move[] {
  const before = structuredClone(state);
  const expected = referenceLegalMoves(state);
  expect(generateLegalMoves(state)).toEqual(expected);
  expect(generateCaptureMoves(state)).toEqual(
    expected.filter((move) => move.captured || move.promotion || move.isEnPassant),
  );
  expect(state).toEqual(before);
  return expected;
}

describe("king-safety legality filtering", () => {
  it.each([
    // Orthogonal pins on each half of the board, including a rook capturing its pinner.
    "4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1",
    "4k3/4r3/8/8/8/8/8/4R2K b - - 0 1",
    // Diagonal pin, promotion, and an underpromotion capturing the pinner.
    "7k/8/8/7b/8/8/4B3/3K4 w - - 0 1",
    "1r5k/P7/8/8/8/8/8/1K6 w - - 0 1",
    // En passant opens a horizontal rook attack despite neither pawn being pinned.
    "k7/8/8/r4pPK/8/8/8/8 w - f6 0 1",
    "8/8/8/8/R4Ppk/8/8/K7 b - f3 0 1",
    // En passant removes the checking pawn.
    "7k/8/8/4pP2/3K4/8/8/8 w - e6 0 1",
    // Single and double check, knight and pawn checks, and castling.
    "4r2k/8/8/8/8/8/3B4/4K3 w - - 0 1",
    "4r2k/8/8/8/1b6/8/3B4/4K3 w - - 0 1",
    "7k/8/8/8/8/5n2/3R4/4K3 w - - 0 1",
    "7k/8/8/8/8/8/3pR3/4K3 w - - 0 1",
    "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    // Capture generator's direct-test path and the missing-king fallback.
    "7k/8/8/8/8/8/p7/R3K3 w - - 0 1",
    "7k/8/8/8/8/8/4P3/8 w - - 0 1",
  ])("matches the full attack oracle without changing state: %s", (fen) => {
    checkAgainstReference(parseFen(fen));
  });

  it("preserves ordered legal and noisy lists across seeded legal games", () => {
    let seed = 0x619b137;
    let checked = 0;
    for (let game = 0; game < 16; game++) {
      const state = GameState.createStarting("white");
      for (let ply = 0; ply < 100; ply++) {
        const legal = checkAgainstReference(state.asRulesState());
        checked++;
        if (legal.length === 0 || state.isGameOver()) break;
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        state.applyMove(legal[(seed >>> 0) % legal.length]!);
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("matches Kiwipete perft through depth 3, exercising pins and castling", () => {
    function perft(state: GameState, depth: number): number {
      const legal = generateLegalMoves(state.asRulesState());
      if (depth === 1) return legal.length;
      let nodes = 0;
      for (const move of legal) {
        const child = new GameState({
          board: state.board.slice(),
          activeColor: state.activeColor,
          castlingRights: structuredClone(state.castlingRights),
          enPassantTarget: state.enPassantTarget,
          halfmoveClock: state.halfmoveClock,
          fullmoveNumber: state.fullmoveNumber,
        });
        child.applyMove(move);
        nodes += perft(child, depth - 1);
      }
      return nodes;
    }
    const state = new GameState(
      parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"),
    );
    expect(perft(state, 1)).toBe(48);
    expect(perft(state, 2)).toBe(2039);
    expect(perft(state, 3)).toBe(97862);
  });
});
