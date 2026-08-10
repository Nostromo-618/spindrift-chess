/**
 * Board.ts
 *
 * Core board representation utilities.
 * - 8x8 board indexed 0..63, a1 = 0, h8 = 63.
 * - Piece codes: "wP","wN","wB","wR","wQ","wK","bP","bN","bB","bR","bQ","bK".
 * - Pure functions for mapping between index and algebraic notation.
 * - Lightweight helpers used by GameState, Rules, and AI.
 */

import type { Board, BoardSquare, Color, FileRank, Piece, Square } from "./types.js";

/** Files and ranks helpers */
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/**
 * Create initial chess position.
 */
export function createStartingBoard(): Board {
  const b: Board = new Array(64).fill(null);

  const place = (square: Square, piece: Piece): void => {
    b[algebraicToIndex(square)] = piece;
  };

  // White pieces
  (["a1", "h1"] as const).forEach((sq) => place(sq, "wR"));
  (["b1", "g1"] as const).forEach((sq) => place(sq, "wN"));
  (["c1", "f1"] as const).forEach((sq) => place(sq, "wB"));
  place("d1", "wQ");
  place("e1", "wK");
  for (const f of FILES) place(`${f}2`, "wP");

  // Black pieces
  (["a8", "h8"] as const).forEach((sq) => place(sq, "bR"));
  (["b8", "g8"] as const).forEach((sq) => place(sq, "bN"));
  (["c8", "f8"] as const).forEach((sq) => place(sq, "bB"));
  place("d8", "bQ");
  place("e8", "bK");
  for (const f of FILES) place(`${f}7`, "bP");

  return b;
}

/**
 * Convert (file, rank) to index, where a1 = 0, h1 = 7, a8 = 56.
 */
export function frToIndex(file: number, rank: number): number {
  return rank * 8 + file;
}

/**
 * Convert index to (file, rank).
 */
export function indexToFR(index: number): FileRank {
  return {
    file: index % 8,
    rank: Math.floor(index / 8),
  };
}

/**
 * Convert index to algebraic coordinate, e.g. 0 -> "a1".
 */
export function indexToAlgebraic(index: number): Square {
  const { file, rank } = indexToFR(index);
  return `${FILES[file]}${rank + 1}`;
}

/**
 * Convert algebraic like "e4" to index.
 */
export function algebraicToIndex(sq: Square): number {
  if (!sq || typeof sq !== "string" || sq.length !== 2) {
    throw new Error(`Invalid square: ${sq}`);
  }
  const fileChar = sq[0];
  const rankChar = sq[1];
  const file = FILES.indexOf(fileChar as (typeof FILES)[number]);
  const rank = Number(rankChar) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${sq}`);
  }
  return frToIndex(file, rank);
}

/**
 * Get piece color.
 */
export function getColorOf(piece: BoardSquare | undefined): Color | null {
  if (!piece) return null;
  return piece[0] === "w" ? "white" : "black";
}

/**
 * Mirror color.
 */
export function oppositeColor(color: Color): Color {
  return color === "white" ? "black" : "white";
}

/**
 * Clone board array (shallow, sufficient since elements are primitives).
 */
export function cloneBoard(board: Board): Board {
  return board.slice();
}

/**
 * Read a board cell. Boards are always length 64; treat holes as empty.
 * Prefer this under `noUncheckedIndexedAccess`.
 */
export function cellAt(board: Board, index: number): BoardSquare {
  return board[index] ?? null;
}

/**
 * Write a board cell.
 */
export function setCell(board: Board, index: number, value: BoardSquare): void {
  board[index] = value;
}

/**
 * Build a map from algebraic squares to piece codes.
 * Useful for UI rendering.
 */
export function boardToMap(board: Board): Record<string, BoardSquare> {
  const map: Record<string, BoardSquare> = {};
  for (let i = 0; i < 64; i += 1) {
    map[indexToAlgebraic(i)] = board[i] || null;
  }
  return map;
}
