import { describe, expect, it } from "vitest";
import {
  algebraicToIndex,
  cloneBoard,
  indexToAlgebraic,
  oppositeColor,
} from "../../../js/engine/Board.js";
import { GameState } from "../../../js/engine/GameState.js";
import type { Square } from "../../../js/engine/types.js";

describe("Board - Algebraic Notation", () => {
  it("converts corner and center squares", () => {
    expect(algebraicToIndex("a1")).toBe(0);
    expect(algebraicToIndex("h1")).toBe(7);
    expect(algebraicToIndex("a8")).toBe(56);
    expect(algebraicToIndex("h8")).toBe(63);
    expect(algebraicToIndex("e4")).toBe(28);
  });

  it("converts indices back to algebraic", () => {
    expect(indexToAlgebraic(0)).toBe("a1");
    expect(indexToAlgebraic(7)).toBe("h1");
    expect(indexToAlgebraic(56)).toBe("a8");
    expect(indexToAlgebraic(63)).toBe("h8");
    expect(indexToAlgebraic(28)).toBe("e4");
  });

  it("round-trips every square", () => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];
    for (const file of files) {
      for (const rank of ranks) {
        const square = `${file}${rank}` as Square;
        expect(indexToAlgebraic(algebraicToIndex(square))).toBe(square);
      }
    }
  });
});

describe("Board - Index Calculations", () => {
  it("derives file and rank from index", () => {
    expect(0 % 8).toBe(0);
    expect(7 % 8).toBe(7);
    expect(8 % 8).toBe(0);
    expect(Math.floor(0 / 8)).toBe(0);
    expect(Math.floor(8 / 8)).toBe(1);
    expect(Math.floor(63 / 8)).toBe(7);
  });

  it("identifies same diagonal and anti-diagonal", () => {
    const a1 = 0;
    const b2 = 9;
    const c3 = 18;
    expect(Math.floor(a1 / 8) - (a1 % 8)).toBe(Math.floor(b2 / 8) - (b2 % 8));
    expect(Math.floor(b2 / 8) - (b2 % 8)).toBe(Math.floor(c3 / 8) - (c3 % 8));

    const a8 = 56;
    const b7 = 49;
    const c6 = 42;
    expect(Math.floor(a8 / 8) + (a8 % 8)).toBe(Math.floor(b7 / 8) + (b7 % 8));
    expect(Math.floor(b7 / 8) + (b7 % 8)).toBe(Math.floor(c6 / 8) + (c6 % 8));
  });
});

describe("Board - Clone Operations", () => {
  it("creates an independent copy", () => {
    const state = GameState.createStarting("white");
    const original = state.board;
    const cloned = cloneBoard(original);
    cloned[28] = "wP";
    expect(original[28]).not.toBe(cloned[28]);
  });

  it("preserves piece count on starting position", () => {
    const state = GameState.createStarting("white");
    const cloned = cloneBoard(state.board);
    expect(state.board.filter((p) => p !== null)).toHaveLength(32);
    expect(cloned.filter((p) => p !== null)).toHaveLength(32);
  });

  it("clones empty and full boards", () => {
    const empty = cloneBoard(new Array(64).fill(null));
    expect(empty).toHaveLength(64);
    expect(empty.every((p) => p === null)).toBe(true);

    const full = Array.from({ length: 64 }, (_, i) => (i < 32 ? "wP" : "bP"));
    const cloned = cloneBoard(full as ReturnType<typeof cloneBoard>);
    expect(cloned.every((p) => p !== null)).toBe(true);
    expect(cloned).toEqual(full);
  });
});

describe("Board - Opposite Color", () => {
  it("mirrors white and black", () => {
    expect(oppositeColor("white")).toBe("black");
    expect(oppositeColor("black")).toBe("white");
    expect(oppositeColor(oppositeColor("white"))).toBe("white");
  });
});

describe("Board - Square Colors", () => {
  it("classifies light and dark squares", () => {
    const isLight = (i: number) => (Math.floor(i / 8) + (i % 8)) % 2 === 0;
    expect(isLight(0)).toBe(true); // a1
    expect(isLight(28)).toBe(false); // e4
    expect(isLight(7)).toBe(false); // h1
    expect(isLight(60)).toBe(false); // e8

    let light = 0;
    let dark = 0;
    for (let i = 0; i < 64; i++) {
      if (isLight(i)) light++;
      else dark++;
    }
    expect(light).toBe(32);
    expect(dark).toBe(32);
  });
});

describe("Board - Edge Cases", () => {
  it("rejects invalid algebraic", () => {
    expect(() => algebraicToIndex("" as Square)).toThrow();
    expect(() => algebraicToIndex("z9" as Square)).toThrow();
  });
});
