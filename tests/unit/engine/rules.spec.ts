import { describe, expect, it } from "vitest";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves, isInCheck } from "../../../js/engine/Rules.js";

describe("Engine Logic - Rules", () => {
  it("generates legal pawn moves from starting position", () => {
    const moves = generateLegalMoves(GameState.createStarting("white").asRulesState());
    const e2 = moves.filter((m) => m.from === "e2").map((m) => m.to);
    expect(e2).toContain("e3");
    expect(e2).toContain("e4");
    expect(e2).toHaveLength(2);
  });

  it("generates correct knight moves", () => {
    const moves = generateLegalMoves(GameState.createStarting("white").asRulesState());
    const g1 = moves
      .filter((m) => m.from === "g1")
      .map((m) => m.to)
      .sort();
    expect(g1).toEqual(["f3", "h3"]);
  });

  it("detects check correctly", () => {
    const state = GameState.createStarting("white");
    expect(isInCheck(state.asRulesState())).toBe(false);

    let moves = generateLegalMoves(state.asRulesState());
    state.applyMove(moves.find((m) => m.from === "e2" && m.to === "e4")!);
    moves = generateLegalMoves(state.asRulesState());
    state.applyMove(moves.find((m) => m.from === "f7" && m.to === "f6")!);
    moves = generateLegalMoves(state.asRulesState());
    state.applyMove(moves.find((m) => m.from === "d1" && m.to === "h5")!);
    expect(isInCheck(state.asRulesState())).toBe(true);
  });

  it("counts 20 legal moves for white at start", () => {
    expect(generateLegalMoves(GameState.createStarting("white").asRulesState())).toHaveLength(20);
  });
});
