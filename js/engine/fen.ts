/**
 * Build a FEN string from minimal game state (same fields as AI / worker payload).
 * Board: 64 cells, a1 = 0 … h8 = 63; piece codes from Board (e.g. wP, bK).
 */

import type { Board, BoardSquare, FenState, Piece } from "./types.js";

const PIECE_TO_FEN: Record<Piece, string> = {
  wP: "P",
  wN: "N",
  wB: "B",
  wR: "R",
  wQ: "Q",
  wK: "K",
  bP: "p",
  bN: "n",
  bB: "b",
  bR: "r",
  bQ: "q",
  bK: "k",
};

function isPiece(p: BoardSquare): p is Piece {
  return p !== null && p !== undefined && p in PIECE_TO_FEN;
}

/**
 * Convert a game-state-like object to a FEN string.
 */
export function gameStateToFen(state: FenState): string {
  const board: Board = Array.isArray(state.board)
    ? state.board
    : (Object.values(state.board) as Board);
  const parts: string[] = [];

  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    let row = "";
    for (let file = 0; file < 8; file++) {
      const idx = rank * 8 + file;
      const p = board[idx];
      if (!p) {
        empty++;
      } else {
        if (empty) {
          row += String(empty);
          empty = 0;
        }
        row += isPiece(p) ? PIECE_TO_FEN[p] : "?";
      }
    }
    if (empty) row += String(empty);
    parts.push(row);
  }

  const fenBoard = parts.join("/");
  const side = state.activeColor === "white" ? "w" : "b";

  const cr = state.castlingRights;
  let castling = "";
  if (cr.white.kingSide) castling += "K";
  if (cr.white.queenSide) castling += "Q";
  if (cr.black.kingSide) castling += "k";
  if (cr.black.queenSide) castling += "q";
  if (!castling) castling = "-";

  const ep = state.enPassantTarget || "-";

  const half = Number(state.halfmoveClock) || 0;
  const full = Number(state.fullmoveNumber) || 1;

  return `${fenBoard} ${side} ${castling} ${ep} ${half} ${full}`;
}
