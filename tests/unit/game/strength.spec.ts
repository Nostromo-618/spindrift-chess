import { describe, expect, it } from "vitest";
import { Game } from "../../../js/Game.js";

describe("Game strength / uncapped", () => {
  it("uses per-level movetimes when capped", () => {
    const game = new Game({ playerColor: "white", difficulty: 3, onUpdate: () => {} });
    expect(game.uncapped).toBe(false);
    expect(game.moveTimeForDifficulty()).toBe(1200);
    game.setDifficulty(6);
    expect(game.moveTimeForDifficulty()).toBe(10000);
  });

  it("uses think time and uncapped flag when enabled", () => {
    const game = new Game({
      playerColor: "white",
      difficulty: 2,
      uncapped: true,
      thinkTimeMs: 5000,
      onUpdate: () => {},
    });
    expect(game.uncapped).toBe(true);
    expect(game.moveTimeForDifficulty()).toBe(5000);
    game.setThinkTimeMs(15000);
    expect(game.moveTimeForDifficulty()).toBe(15000);
    game.setUncapped(false);
    expect(game.moveTimeForDifficulty()).toBe(700);
  });

  it("clamps think time to 1–60 seconds", () => {
    const game = new Game({
      playerColor: "white",
      difficulty: 6,
      uncapped: true,
      thinkTimeMs: 10_000,
      onUpdate: () => {},
    });
    game.setThinkTimeMs(500);
    expect(game.moveTimeForDifficulty()).toBe(1000);
    game.setThinkTimeMs(60_000);
    expect(game.moveTimeForDifficulty()).toBe(60_000);
    game.setThinkTimeMs(99_000);
    expect(game.moveTimeForDifficulty()).toBe(60_000);
  });
});
