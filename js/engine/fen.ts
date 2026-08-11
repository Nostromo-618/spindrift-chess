/**
 * Build / parse FEN strings for minimal game state (same fields as AI / worker payload).
 * Board: 64 cells, a1 = 0 … h8 = 63; piece codes from Board (e.g. wP, bK).
 */

import type {
  Board,
  BoardSquare,
  CastlingRights,
  Color,
  FenState,
  Piece,
  Square,
} from "./types.js";

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

const FEN_TO_PIECE: Record<string, Piece> = {
  P: "wP",
  N: "wN",
  B: "wB",
  R: "wR",
  Q: "wQ",
  K: "wK",
  p: "bP",
  n: "bN",
  b: "bB",
  r: "bR",
  q: "bQ",
  k: "bK",
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

/**
 * Parse a FEN string into a FenState suitable for Rules / AI search.
 * Accepts the standard 6-field FEN; missing trailing clocks default to 0 / 1.
 */
export function parseFen(fen: string): FenState {
  const trimmed = fen.trim();
  if (!trimmed) throw new Error("parseFen: empty FEN");

  const parts = trimmed.split(/\s+/);
  const boardField = parts[0];
  if (!boardField) throw new Error("parseFen: missing board field");

  const ranks = boardField.split("/");
  if (ranks.length !== 8) {
    throw new Error(`parseFen: expected 8 ranks, got ${ranks.length}`);
  }

  const board: Board = new Array(64).fill(null);
  for (let fenRank = 0; fenRank < 8; fenRank++) {
    const rankStr = ranks[fenRank]!;
    const rank = 7 - fenRank;
    let file = 0;
    for (let i = 0; i < rankStr.length; i++) {
      const ch = rankStr[i]!;
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        if (file > 8) throw new Error(`parseFen: rank overflow in "${rankStr}"`);
        continue;
      }
      const piece = FEN_TO_PIECE[ch];
      if (!piece) throw new Error(`parseFen: invalid piece '${ch}'`);
      if (file >= 8) throw new Error(`parseFen: too many squares in "${rankStr}"`);
      board[rank * 8 + file] = piece;
      file += 1;
    }
    if (file !== 8) {
      throw new Error(`parseFen: rank "${rankStr}" covers ${file} files, expected 8`);
    }
  }

  const sideTok = parts[1] ?? "w";
  if (sideTok !== "w" && sideTok !== "b") {
    throw new Error(`parseFen: invalid side to move '${sideTok}'`);
  }
  const activeColor: Color = sideTok === "w" ? "white" : "black";

  const castlingTok = parts[2] ?? "-";
  const castlingRights: CastlingRights = {
    white: { kingSide: false, queenSide: false },
    black: { kingSide: false, queenSide: false },
  };
  if (castlingTok !== "-") {
    for (const ch of castlingTok) {
      if (ch === "K") castlingRights.white.kingSide = true;
      else if (ch === "Q") castlingRights.white.queenSide = true;
      else if (ch === "k") castlingRights.black.kingSide = true;
      else if (ch === "q") castlingRights.black.queenSide = true;
      else throw new Error(`parseFen: invalid castling char '${ch}'`);
    }
  }

  const epTok = parts[3] ?? "-";
  let enPassantTarget: Square | null = null;
  if (epTok !== "-") {
    if (!/^[a-h][36]$/.test(epTok)) {
      throw new Error(`parseFen: invalid en passant square '${epTok}'`);
    }
    enPassantTarget = epTok;
  }

  const halfmoveClock = parts[4] !== undefined ? Number(parts[4]) : 0;
  const fullmoveNumber = parts[5] !== undefined ? Number(parts[5]) : 1;
  if (!Number.isFinite(halfmoveClock) || halfmoveClock < 0) {
    throw new Error(`parseFen: invalid halfmove clock '${parts[4]}'`);
  }
  if (!Number.isFinite(fullmoveNumber) || fullmoveNumber < 1) {
    throw new Error(`parseFen: invalid fullmove number '${parts[5]}'`);
  }

  return {
    board,
    activeColor,
    castlingRights,
    enPassantTarget,
    halfmoveClock,
    fullmoveNumber,
  };
}
