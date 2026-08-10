/**
 * Move.ts
 *
 * Defines the Move structure and helper constructors.
 *
 * A Move is a plain object with:
 * - from: string (e.g. "e2")
 * - to: string (e.g. "e4")
 * - piece: string (e.g. "wP")
 * - captured?: string | null
 * - promotion?: "Q"|"R"|"B"|"N"
 * - isEnPassant?: boolean
 * - isCastleKingSide?: boolean
 * - isCastleQueenSide?: boolean
 *
 * This model is intentionally verbose for readability and explicitness.
 */

import type { Move, Piece, PromotionPiece, Square } from "./types.js";

export type { Move } from "./types.js";

/**
 * Create a basic move.
 */
export function createMove(
  from: Square,
  to: Square,
  piece: Piece,
  captured: Piece | null = null,
): Move {
  return { from, to, piece, captured: captured || null };
}

/**
 * Create a promotion move.
 */
export function createPromotionMove(
  from: Square,
  to: Square,
  piece: Piece,
  promotion: PromotionPiece,
  captured: Piece | null = null,
): Move {
  return {
    from,
    to,
    piece,
    captured: captured || null,
    promotion,
  };
}

/**
 * Create an en passant capture move.
 */
export function createEnPassantMove(from: Square, to: Square, piece: Piece, captured: Piece): Move {
  return {
    from,
    to,
    piece,
    captured,
    isEnPassant: true,
  };
}

/**
 * Create a castling move.
 * Note: rook movement is handled by GameState when applying.
 */
export function createCastleMove(from: Square, to: Square, piece: Piece, kingSide: boolean): Move {
  return {
    from,
    to,
    piece,
    isCastleKingSide: !!kingSide,
    isCastleQueenSide: !kingSide,
  };
}
