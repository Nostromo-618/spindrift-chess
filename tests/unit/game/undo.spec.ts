import { describe, expect, it } from "vitest";
import { algebraicToIndex } from "../../../js/engine/Board.js";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";
import { Game } from "../../../js/Game.js";
import type { Board, PromotionPiece } from "../../../js/engine/types.js";

function findMove(state: GameState, from: string, to: string, promotion?: PromotionPiece) {
  return generateLegalMoves(state.asRulesState()).find(
    (m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion),
  );
}

function play(state: GameState, from: string, to: string, promotion?: PromotionPiece): void {
  const m = findMove(state, from, to, promotion);
  if (!m) throw new Error(`no legal move ${from}-${to}`);
  state.applyMove(m);
}

function playAll(state: GameState, plies: [string, string, PromotionPiece?][]): void {
  for (const [f, t, p] of plies) play(state, f, t, p);
}

describe("Undo - GameState.undoOnePly", () => {
  it("returns false on empty history", () => {
    const state = GameState.createStarting("white");
    const before = JSON.stringify(state.board);
    expect(state.undoOnePly()).toBe(false);
    expect(JSON.stringify(state.board)).toBe(before);
    expect(state.moveHistory).toHaveLength(0);
  });

  it("restores board after a single move", () => {
    const state = GameState.createStarting("white");
    const startBoard = JSON.stringify(state.board);
    play(state, "e2", "e4");
    expect(state.undoOnePly()).toBe(true);
    expect(JSON.stringify(state.board)).toBe(startBoard);
    expect(state.activeColor).toBe("white");
    expect(state.moveHistory).toHaveLength(0);
    expect(state.lastMove).toBeNull();
    expect(state.isGameOver()).toBe(false);
  });

  it("restores castling rook placement and rights after undoing O-O", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
      ["b8", "c6"],
      ["f1", "c4"],
      ["f8", "c5"],
      ["e1", "g1"],
    ]);
    expect(state.getPiece("g1" as Square)).toBe("wK");
    expect(state.getPiece("f1" as Square)).toBe("wR");
    expect(state.castlingRights.white.kingSide).toBe(false);

    state.undoOnePly();
    expect(state.getPiece("e1" as Square)).toBe("wK");
    expect(state.getPiece("h1" as Square)).toBe("wR");
    expect(state.getPiece("g1" as Square)).toBeNull();
    expect(state.getPiece("f1" as Square)).toBeNull();
    expect(state.getPiece("c4" as Square)).toBe("wB");
    expect(state.castlingRights.white.kingSide).toBe(true);
    expect(state.castlingRights.white.queenSide).toBe(true);
    expect(state.activeColor).toBe("white");
  });

  it("restores en passant target in both directions", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["e2", "e4"],
      ["a7", "a6"],
    ]);
    state.undoOnePly();
    expect(state.enPassantTarget).toBe("e3");
    state.undoOnePly();
    expect(state.enPassantTarget).toBeNull();
    expect(state.getPiece("e2" as Square)).toBe("wP");
    expect(state.moveHistory).toHaveLength(0);
  });

  it("restores a promotion", () => {
    const board: Board = new Array(64).fill(null);
    board[algebraicToIndex("e1" as Square)] = "wK";
    board[algebraicToIndex("a8" as Square)] = "bK";
    board[algebraicToIndex("e7" as Square)] = "wP";
    const state = new GameState({ board, activeColor: "white", playerColor: "white" });
    const move = findMove(state, "e7", "e8", "Q")!;
    state.applyMove(move);
    expect(state.getPiece("e8" as Square)).toBe("wQ");
    expect(state.moveHistory).toEqual(["e7-e8=Q"]);
    state.undoOnePly();
    expect(state.getPiece("e7" as Square)).toBe("wP");
    expect(state.getPiece("e8" as Square)).toBeNull();
    expect(state.moveHistory).toHaveLength(0);
    expect(state.activeColor).toBe("white");
  });

  it("restores halfmove clock and fullmove number", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["g1", "f3"],
      ["g8", "f6"],
    ]);
    expect({
      half: state.halfmoveClock,
      full: state.fullmoveNumber,
      turn: state.activeColor,
    }).toEqual({
      half: 2,
      full: 2,
      turn: "white",
    });
    state.undoOnePly();
    expect({
      half: state.halfmoveClock,
      full: state.fullmoveNumber,
      turn: state.activeColor,
    }).toEqual({
      half: 1,
      full: 1,
      turn: "black",
    });
  });

  it("restores moveHistory mid-game", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["e2", "e4"],
      ["e7", "e5"],
      ["g1", "f3"],
    ]);
    state.undoOnePly();
    expect(state.moveHistory).toEqual(["e2-e4", "e7-e5"]);
    expect(state.lastMove).toEqual({ from: "e7", to: "e5" });
    expect(state.lastMoveText).toBe("2. e7-e5");
    expect(state.activeColor).toBe("white");
  });

  it("clears a threefold repetition draw on undo", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
      ["g1", "f3"],
      ["g8", "f6"],
      ["f3", "g1"],
      ["f6", "g8"],
    ]);
    expect(state.result?.outcome).toBe("draw");
    state.undoOnePly();
    expect(state.result?.outcome).toBe("ongoing");
    play(state, "b8", "c6");
    expect(state.result?.outcome).toBe("ongoing");
    expect(state.moveHistory).toHaveLength(8);
  });

  it("refuses to undo legacy SAN history", () => {
    const state = GameState.createStarting("white");
    playAll(state, [
      ["e2", "e4"],
      ["e7", "e5"],
    ]);
    state.moveHistory = ["e4", "e5"];
    const boardBefore = JSON.stringify(state.board);
    expect(state.undoSupported()).toBe(false);
    expect(state.undoOnePly()).toBe(false);
    expect(JSON.stringify(state.board)).toBe(boardBefore);
    expect(state.moveHistory).toEqual(["e4", "e5"]);
  });
});

describe("Undo - Game.undoToPlayerTurn / canUndo", () => {
  it("white player undoes own move plus computer reply", () => {
    const game = new Game({ playerColor: "white", difficulty: 1, onUpdate: () => {} });
    play(game.state, "e2", "e4");
    play(game.state, "e7", "e5");
    expect(game.canUndo()).toBe(true);
    expect(game.undoToPlayerTurn()).toBe(2);
    expect(game.state.moveHistory).toHaveLength(0);
    expect(game.getCurrentTurn()).toBe("white");
    expect(game.canUndo()).toBe(false);
    expect(game.state.getPiece("e2" as Square)).toBe("wP");
  });

  it("black player stops after the computer opening move", () => {
    const game = new Game({ playerColor: "black", difficulty: 1, onUpdate: () => {} });
    play(game.state, "e2", "e4");
    play(game.state, "e7", "e5");
    play(game.state, "g1", "f3");
    expect(game.undoToPlayerTurn()).toBe(2);
    expect(game.state.moveHistory).toEqual(["e2-e4"]);
    expect(game.getCurrentTurn()).toBe("black");
    expect(game.canUndo()).toBe(false);
  });

  it("black player cannot undo when only the computer opening exists", () => {
    const game = new Game({ playerColor: "black", difficulty: 1, onUpdate: () => {} });
    expect(game.canUndo()).toBe(false);
    play(game.state, "e2", "e4");
    expect(game.canUndo()).toBe(false);
    expect(game.undoToPlayerTurn()).toBe(0);
    expect(game.state.moveHistory).toHaveLength(1);
  });

  it("after mate, undo reverts the mating move", () => {
    const game = new Game({ playerColor: "black", difficulty: 1, onUpdate: () => {} });
    playAll(game.state, [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ]);
    expect(game.isGameOver()).toBe(true);
    expect(game.state.result?.outcome).toBe("checkmate");
    expect(game.canUndo()).toBe(true);
    expect(game.undoToPlayerTurn()).toBe(1);
    expect(game.isGameOver()).toBe(false);
    expect(game.getCurrentTurn()).toBe("black");
    expect(game.state.moveHistory).toHaveLength(3);
    expect(game.state.getPiece("d8" as Square)).toBe("bQ");
  });

  it("canUndo is false for legacy SAN history", () => {
    const game = new Game({ playerColor: "white", difficulty: 1, onUpdate: () => {} });
    playAll(game.state, [
      ["e2", "e4"],
      ["e7", "e5"],
    ]);
    game.state.moveHistory = ["e4", "e5"];
    expect(game.canUndo()).toBe(false);
    expect(game.undoToPlayerTurn()).toBe(0);
    expect(game.state.getPiece("e4" as Square)).toBe("wP");
  });
});
