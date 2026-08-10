import { describe, expect, it } from "vitest";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";

function apply(state: GameState, from: string, to: string): void {
  const moves = generateLegalMoves(state.asRulesState());
  const move = moves.find((m) => m.from === from && m.to === to);
  if (!move) throw new Error(`no legal move ${from}-${to}`);
  state.applyMove(move);
}

describe("Engine Logic - GameState", () => {
  it("creates starting position correctly", () => {
    const state = GameState.createStarting("white");
    const snapshot = state.getSnapshot();
    expect(snapshot.activeColor).toBe("white");
    expect(snapshot.gameOver).toBe(false);
    expect(Object.values(snapshot.board).filter((p) => p !== null)).toHaveLength(32);
  });

  it("tracks active color after a move", () => {
    const state = GameState.createStarting("white");
    apply(state, "e2", "e4");
    expect(state.activeColor).toBe("black");
  });

  it("updates halfmove clock on knight move and resets on pawn move", () => {
    const state = GameState.createStarting("white");
    apply(state, "g1", "f3");
    expect(state.halfmoveClock).toBe(1);
    apply(state, "b8", "c6");
    expect(state.halfmoveClock).toBe(2);
    apply(state, "e2", "e4");
    expect(state.halfmoveClock).toBe(0);
  });

  it("tracks castling rights and loses them when king moves", () => {
    const state = GameState.createStarting("white");
    expect(state.castlingRights.white.kingSide).toBe(true);
    expect(state.castlingRights.white.queenSide).toBe(true);
    expect(state.castlingRights.black.kingSide).toBe(true);
    expect(state.castlingRights.black.queenSide).toBe(true);

    apply(state, "e2", "e4");
    apply(state, "e7", "e5");
    apply(state, "e1", "e2");
    expect(state.castlingRights.white.kingSide).toBe(false);
    expect(state.castlingRights.white.queenSide).toBe(false);
  });

  it("serializes and deserializes state", () => {
    const state = GameState.createStarting("white");
    apply(state, "e2", "e4");
    const restored = new GameState(state.serialize());
    expect(restored.activeColor).toBe(state.activeColor);
    expect(restored.board).toEqual(state.board);
  });
});
