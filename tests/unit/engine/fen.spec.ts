import { describe, expect, it } from "vitest";
import { gameStateToFen, parseFen } from "../../../js/engine/fen.js";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";
import type { FenState, Piece } from "../../../js/engine/types.js";

function apply(from: string, to: string, state: GameState): void {
  const moves = generateLegalMoves(state.asRulesState());
  const move = moves.find((m) => m.from === from && m.to === to);
  if (!move) throw new Error(`missing ${from}${to}`);
  state.applyMove(move);
}

describe("FEN - gameStateToFen", () => {
  it("produces standard starting FEN", () => {
    const state = GameState.createStarting("white");
    expect(gameStateToFen(state.asRulesState())).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("reflects side to move and en passant after e2-e4", () => {
    const state = GameState.createStarting("white");
    apply("e2", "e4", state);
    const fen = gameStateToFen(state.asRulesState());
    expect(fen).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b /);
    expect(fen).toContain(" e3 ");
  });

  it("shows dash for en passant after single pawn push", () => {
    const state = GameState.createStarting("white");
    apply("e2", "e3", state);
    expect(gameStateToFen(state.asRulesState())).toMatch(/ - \d+ \d+$/);
  });

  it("updates castling rights when king moves", () => {
    const state = GameState.createStarting("white");
    apply("e2", "e4", state);
    apply("e7", "e5", state);
    apply("e1", "e2", state);
    expect(gameStateToFen(state.asRulesState())).toMatch(/ kq /);
  });

  it("encodes an empty board", () => {
    const fen = gameStateToFen({
      board: new Array(64).fill(null),
      activeColor: "white",
      castlingRights: {
        white: { kingSide: false, queenSide: false },
        black: { kingSide: false, queenSide: false },
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
    });
    expect(fen).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
  });

  it("handles board passed as object (non-array)", () => {
    const board: Record<number, Piece | null> = {};
    for (let i = 0; i < 64; i++) board[i] = null;
    board[4] = "wK";
    board[60] = "bK";
    const fen = gameStateToFen({
      board,
      activeColor: "white",
      castlingRights: {
        white: { kingSide: false, queenSide: false },
        black: { kingSide: false, queenSide: false },
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
    } as FenState);
    expect(fen).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  });
});

describe("FEN - parseFen", () => {
  it("round-trips the starting position", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(gameStateToFen(parseFen(start))).toBe(start);
  });

  it("parses side, castling, en passant, and clocks", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const state = parseFen(fen);
    expect(state.activeColor).toBe("black");
    expect(state.enPassantTarget).toBe("e3");
    expect(state.castlingRights.white.kingSide).toBe(true);
    expect(state.halfmoveClock).toBe(0);
    expect(state.fullmoveNumber).toBe(1);
    expect(gameStateToFen(state)).toBe(fen);
  });

  it("rejects malformed board fields", () => {
    expect(() => parseFen("8/8 w - - 0 1")).toThrow(/8 ranks/);
    expect(() => parseFen("")).toThrow(/empty/);
    expect(() => parseFen("9/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
  });

  it("loads the stack-overflow regression FEN", () => {
    const fen = "rnbqk2r/ppp2ppp/8/8/1pP1n3/P2P4/1p1B1PPP/R2RKBNR b - - 0 20";
    const state = parseFen(fen);
    expect(state.activeColor).toBe("black");
    expect(state.board.filter(Boolean).length).toBe(28);
    expect(generateLegalMoves(state).length).toBeGreaterThan(0);
  });

  it("round-trips adversarial corpus FENs", () => {
    const fens = [
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
      "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
      "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
      "8/P7/8/8/8/8/1p6/4K2k w - - 0 1",
    ];
    for (const fen of fens) {
      expect(gameStateToFen(parseFen(fen))).toBe(fen);
    }
  });
});
