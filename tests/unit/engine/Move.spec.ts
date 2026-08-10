import { describe, expect, it } from "vitest";
import {
  createCastleMove,
  createEnPassantMove,
  createMove,
  createPromotionMove,
} from "../../../js/engine/Move.js";
import type { Piece, PromotionPiece } from "../../../js/engine/types.js";

describe("Move - Basic Move Creation", () => {
  it("creates basic and capture moves", () => {
    const quiet = createMove("e2", "e4", "wP");
    expect(quiet).toEqual({ from: "e2", to: "e4", piece: "wP", captured: null });

    const capture = createMove("e4", "d5", "wP", "bP");
    expect(capture.captured).toBe("bP");

    expect(createMove("g1", "f3", "wN").piece).toBe("wN");
    expect(createMove("f1", "c4", "wB").piece).toBe("wB");
    expect(createMove("d1", "h5", "wQ").piece).toBe("wQ");
    expect(createMove("a1", "d1", "wR").piece).toBe("wR");
    expect(createMove("e1", "e2", "wK").piece).toBe("wK");
    expect(createMove("e7", "e5", "bP").piece).toBe("bP");
    expect(createMove("d5", "e4", "bP", "wP").captured).toBe("wP");
  });
});

describe("Move - Promotion Moves", () => {
  it("creates promotions including captures and underpromotions", () => {
    expect(createPromotionMove("e7", "e8", "wP", "Q").promotion).toBe("Q");
    expect(createPromotionMove("e7", "e8", "wP", "R").promotion).toBe("R");
    expect(createPromotionMove("e7", "e8", "wP", "B").promotion).toBe("B");
    expect(createPromotionMove("e7", "e8", "wP", "N").promotion).toBe("N");

    const withCapture = createPromotionMove("e7", "e8", "wP", "Q", "bQ");
    expect(withCapture.captured).toBe("bQ");
    expect(createPromotionMove("e2", "e1", "bP", "Q").piece).toBe("bP");
  });
});

describe("Move - En Passant Moves", () => {
  it("sets isEnPassant", () => {
    const white = createEnPassantMove("e5", "d6", "wP", "bP");
    expect(white.isEnPassant).toBe(true);
    expect(white.captured).toBe("bP");

    const black = createEnPassantMove("e4", "d3", "bP", "wP");
    expect(black.isEnPassant).toBe(true);

    expect(createEnPassantMove("b5", "a6", "wP", "bP").from).toBe("b5");
    expect(createEnPassantMove("g5", "h6", "wP", "bP").to).toBe("h6");
  });
});

describe("Move - Castling Moves", () => {
  it("sets king/queen side flags", () => {
    const wk = createCastleMove("e1", "g1", "wK", true);
    expect(wk.isCastleKingSide).toBe(true);
    expect(wk.isCastleQueenSide).toBe(false);

    const wq = createCastleMove("e1", "c1", "wK", false);
    expect(wq.isCastleKingSide).toBe(false);
    expect(wq.isCastleQueenSide).toBe(true);

    const bk = createCastleMove("e8", "g8", "bK", true);
    expect(bk.isCastleKingSide).toBe(true);

    const bq = createCastleMove("e8", "c8", "bK", false);
    expect(bq.isCastleQueenSide).toBe(true);
  });
});

describe("Move - Properties", () => {
  it("omits special flags on basic moves", () => {
    const move = createMove("e2", "e4", "wP");
    expect(move.promotion).toBeUndefined();
    expect(move.isEnPassant).toBeUndefined();
    expect(move.isCastleKingSide).toBeUndefined();
    expect(move.isCastleQueenSide).toBeUndefined();
  });

  it("covers all piece and promotion types", () => {
    const pieces: Piece[] = [
      "wP",
      "wN",
      "wB",
      "wR",
      "wQ",
      "wK",
      "bP",
      "bN",
      "bB",
      "bR",
      "bQ",
      "bK",
    ];
    expect(pieces.map((p) => createMove("e2", "e4", p).piece)).toEqual(pieces);

    const promotions: PromotionPiece[] = ["Q", "R", "B", "N"];
    expect(promotions.map((p) => createPromotionMove("e7", "e8", "wP", p).promotion)).toEqual(
      promotions,
    );
  });

  it("validates algebraic and piece formats", () => {
    const move = createMove("e2", "e4", "wP");
    expect(/^[a-h][1-8]$/.test(move.from)).toBe(true);
    expect(/^[a-h][1-8]$/.test(move.to)).toBe(true);
    expect(/^[wb][PNBRQK]$/.test(move.piece)).toBe(true);
    expect(/^[QRBN]$/.test(createPromotionMove("e7", "e8", "wP", "Q").promotion!)).toBe(true);
  });
});
