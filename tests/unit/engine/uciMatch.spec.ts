import { describe, expect, it } from "vitest";
import { matchUciToLegalMove, parseBestMoveLine } from "../../../js/engine/uciMatch.js";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";

describe("uciMatch", () => {
  it("parses bestmove lines", () => {
    expect(parseBestMoveLine("bestmove e2e4")).toBe("e2e4");
    expect(parseBestMoveLine("bestmove NULL")).toBeNull();
    expect(parseBestMoveLine("info depth 5")).toBeUndefined();
  });

  it("maps UCI to legal moves including promotions", () => {
    const state = GameState.createStarting("white");
    const legal = generateLegalMoves(state.asRulesState());
    const move = matchUciToLegalMove("e2e4", legal);
    expect(move?.from).toBe("e2");
    expect(move?.to).toBe("e4");
    expect(matchUciToLegalMove("0000", legal)).toBeNull();
    expect(matchUciToLegalMove("not-a-move", legal)).toBeNull();
  });
});
