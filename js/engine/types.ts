/**
 * Shared chess engine types.
 * Piece codes: "wP","wN","wB","wR","wQ","wK","bP","bN","bB","bR","bQ","bK".
 * Board: 8x8 indexed 0..63, a1 = 0, h8 = 63.
 */

export type Color = "white" | "black";

export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";

export type WhitePiece = `w${PieceType}`;
export type BlackPiece = `b${PieceType}`;
export type Piece = WhitePiece | BlackPiece;

/** Algebraic square, e.g. "e4". */
export type Square = string;

export type PromotionPiece = "Q" | "R" | "B" | "N";

/** Board cell: piece code or empty. Length 64 when used as a full board. */
export type BoardSquare = Piece | null;
export type Board = BoardSquare[];

export interface FileRank {
  file: number;
  rank: number;
}

export interface CastlingSideRights {
  kingSide: boolean;
  queenSide: boolean;
}

export interface CastlingRights {
  white: CastlingSideRights;
  black: CastlingSideRights;
}

/**
 * Minimal position snapshot consumed by Rules / Evaluator / search.
 */
export interface RulesState {
  board: Board;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
}

/**
 * A Move is a plain object with from/to squares and optional special-move flags.
 */
export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece | null;
  promotion?: PromotionPiece;
  isEnPassant?: boolean;
  isCastleKingSide?: boolean;
  isCastleQueenSide?: boolean;
}

export type GameOutcome = "ongoing" | "checkmate" | "stalemate" | "draw";

export interface GameResult {
  outcome: GameOutcome;
  winner?: Color | null;
  reason?: string;
}

export interface LastMoveSquares {
  from: Square;
  to: Square;
}

/**
 * Position since the last irreversible move (for repetition-aware search).
 */
export interface ReversibleSnapshot {
  board: Board;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
}

/**
 * FEN / worker transport fields shared by fen.ts and AI search.
 */
export interface FenState {
  board: Board | Record<string, BoardSquare>;
  activeColor: Color;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
}

export interface PositionAnalysis {
  hasLegalMoves: boolean;
  isCheck: boolean;
}

export interface SelectionResult {
  moved: boolean;
  selectedSquare: Square | null;
  legalTargets: Square[];
}

export interface GameSnapshot {
  board: Record<string, BoardSquare>;
  activeColor: Color;
  playerColor: Color;
  gameOver: boolean;
  statusText: string;
  turnText: string;
  lastMoveText: string | null;
  lastMove: LastMoveSquares | null;
  /** Long algebraic per move (e.g. e2-e4); legacy entries may be SAN. */
  history: string[];
  selectedSquare: Square | null;
  legalTargets: Square[];
  result: GameResult | null;
}
