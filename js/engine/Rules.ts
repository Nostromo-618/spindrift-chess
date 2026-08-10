/**
 * Rules.ts
 *
 * Generates legal moves for a given GameState-like snapshot.
 * Implements:
 * - All standard piece moves.
 * - Castling (both sides, both colors) with check constraints.
 * - En passant using enPassantTarget from state.
 * - Pawn promotions (to Q/R/B/N, defaulting to Q for engine).
 * - Check, checkmate, stalemate detection helpers.
 *
 * This module is pure w.r.t board + state arguments and contains no DOM logic.
 */

import {
  algebraicToIndex,
  indexToAlgebraic,
  indexToFR,
  getColorOf,
  oppositeColor,
} from "./Board.js";
import { createMove, createPromotionMove, createEnPassantMove, createCastleMove } from "./Move.js";
import type {
  Board,
  BoardSquare,
  CastlingRights,
  Color,
  Move,
  Piece,
  PositionAnalysis,
  PromotionPiece,
  RulesState,
  Square,
} from "./types.js";

type Dir = readonly [number, number];

/** Board cell read that collapses undefined (noUncheckedIndexedAccess). */
function bAt(board: Board, i: number): BoardSquare {
  return board[i] ?? null;
}

/** Narrow a board cell known to hold a piece. */
function asPiece(piece: BoardSquare): Piece {
  if (!piece) throw new Error("expected piece on square");
  return piece;
}

/**
 * Generate all pseudo-legal moves (not filtered for leaving king in check).
 */
export function generatePseudoLegalMoves(state: RulesState): Move[] {
  const moves: Move[] = [];
  const { board, activeColor, castlingRights, enPassantTarget } = state;
  const enemy = oppositeColor(activeColor);

  const epIndex =
    enPassantTarget !== null && enPassantTarget !== undefined
      ? algebraicToIndex(enPassantTarget)
      : -1;

  for (let fromIndex = 0; fromIndex < 64; fromIndex += 1) {
    const piece = bAt(board, fromIndex);
    if (!piece) continue;
    const color = getColorOf(piece);
    if (color !== activeColor) continue;

    const fromSq = indexToAlgebraic(fromIndex);
    const { file, rank } = indexToFR(fromIndex);

    switch (piece[1]) {
      case "P":
        generatePawnMoves(state, fromIndex, fromSq, file, rank, color, enemy, epIndex, moves);
        break;
      case "N":
        generateKnightMoves(board, fromIndex, fromSq, color, moves);
        break;
      case "B":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "R":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
        break;
      case "Q":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "K":
        generateKingMoves(board, fromIndex, fromSq, color, moves);
        generateCastlingMoves(state, fromIndex, fromSq, color, castlingRights, moves);
        break;
      default:
        break;
    }
  }

  return moves;
}

/**
 * Filter pseudo-legal moves to legal ones (king not left in check).
 */
export function generateLegalMoves(state: RulesState): Move[] {
  const pseudoMoves = generatePseudoLegalMoves(state);
  const legal: Move[] = [];

  const board = state.board;
  const moverColor = state.activeColor;
  const enemy = oppositeColor(moverColor);
  // Find the mover's king once (it doesn't move except for its own moves, which
  // the legality check handles), instead of scanning per pseudo-move.
  const kingCode = moverColor === "white" ? "wK" : "bK";
  let kingIndex = -1;
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) {
      kingIndex = i;
      break;
    }
  }

  for (const move of pseudoMoves) {
    if (!moveLeavesKingInCheck(board, move, moverColor, enemy, kingIndex)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Generate legal "noisy" moves only — captures, promotions, and en passant —
 * for quiescence search. Uses a dedicated noisy pseudo-move generator (no
 * quiet moves are ever allocated); the legality check then runs only on that
 * handful of moves. Produces the same moves, in the same order, as filtering
 * generatePseudoLegalMoves down to noisy moves.
 */
export function generateCaptureMoves(state: RulesState): Move[] {
  const pseudoMoves = generateNoisyPseudoMoves(state);
  const legal: Move[] = [];

  const board = state.board;
  const moverColor = state.activeColor;
  const enemy = oppositeColor(moverColor);
  const kingCode = moverColor === "white" ? "wK" : "bK";
  let kingIndex = -1;
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) {
      kingIndex = i;
      break;
    }
  }

  for (const move of pseudoMoves) {
    if (!moveLeavesKingInCheck(board, move, moverColor, enemy, kingIndex)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Generate pseudo-legal noisy moves (captures, promotions, en passant) without
 * allocating quiet moves. Not filtered for leaving the king in check.
 */
function generateNoisyPseudoMoves(state: RulesState): Move[] {
  const moves: Move[] = [];
  const { board, activeColor, enPassantTarget } = state;
  const enemy = oppositeColor(activeColor);

  const epIndex =
    enPassantTarget !== null && enPassantTarget !== undefined
      ? algebraicToIndex(enPassantTarget)
      : -1;

  for (let fromIndex = 0; fromIndex < 64; fromIndex += 1) {
    const piece = bAt(board, fromIndex);
    if (!piece) continue;
    const color = getColorOf(piece);
    if (color !== activeColor) continue;

    const fromSq = indexToAlgebraic(fromIndex);
    const { file, rank } = indexToFR(fromIndex);

    switch (piece[1]) {
      case "P": {
        const dir = color === "white" ? 1 : -1;
        const promotionRank = color === "white" ? 6 : 1;
        const lastRank = color === "white" ? 7 : 0;
        const oneStepRank = rank + dir;
        // Promotion by advance (promotions are noisy even without a capture).
        if (rank === promotionRank && oneStepRank >= 0 && oneStepRank <= 7) {
          const oneStepIndex = oneStepRank * 8 + file;
          if (!bAt(board, oneStepIndex)) {
            addPawnAdvance(fromSq, fromIndex, oneStepIndex, color, promotionRank, lastRank, moves);
          }
        }
        // Captures (including promotion captures) and en passant.
        const captureFiles = [file - 1, file + 1];
        for (const cf of captureFiles) {
          if (cf < 0 || cf > 7) continue;
          const targetRank = rank + dir;
          if (targetRank < 0 || targetRank > 7) continue;
          const targetIndex = targetRank * 8 + cf;
          const targetPiece = bAt(board, targetIndex);
          if (targetPiece && getColorOf(targetPiece) === enemy) {
            addPawnCapture(
              fromSq,
              fromIndex,
              targetIndex,
              color,
              targetPiece,
              promotionRank,
              lastRank,
              moves,
            );
          }
          if (epIndex === targetIndex && !targetPiece) {
            const epPawnIndex = rank * 8 + cf;
            const captured = bAt(board, epPawnIndex);
            if (captured && getColorOf(captured) === enemy) {
              moves.push(
                createEnPassantMove(
                  fromSq,
                  indexToAlgebraic(targetIndex),
                  asPiece(bAt(board, fromIndex)),
                  captured,
                ),
              );
            }
          }
        }
        break;
      }
      case "N":
        generateKnightCaptures(board, fromIndex, fromSq, color, moves);
        break;
      case "B":
        generateSlidingCaptures(board, fromIndex, fromSq, color, moves, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "R":
        generateSlidingCaptures(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
        break;
      case "Q":
        generateSlidingCaptures(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "K":
        generateKingCaptures(board, fromIndex, fromSq, color, moves);
        break;
      default:
        break;
    }
  }

  return moves;
}

function generateKnightCaptures(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
): void {
  const { file, rank } = indexToFR(fromIndex);
  const jumps = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];
  for (const jump of jumps) {
    const df = jump[0]!;
    const dr = jump[1]!;
    const nf = file + df;
    const nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const toIndex = nr * 8 + nf;
    const target = bAt(board, toIndex);
    if (target && getColorOf(target) !== color) {
      moves.push(
        createMove(fromSq, indexToAlgebraic(toIndex), asPiece(bAt(board, fromIndex)), target),
      );
    }
  }
}

function generateSlidingCaptures(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
  dirs: readonly Dir[],
): void {
  for (const [df, dr] of dirs) {
    let { file, rank } = indexToFR(fromIndex);
    while (true) {
      file += df;
      rank += dr;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
      const toIndex = rank * 8 + file;
      const target = bAt(board, toIndex);
      if (target) {
        if (getColorOf(target) !== color) {
          moves.push(
            createMove(fromSq, indexToAlgebraic(toIndex), asPiece(bAt(board, fromIndex)), target),
          );
        }
        break;
      }
    }
  }
}

function generateKingCaptures(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
): void {
  const { file, rank } = indexToFR(fromIndex);
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const nf = file + df;
      const nr = rank + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      const toIndex = nr * 8 + nf;
      const target = bAt(board, toIndex);
      if (target && getColorOf(target) !== color) {
        moves.push(
          createMove(fromSq, indexToAlgebraic(toIndex), asPiece(bAt(board, fromIndex)), target),
        );
      }
    }
  }
}

/**
 * Determine if the side to move is currently in check.
 */
export function isInCheck(state: RulesState, colorOverride?: Color): boolean {
  const color = colorOverride || state.activeColor;
  const enemy = oppositeColor(color);
  const kingSquare = findKingSquare(state.board, color);
  if (!kingSquare) return false;
  return squareAttackedBy(state, kingSquare, enemy);
}

/**
 * Generate game status from legal moves and check state.
 * Used by GameState to derive checkmate/stalemate/draw states.
 */
export function analyzePosition(state: RulesState): PositionAnalysis {
  const legalMoves = generateLegalMoves(state);
  const isCheckFlag = isInCheck(state);
  return {
    hasLegalMoves: legalMoves.length > 0,
    isCheck: isCheckFlag,
  };
}

/* ===== Piece-specific generators ===== */

function generatePawnMoves(
  state: RulesState,
  fromIndex: number,
  fromSq: Square,
  file: number,
  rank: number,
  color: Color,
  enemy: Color,
  epIndex: number,
  moves: Move[],
): void {
  const { board } = state;
  const dir = color === "white" ? 1 : -1;
  const startRank = color === "white" ? 1 : 6;
  const promotionRank = color === "white" ? 6 : 1;
  const lastRank = color === "white" ? 7 : 0;

  const oneStepRank = rank + dir;
  if (oneStepRank >= 0 && oneStepRank <= 7) {
    const oneStepIndex = oneStepRank * 8 + file;
    if (!bAt(board, oneStepIndex)) {
      // Forward move
      addPawnAdvance(fromSq, fromIndex, oneStepIndex, color, promotionRank, lastRank, moves);

      // Two-step from starting rank
      if (rank === startRank) {
        const twoStepRank = rank + 2 * dir;
        const twoStepIndex = twoStepRank * 8 + file;
        if (!bAt(board, twoStepIndex)) {
          moves.push(
            createMove(fromSq, indexToAlgebraic(twoStepIndex), asPiece(bAt(board, fromIndex))),
          );
        }
      }
    }
  }

  // Captures (including promotion)
  const captureFiles = [file - 1, file + 1];
  for (const cf of captureFiles) {
    if (cf < 0 || cf > 7) continue;
    const targetRank = rank + dir;
    if (targetRank < 0 || targetRank > 7) continue;
    const targetIndex = targetRank * 8 + cf;
    const targetPiece = bAt(board, targetIndex);

    if (targetPiece && getColorOf(targetPiece) === enemy) {
      addPawnCapture(
        fromSq,
        fromIndex,
        targetIndex,
        color,
        targetPiece,
        promotionRank,
        lastRank,
        moves,
      );
    }

    // En passant
    if (epIndex === targetIndex && !targetPiece) {
      const epPawnRank = rank;
      const epPawnIndex = epPawnRank * 8 + cf;
      const captured = bAt(board, epPawnIndex);
      if (captured && getColorOf(captured) === enemy) {
        moves.push(
          createEnPassantMove(
            fromSq,
            indexToAlgebraic(targetIndex),
            asPiece(bAt(board, fromIndex)),
            captured,
          ),
        );
      }
    }
  }
}

function addPawnAdvance(
  fromSq: Square,
  fromIndex: number,
  toIndex: number,
  color: Color,
  promotionRank: number,
  _lastRank: number,
  moves: Move[],
): void {
  const piece: Piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    // Generate promotions to Q,R,B,N
    (["Q", "R", "B", "N"] as const).forEach((promo: PromotionPiece) => {
      moves.push(createPromotionMove(fromSq, toSq, piece, promo));
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece));
  }
}

function addPawnCapture(
  fromSq: Square,
  fromIndex: number,
  toIndex: number,
  color: Color,
  capturedPiece: Piece,
  promotionRank: number,
  _lastRank: number,
  moves: Move[],
): void {
  const piece: Piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    (["Q", "R", "B", "N"] as const).forEach((promo: PromotionPiece) => {
      moves.push(createPromotionMove(fromSq, toSq, piece, promo, capturedPiece));
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece, capturedPiece));
  }
}

function generateKnightMoves(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
): void {
  const { file, rank } = indexToFR(fromIndex);
  const jumps = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];

  for (const jump of jumps) {
    const df = jump[0]!;
    const dr = jump[1]!;
    const nf = file + df;
    const nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const toIndex = nr * 8 + nf;
    const target = bAt(board, toIndex);
    if (!target || getColorOf(target) !== color) {
      moves.push(
        createMove(
          fromSq,
          indexToAlgebraic(toIndex),
          asPiece(bAt(board, fromIndex)),
          target || null,
        ),
      );
    }
  }
}

function generateSlidingMoves(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
  dirs: readonly Dir[],
): void {
  for (const [df, dr] of dirs) {
    let { file, rank } = indexToFR(fromIndex);
    while (true) {
      file += df;
      rank += dr;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
      const toIndex = rank * 8 + file;
      const target = bAt(board, toIndex);
      if (!target) {
        moves.push(
          createMove(fromSq, indexToAlgebraic(toIndex), asPiece(bAt(board, fromIndex)), null),
        );
      } else {
        if (getColorOf(target) !== color) {
          moves.push(
            createMove(fromSq, indexToAlgebraic(toIndex), asPiece(bAt(board, fromIndex)), target),
          );
        }
        break;
      }
    }
  }
}

function generateKingMoves(
  board: Board,
  fromIndex: number,
  fromSq: Square,
  color: Color,
  moves: Move[],
): void {
  const { file, rank } = indexToFR(fromIndex);
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const nf = file + df;
      const nr = rank + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      const toIndex = nr * 8 + nf;
      const target = bAt(board, toIndex);
      if (!target || getColorOf(target) !== color) {
        moves.push(
          createMove(
            fromSq,
            indexToAlgebraic(toIndex),
            asPiece(bAt(board, fromIndex)),
            target || null,
          ),
        );
      }
    }
  }
}

function generateCastlingMoves(
  state: RulesState,
  kingIndex: number,
  kingSq: Square,
  color: Color,
  castlingRights: CastlingRights,
  moves: Move[],
): void {
  const { board } = state;
  const rights = castlingRights[color];
  const rank = color === "white" ? 0 : 7;
  const kingStartIndex = rank * 8 + 4;
  if (kingIndex !== kingStartIndex) return;

  const enemy = oppositeColor(color);

  // Ensure king is not currently in check
  if (squareAttackedBy(state, kingSq, enemy)) return;

  // King-side
  if (rights.kingSide) {
    const fIndex = rank * 8 + 5;
    const gIndex = rank * 8 + 6;
    if (!bAt(board, fIndex) && !bAt(board, gIndex)) {
      const fSq = indexToAlgebraic(fIndex);
      const gSq = indexToAlgebraic(gIndex);
      if (!squareAttackedBy(state, fSq, enemy) && !squareAttackedBy(state, gSq, enemy)) {
        moves.push(
          createCastleMove(
            kingSq,
            gSq,
            asPiece(bAt(board, kingIndex)),
            true, // king side
          ),
        );
      }
    }
  }

  // Queen-side
  if (rights.queenSide) {
    const dIndex = rank * 8 + 3;
    const cIndex = rank * 8 + 2;
    const bIndex = rank * 8 + 1;
    if (!bAt(board, dIndex) && !bAt(board, cIndex) && !bAt(board, bIndex)) {
      const dSq = indexToAlgebraic(dIndex);
      const cSq = indexToAlgebraic(cIndex);
      if (!squareAttackedBy(state, dSq, enemy) && !squareAttackedBy(state, cSq, enemy)) {
        moves.push(
          createCastleMove(
            kingSq,
            cSq,
            asPiece(bAt(board, kingIndex)),
            false, // queen side
          ),
        );
      }
    }
  }
}

/* ===== Attack / check helpers ===== */

function findKingSquare(board: Board, color: Color): Square | null {
  const kingCode = color === "white" ? "wK" : "bK";
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) return indexToAlgebraic(i);
  }
  return null;
}

/**
 * If the side to move is in check, return that side's king square; otherwise null.
 */
export function getCheckedKingSquare(state: RulesState): Square | null {
  if (!isInCheck(state)) return null;
  return findKingSquare(state.board, state.activeColor);
}

// Hoisted to module scope so the hot attack scan allocates nothing per call.
const KNIGHT_JUMPS: Dir[] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const ORTHO_DIRS: Dir[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG_DIRS: Dir[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Whether bAt(board, targetIndex) is attacked by attackerColor. Allocation-free and
 * index-based; checks attackers FROM the target square and exits early.
 */
function squareIndexAttackedBy(board: Board, targetIndex: number, attackerColor: Color): boolean {
  const tf = targetIndex % 8;
  const tr = (targetIndex - tf) / 8;
  const white = attackerColor === "white";

  const knightCode = white ? "wN" : "bN";
  for (let i = 0; i < 8; i++) {
    const f = tf + KNIGHT_JUMPS[i][0];
    const r = tr + KNIGHT_JUMPS[i][1];
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    if (board[r * 8 + f] === knightCode) return true;
  }

  const pawnCode = white ? "wP" : "bP";
  const pr = tr + (white ? -1 : 1); // attackers come from the opposite direction
  if (pr >= 0 && pr <= 7) {
    if (tf > 0 && board[pr * 8 + tf - 1] === pawnCode) return true;
    if (tf < 7 && board[pr * 8 + tf + 1] === pawnCode) return true;
  }

  const kingCode = white ? "wK" : "bK";
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = tf + df;
      const r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      if (board[r * 8 + f] === kingCode) return true;
    }
  }

  const rookCode = white ? "wR" : "bR";
  const bishopCode = white ? "wB" : "bB";
  const queenCode = white ? "wQ" : "bQ";

  for (let i = 0; i < 4; i++) {
    const df = ORTHO_DIRS[i][0];
    const dr = ORTHO_DIRS[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const piece = bAt(board, r * 8 + f);
      if (piece) {
        if (piece === rookCode || piece === queenCode) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  for (let i = 0; i < 4; i++) {
    const df = DIAG_DIRS[i][0];
    const dr = DIAG_DIRS[i][1];
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      const piece = bAt(board, r * 8 + f);
      if (piece) {
        if (piece === bishopCode || piece === queenCode) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }

  return false;
}

/**
 * Whether a given square (algebraic) is attacked by a specific color.
 */
function squareAttackedBy(state: RulesState, targetSq: Square, attackerColor: Color): boolean {
  return squareIndexAttackedBy(state.board, algebraicToIndex(targetSq), attackerColor);
}

/**
 * Check if applying a move leaves own king in check.
 * Used to filter pseudo-legal moves.
 */
function moveLeavesKingInCheck(
  board: Board,
  move: Move,
  moverColor: Color,
  enemy: Color,
  kingIndex: number,
): boolean {
  const fromIndex = algebraicToIndex(move.from);
  const toIndex = algebraicToIndex(move.to);
  const movingPiece = bAt(board, fromIndex);

  // Apply the move in place on the real board (no allocation), test, then revert.
  const savedFrom = bAt(board, fromIndex);
  const savedTo = bAt(board, toIndex);
  board[fromIndex] = null;

  let epCapIndex = -1;
  let epSaved = null;
  if (move.isEnPassant) {
    const dir = moverColor === "white" ? -1 : 1;
    const tf = toIndex % 8;
    const tr = (toIndex - tf) / 8;
    epCapIndex = (tr + dir) * 8 + tf;
    epSaved = bAt(board, epCapIndex);
    board[epCapIndex] = null;
  }

  if (move.promotion) {
    board[toIndex] = `${moverColor === "white" ? "w" : "b"}${move.promotion}` as Piece;
  } else {
    board[toIndex] = movingPiece;
  }

  let rookFrom = -1;
  let rookTo = -1;
  let rookSavedFrom: BoardSquare = null;
  let rookSavedTo: BoardSquare = null;
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const rank = moverColor === "white" ? 0 : 7;
    if (move.isCastleKingSide) {
      rookFrom = rank * 8 + 7;
      rookTo = rank * 8 + 5;
    } else {
      rookFrom = rank * 8 + 0;
      rookTo = rank * 8 + 3;
    }
    rookSavedFrom = bAt(board, rookFrom);
    rookSavedTo = bAt(board, rookTo);
    board[rookTo] = bAt(board, rookFrom);
    board[rookFrom] = null;
  }

  // The king's square after the move: its destination if the king moved (incl.
  // castling), otherwise the precomputed king index.
  const kIndex = movingPiece === "wK" || movingPiece === "bK" ? toIndex : kingIndex;
  const inCheck = kIndex < 0 ? true : squareIndexAttackedBy(board, kIndex, enemy);

  // Revert.
  board[fromIndex] = savedFrom;
  board[toIndex] = savedTo;
  if (epCapIndex >= 0) board[epCapIndex] = epSaved;
  if (rookFrom >= 0) {
    board[rookFrom] = rookSavedFrom;
    board[rookTo] = rookSavedTo;
  }

  return inCheck;
}
