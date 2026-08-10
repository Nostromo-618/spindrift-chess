import { describe, expect, it } from "vitest";
import { GameState } from "../../../js/engine/GameState.js";
import { generateLegalMoves } from "../../../js/engine/Rules.js";
import { AI } from "../../../js/engine/AI.js";
import type { Color, Move, Piece, Square } from "../../../js/engine/types.js";

interface TacticalPosition {
  name: string;
  activeColor: Color;
  pieces: Record<Square, Piece>;
  expected: string[];
}

function createState(position: TacticalPosition): GameState {
  const board = new Array(64).fill(null) as (Piece | null)[];
  const fileOf = (sq: Square) => sq.charCodeAt(0) - 97;
  const rankOf = (sq: Square) => Number(sq[1]) - 1;
  for (const [sq, piece] of Object.entries(position.pieces)) {
    const idx = rankOf(sq) * 8 + fileOf(sq);
    board[idx] = piece;
  }
  return new GameState({
    board,
    activeColor: position.activeColor,
    castlingRights: {
      white: { kingSide: false, queenSide: false },
      black: { kingSide: false, queenSide: false },
    },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  });
}

function moveId(move: Move | null): string {
  if (!move) return "";
  return `${move.from}-${move.to}${move.promotion ?? ""}`;
}

function isLegalMove(move: Move | null, legalMoves: Move[]): boolean {
  if (!move) return false;
  return legalMoves.some(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      (m.promotion ?? null) === (move.promotion ?? null),
  );
}

describe("Spindrift Engine baseline gate", () => {
  it("hits fixed tactical positions", async () => {
    const BASELINE = { tacticalHits: 2 };
    const positions: TacticalPosition[] = [
      {
        name: "white wins a loose queen",
        activeColor: "white",
        pieces: { g1: "wK", d1: "wQ", g8: "bK", d8: "bQ" },
        expected: ["d1-d8"],
      },
      {
        name: "white promotes decisively",
        activeColor: "white",
        pieces: { a1: "wK", e7: "wP", h8: "bK" },
        expected: ["e7-e8Q"],
      },
      {
        name: "black wins a loose rook",
        activeColor: "black",
        pieces: { g8: "bK", d8: "bQ", g1: "wK", d1: "wR" },
        expected: ["d8-d1"],
      },
    ];

    const attempts = [];
    for (const position of positions) {
      const ai = new AI();
      const state = createState(position);
      const move = await ai.findBestMove(state, {
        level: 6,
        forColor: position.activeColor,
        timeout: 1200,
      });
      const id = moveId(move);
      attempts.push({
        name: position.name,
        move: id,
        hit: position.expected.includes(id),
      });
    }

    const hits = attempts.filter((a) => a.hit).length;
    expect(attempts).toHaveLength(3);
    expect(hits).toBeGreaterThan(BASELINE.tacticalHits);
  }, 20_000);

  it("returns promptly under timeout pressure", async () => {
    const state = GameState.createStarting("white");
    const ai = new AI();
    const startedAt = performance.now();
    const move = await ai.findBestMove(state, {
      level: 6,
      forColor: "white",
      timeout: 5,
    });
    const elapsed = performance.now() - startedAt;
    const legalMoves = generateLegalMoves(state.asRulesState());
    expect(elapsed).toBeLessThan(750);
    expect(isLegalMove(move, legalMoves)).toBe(true);
    expect(ai.getLastSearchInfo()).toHaveProperty("timedOut");
  });

  it("plays a short self-play line using only legal moves", async () => {
    const state = GameState.createStarting("white");
    const ai = new AI();

    for (let ply = 0; ply < 8; ply += 1) {
      const legal = generateLegalMoves(state.asRulesState());
      expect(legal.length).toBeGreaterThan(0);
      const move = await ai.findBestMove(state, {
        level: 3,
        forColor: state.activeColor,
        timeout: 200,
      });
      expect(isLegalMove(move, legal)).toBe(true);
      if (!move) throw new Error("expected a move");
      state.applyMove(move);
    }
  }, 30_000);
});
