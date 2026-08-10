import { describe, expect, it } from "vitest";
import {
  createEngineAdapter,
  getEngineDisplayName,
  getEngineStrengthControlLabel,
  getEngineStrengthLabel,
} from "../../../js/engineAdapter.js";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";

describe("EngineAdapter (Spindrift)", () => {
  it("returns a legal move with useWorker: false", async () => {
    const state = GameState.createStarting("white");
    const adapter = createEngineAdapter("spindrift", { useWorker: false });
    const move = await adapter.findBestMove(state, {
      difficulty: 2,
      movetime: 1000,
      forColor: "white",
    });
    const legal = generateLegalMoves(state.asRulesState());
    const isLegal = legal.some(
      (m) =>
        m.from === move?.from &&
        m.to === move?.to &&
        (m.promotion ?? null) === (move?.promotion ?? null),
    );
    expect(move).not.toBeNull();
    expect(isLegal).toBe(true);
  });

  it("honors an aborted signal before search", async () => {
    const state = GameState.createStarting("white");
    const adapter = createEngineAdapter("spindrift", { useWorker: false });
    const controller = new AbortController();
    controller.abort();
    const move = await adapter.findBestMove(state, {
      difficulty: 2,
      movetime: 1000,
      signal: controller.signal,
    });
    expect(move).toBeNull();
  });

  it("describes Spindrift strength labels", () => {
    expect(getEngineDisplayName()).toBe("Spindrift Engine");
    expect(getEngineStrengthControlLabel()).toBe("Spindrift strength");
    expect(getEngineStrengthLabel("spindrift", 4)).toBe("level 4");
  });
});
