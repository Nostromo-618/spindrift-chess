/**
 * Evaluator.ts
 *
 * Static evaluation for chess positions.
 * - Material balance
 * - Tapered piece-square tables (middlegame + endgame interpolation)
 * - Pawn structure (passed, doubled, isolated, connected passed)
 * - Bishop pair bonus
 * - Rook on open/semi-open file bonus
 * - King safety (pawn shield, open files near king)
 * - Mobility evaluation
 * - King proximity to passed pawns (endgame)
 * - Tempo bonus
 *
 * Tapered evaluation blends middlegame and endgame scores based on
 * remaining non-pawn material (game phase).
 */

import { getColorOf } from "./Board.js";
import type { Board, BoardSquare, Color, PieceType, RulesState } from "./types.js";

/** Board cell read that collapses undefined (noUncheckedIndexedAccess). */
function bAt(board: Board, i: number): BoardSquare {
  return board[i] ?? null;
}

// Geometry is independent of the position. Each sliding ray includes every
// square through the edge; occupied squares terminate it during evaluation.
const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;
const DIAGONAL_STEPS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const ORTHOGONAL_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const KING_STEPS = [...DIAGONAL_STEPS, ...ORTHOGONAL_STEPS];

function targetsFrom(index: number, steps: readonly (readonly [number, number])[]): number[] {
  const targets: number[] = [];
  for (const [df, dr] of steps) {
    const file = (index % 8) + df;
    const rank = Math.floor(index / 8) + dr;
    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) targets.push(rank * 8 + file);
  }
  return targets;
}

function raysFrom(index: number, steps: readonly (readonly [number, number])[]): number[][] {
  return steps.map(([df, dr]) => {
    const ray: number[] = [];
    let file = (index % 8) + df;
    let rank = Math.floor(index / 8) + dr;
    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      ray.push(rank * 8 + file);
      file += df;
      rank += dr;
    }
    return ray;
  });
}

const KNIGHT_TARGETS = Array.from({ length: 64 }, (_, i) => targetsFrom(i, KNIGHT_STEPS));
const KING_TARGETS = Array.from({ length: 64 }, (_, i) => targetsFrom(i, KING_STEPS));
const BISHOP_RAYS = Array.from({ length: 64 }, (_, i) => raysFrom(i, DIAGONAL_STEPS));
const ROOK_RAYS = Array.from({ length: 64 }, (_, i) => raysFrom(i, ORTHOGONAL_STEPS));
const QUEEN_RAYS = Array.from({ length: 64 }, (_, i) => [...BISHOP_RAYS[i]!, ...ROOK_RAYS[i]!]);

// One map holds both colors' attacks and the pawn-only attacks used by mobility.
const WHITE_ATTACK = 1;
const BLACK_ATTACK = 2;
const WHITE_PAWN_ATTACK = 4;
const BLACK_PAWN_ATTACK = 8;

function addPieceAttacks(
  board: Board,
  attacks: Uint8Array,
  index: number,
  type: PieceType,
  color: Color,
): void {
  const mask = color === "white" ? WHITE_ATTACK : BLACK_ATTACK;
  if (type === "P") {
    const rank = Math.floor(index / 8) + (color === "white" ? 1 : -1);
    if (rank < 0 || rank > 7) return;
    const file = index % 8;
    const pawnMask = mask | (color === "white" ? WHITE_PAWN_ATTACK : BLACK_PAWN_ATTACK);
    if (file > 0) attacks[rank * 8 + file - 1]! |= pawnMask;
    if (file < 7) attacks[rank * 8 + file + 1]! |= pawnMask;
  } else if (type === "N" || type === "K") {
    const targets = type === "N" ? KNIGHT_TARGETS[index]! : KING_TARGETS[index]!;
    for (const target of targets) attacks[target]! |= mask;
  } else {
    const rays =
      type === "B" ? BISHOP_RAYS[index]! : type === "R" ? ROOK_RAYS[index]! : QUEEN_RAYS[index]!;
    for (const ray of rays) {
      for (const target of ray) {
        // A friendly blocker is defended, but nothing beyond it is attacked.
        attacks[target]! |= mask;
        if (bAt(board, target)) break;
      }
    }
  }
}

const PAWN_HASH_SIZE = 8192; // power of 2
const PAWN_HASH_MASK = BigInt(PAWN_HASH_SIZE - 1);
interface PawnHashEntry {
  key: bigint;
  mgScore: number;
  egScore: number;
}
const pawnHashTable: Array<PawnHashEntry | undefined> = new Array(PAWN_HASH_SIZE);

export function clearPawnHash(): void {
  pawnHashTable.fill(undefined);
}

/* === Evaluation bonus/penalty constants === */
const BISHOP_PAIR_BONUS_MG = 35;
const BISHOP_PAIR_BONUS_EG = 55;
const PASSED_PAWN_BONUS_MG = [0, 10, 20, 35, 55, 80, 110, 0];
const PASSED_PAWN_BONUS_EG = [0, 15, 30, 50, 75, 110, 150, 0];
const DOUBLED_PAWN_PENALTY = 20;
const ISOLATED_PAWN_PENALTY = 15;
const CONNECTED_PASSED_BONUS = 25;
const ROOK_OPEN_FILE_BONUS = 25;
const ROOK_SEMI_OPEN_FILE_BONUS = 12;
const ROOK_BEHIND_PASSED_BONUS = 20;
const ROOK_SEVENTH_RANK_BONUS = 18;
const ROOK_KING_FILE_PRESSURE_BONUS = 12;
const BLOCKED_PASSED_PENALTY = 15;

/* === King safety constants === */
const PAWN_SHIELD_BONUS = 15;
const OPEN_FILE_NEAR_KING_PENALTY = 20;
const CASTLED_KING_BONUS = 25;

/* === Mobility weights (per available square) === */
const MOBILITY_KNIGHT = 4;
const MOBILITY_BISHOP = 5;
const MOBILITY_ROOK = 2;
const MOBILITY_QUEEN = 1;

/* === Tempo bonus === */
const TEMPO_BONUS = 10;

/* === King distance to passed pawn (endgame) === */
const KING_PASSER_PROXIMITY_OWN = 5; // bonus per rank closer
const KING_PASSER_PROXIMITY_ENEMY = 3; // penalty per rank closer (enemy king)
const KING_RING_ATTACK_PENALTY = 7;
const KING_RING_LOOSE_SQUARE_PENALTY = 4;

/**
 * Phase calculation: total non-pawn non-king material at game start.
 * 2*(N+B+R+Q) = 2*(320+330+500+900) = 4100 per side
 */
const PHASE_TOTAL = 4100;

interface PawnPos {
  index: number;
  file: number;
  rank: number;
}

/**
 * Piece values (centipawns).
 */
const PIECE_VALUES: Record<PieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

/* Non-pawn material values for phase calculation */
const PHASE_WEIGHTS: Record<"N" | "B" | "R" | "Q", number> = {
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
};

/* ============================================================
 * Piece-Square Tables — MIDDLEGAME
 * Indexed 0..63 with a1=0. Mirror for black.
 * ============================================================ */

// Indexed a1=0..h8=63 (rank 1 first). White reads directly; black mirrors ranks.
const PST_PAWN_MG = [
  0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 5, 20,
  20, 5, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 35, 35, 20, 10, 10, 40, 50, 50, 60, 60, 50,
  50, 40, 0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT_MG = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
  -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
  -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP_MG = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10,
  -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK_MG = [
  0, 0, 5, 10, 10, 5, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
  0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0, 0,
  0, 0, 0, 0, 0,
];

const PST_QUEEN_MG = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, -5,
  0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0,
  -10, -20, -10, -10, -5, -5, -10, -10, -20,
];

const PST_KING_MG = [
  20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10,
  -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
  -40, -30,
];

/* ============================================================
 * Piece-Square Tables — ENDGAME
 * Key differences: King centralizes, pawns push, knights less central
 * ============================================================ */

const PST_PAWN_EG = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 10, 10, 5, 5, 5, 10, 10, 15, 25, 25, 15,
  10, 10, 20, 20, 25, 30, 30, 25, 20, 20, 40, 40, 40, 45, 45, 40, 40, 40, 70, 70, 70, 70, 70, 70,
  70, 70, 0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT_EG = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 5, 10, 10, 5, 0,
  -30, -30, 0, 10, 15, 15, 10, 0, -30, -30, 0, 10, 15, 15, 10, 0, -30, -30, 0, 5, 10, 10, 5, 0, -30,
  -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
];

const PST_BISHOP_EG = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 10, 10, 10, 10, 0,
  -10, -10, 0, 10, 15, 15, 10, 0, -10, -10, 0, 10, 15, 15, 10, 0, -10, -10, 0, 10, 10, 10, 10, 0,
  -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20,
];

const PST_ROOK_EG = [
  0, 0, 5, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_QUEEN_EG = [
  -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5,
  0, 5, 10, 10, 5, 0, -5, -5, 0, 5, 10, 10, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0,
  0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
];

/* King endgame: centralize aggressively */
const PST_KING_EG = [
  -50, -30, -20, -20, -20, -20, -30, -50, -30, -10, 0, 5, 5, 0, -10, -30, -20, 0, 10, 15, 15, 10, 0,
  -20, -20, 0, 15, 20, 20, 15, 0, -20, -20, 0, 15, 20, 20, 15, 0, -20, -20, 0, 10, 15, 15, 10, 0,
  -20, -30, -10, 0, 5, 5, 0, -10, -30, -50, -30, -20, -20, -20, -20, -30, -50,
];

/**
 * Evaluate board from perspective of `color`.
 * Positive score = good for `color`.
 *
 */
export function evaluate(
  state: Pick<RulesState, "board"> & { activeColor?: Color },
  color: Color,
  pawnHash?: bigint,
): number {
  const { board } = state;
  let mgScore = 0;
  let egScore = 0;
  const attacks = new Uint8Array(64);

  // Track pieces for additional evaluation
  let whiteBishops = 0;
  let blackBishops = 0;
  let whiteKingIndex = -1;
  let blackKingIndex = -1;
  const whitePawnFiles = new Array(8).fill(0);
  const blackPawnFiles = new Array(8).fill(0);
  const whitePawnPositions: PawnPos[] = [];
  const blackPawnPositions: PawnPos[] = [];
  const whiteRookPositions: number[] = [];
  const blackRookPositions: number[] = [];

  // Phase calculation: remaining non-pawn material
  let whiteNonPawnMaterial = 0;
  let blackNonPawnMaterial = 0;

  // Piece lists for mobility
  const whiteKnights: number[] = [];
  const blackKnights: number[] = [];
  const whiteBishopList: number[] = [];
  const blackBishopList: number[] = [];
  const whiteRookList: number[] = [];
  const blackRookList: number[] = [];
  const whiteQueens: number[] = [];
  const blackQueens: number[] = [];

  // First pass: material + PST + collect piece info
  for (let i = 0; i < 64; i += 1) {
    const piece = bAt(board, i);
    if (!piece) continue;
    const pc = getColorOf(piece);
    const type = piece[1] as PieceType;
    addPieceAttacks(board, attacks, i, type, pc!);
    const base = PIECE_VALUES[type] || 0;
    let mgPst = 0;
    let egPst = 0;

    const file = i % 8;
    const rank = Math.floor(i / 8);
    const psi = pstIndex(i, pc);

    switch (type) {
      case "P":
        mgPst = PST_PAWN_MG[psi]!;
        egPst = PST_PAWN_EG[psi]!;
        if (pc === "white") {
          whitePawnFiles[file]++;
          whitePawnPositions.push({ index: i, file, rank });
        } else {
          blackPawnFiles[file]++;
          blackPawnPositions.push({ index: i, file, rank });
        }
        break;
      case "N":
        mgPst = PST_KNIGHT_MG[psi]!;
        egPst = PST_KNIGHT_EG[psi]!;
        if (pc === "white") {
          whiteKnights.push(i);
          whiteNonPawnMaterial += PHASE_WEIGHTS.N;
        } else {
          blackKnights.push(i);
          blackNonPawnMaterial += PHASE_WEIGHTS.N;
        }
        break;
      case "B":
        mgPst = PST_BISHOP_MG[psi]!;
        egPst = PST_BISHOP_EG[psi]!;
        if (pc === "white") {
          whiteBishops++;
          whiteBishopList.push(i);
          whiteNonPawnMaterial += PHASE_WEIGHTS.B;
        } else {
          blackBishops++;
          blackBishopList.push(i);
          blackNonPawnMaterial += PHASE_WEIGHTS.B;
        }
        break;
      case "R":
        mgPst = PST_ROOK_MG[psi]!;
        egPst = PST_ROOK_EG[psi]!;
        if (pc === "white") {
          whiteRookPositions.push(file);
          whiteRookList.push(i);
          whiteNonPawnMaterial += PHASE_WEIGHTS.R;
        } else {
          blackRookPositions.push(file);
          blackRookList.push(i);
          blackNonPawnMaterial += PHASE_WEIGHTS.R;
        }
        break;
      case "Q":
        mgPst = PST_QUEEN_MG[psi]!;
        egPst = PST_QUEEN_EG[psi]!;
        if (pc === "white") {
          whiteQueens.push(i);
          whiteNonPawnMaterial += PHASE_WEIGHTS.Q;
        } else {
          blackQueens.push(i);
          blackNonPawnMaterial += PHASE_WEIGHTS.Q;
        }
        break;
      case "K":
        mgPst = PST_KING_MG[psi]!;
        egPst = PST_KING_EG[psi]!;
        if (pc === "white") whiteKingIndex = i;
        else blackKingIndex = i;
        break;
      default:
        break;
    }

    const mgPieceScore = base + mgPst;
    const egPieceScore = base + egPst;
    if (pc === color) {
      mgScore += mgPieceScore;
      egScore += egPieceScore;
    } else {
      mgScore -= mgPieceScore;
      egScore -= egPieceScore;
    }
  }

  // Compute game phase (1 = middlegame, 0 = endgame)
  const totalNonPawn = whiteNonPawnMaterial + blackNonPawnMaterial;
  const phase = Math.min(1, totalNonPawn / PHASE_TOTAL);

  // Bishop pair bonus (tapered)
  if (whiteBishops >= 2) {
    const bp = lerp(BISHOP_PAIR_BONUS_EG, BISHOP_PAIR_BONUS_MG, phase);
    mgScore += color === "white" ? bp : -bp;
    egScore += color === "white" ? bp : -bp;
  }
  if (blackBishops >= 2) {
    const bp = lerp(BISHOP_PAIR_BONUS_EG, BISHOP_PAIR_BONUS_MG, phase);
    mgScore += color === "black" ? bp : -bp;
    egScore += color === "black" ? bp : -bp;
  }

  // Pawn structure evaluation (tapered)
  let pawnMg = 0;
  let pawnEg = 0;
  let cachedPawnEval = false;

  if (pawnHash !== undefined) {
    const idx = Number(pawnHash & PAWN_HASH_MASK);
    const entry = pawnHashTable[idx];
    if (entry && entry.key === pawnHash) {
      pawnMg = entry.mgScore;
      pawnEg = entry.egScore;
      cachedPawnEval = true;
    }
  }

  if (!cachedPawnEval) {
    const wMg = evaluatePawnStructure(
      whitePawnPositions,
      whitePawnFiles,
      blackPawnFiles,
      blackPawnPositions,
      "white",
      "white",
      1,
      board,
      whiteRookPositions,
    );
    const bMg = evaluatePawnStructure(
      blackPawnPositions,
      blackPawnFiles,
      whitePawnFiles,
      whitePawnPositions,
      "black",
      "white",
      1,
      board,
      blackRookPositions,
    );
    const wEg = evaluatePawnStructure(
      whitePawnPositions,
      whitePawnFiles,
      blackPawnFiles,
      blackPawnPositions,
      "white",
      "white",
      0,
      board,
      whiteRookPositions,
    );
    const bEg = evaluatePawnStructure(
      blackPawnPositions,
      blackPawnFiles,
      whitePawnFiles,
      whitePawnPositions,
      "black",
      "white",
      0,
      board,
      blackRookPositions,
    );

    pawnMg = wMg + bMg;
    pawnEg = wEg + bEg;

    if (pawnHash !== undefined) {
      pawnHashTable[Number(pawnHash & PAWN_HASH_MASK)] = {
        key: pawnHash,
        mgScore: pawnMg,
        egScore: pawnEg,
      };
    }
  }

  if (color === "white") {
    mgScore += pawnMg;
    egScore += pawnEg;
  } else {
    mgScore -= pawnMg;
    egScore -= pawnEg;
  }

  // Rook on open/semi-open file
  const whiteRookEval = evaluateRooks(
    whiteRookPositions,
    whitePawnFiles,
    blackPawnFiles,
    "white",
    color,
  );
  const blackRookEval = evaluateRooks(
    blackRookPositions,
    blackPawnFiles,
    whitePawnFiles,
    "black",
    color,
  );
  mgScore += whiteRookEval;
  egScore += whiteRookEval;
  mgScore += blackRookEval;
  egScore += blackRookEval;

  const whiteRookActivity = evaluateRookActivity(
    board,
    whiteRookList,
    blackKingIndex,
    blackPawnPositions,
    "white",
    color,
  );
  const blackRookActivity = evaluateRookActivity(
    board,
    blackRookList,
    whiteKingIndex,
    whitePawnPositions,
    "black",
    color,
  );
  mgScore += whiteRookActivity;
  egScore += whiteRookActivity;
  mgScore += blackRookActivity;
  egScore += blackRookActivity;

  // King safety evaluation (middlegame weighted)
  const whiteKingSafety = evaluateKingSafety(
    whiteKingIndex,
    whitePawnFiles,
    blackPawnFiles,
    "white",
    color,
  );
  const blackKingSafety = evaluateKingSafety(
    blackKingIndex,
    blackPawnFiles,
    whitePawnFiles,
    "black",
    color,
  );
  mgScore += whiteKingSafety;
  mgScore += blackKingSafety;

  const whiteKingPressure = evaluateKingPressure(attacks, whiteKingIndex, "white", color, phase);
  const blackKingPressure = evaluateKingPressure(attacks, blackKingIndex, "black", color, phase);
  mgScore += whiteKingPressure;
  mgScore += blackKingPressure;

  const whiteTropism = evaluateKingTropism(
    whiteKingIndex,
    blackKnights,
    blackBishopList,
    blackRookList,
    blackQueens,
    "white",
    color,
  );
  const blackTropism = evaluateKingTropism(
    blackKingIndex,
    whiteKnights,
    whiteBishopList,
    whiteRookList,
    whiteQueens,
    "black",
    color,
  );
  mgScore += whiteTropism;
  mgScore += blackTropism;

  // Mobility evaluation
  const whiteMobility = evaluateMobility(
    board,
    whiteKnights,
    whiteBishopList,
    whiteRookList,
    whiteQueens,
    "white",
    color,
    attacks,
  );
  const blackMobility = evaluateMobility(
    board,
    blackKnights,
    blackBishopList,
    blackRookList,
    blackQueens,
    "black",
    color,
    attacks,
  );
  mgScore += whiteMobility;
  egScore += whiteMobility;
  mgScore += blackMobility;
  egScore += blackMobility;

  const whiteLoosePieces = evaluateLoosePieces(board, attacks, "white", color, phase);
  const blackLoosePieces = evaluateLoosePieces(board, attacks, "black", color, phase);
  mgScore += whiteLoosePieces;
  egScore += Math.round(whiteLoosePieces * 0.7);
  mgScore += blackLoosePieces;
  egScore += Math.round(blackLoosePieces * 0.7);

  // King proximity to passed pawns (endgame only, scales with 1-phase)
  if (phase < 0.7) {
    const kpEval = evaluateKingPasserProximity(
      whitePawnPositions,
      blackPawnPositions,
      whitePawnFiles,
      blackPawnFiles,
      whiteKingIndex,
      blackKingIndex,
      color,
      phase,
    );
    egScore += kpEval;
  }

  egScore += evaluatePassedPawnRaces(
    whitePawnPositions,
    blackPawnPositions,
    whiteKingIndex,
    blackKingIndex,
    color,
    phase,
  );

  // Tempo bonus
  if (state.activeColor === color) {
    mgScore += TEMPO_BONUS;
    egScore += TEMPO_BONUS;
  }

  // Tapered score: interpolate between mg and eg
  const finalScore = Math.round(mgScore * phase + egScore * (1 - phase));
  return finalScore;
}

/**
 * Linear interpolation helper.
 */
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Evaluate pawn structure for one color (tapered).
 */
function isBackwardPawn(
  file: number,
  rank: number,
  pawnColor: Color,
  ownPawns: PawnPos[],
  enemyPawns: PawnPos[],
): boolean {
  for (const p of ownPawns) {
    if (Math.abs(p.file - file) === 1) {
      if (pawnColor === "white" && p.rank <= rank) return false;
      if (pawnColor === "black" && p.rank >= rank) return false;
    }
  }
  const stopRank = pawnColor === "white" ? rank + 1 : rank - 1;
  const attackRank = pawnColor === "white" ? stopRank + 1 : stopRank - 1;
  let attacked = false;
  for (const p of enemyPawns) {
    if (p.rank === attackRank && Math.abs(p.file - file) === 1) {
      attacked = true;
      break;
    }
  }
  return attacked;
}

function evaluatePawnStructure(
  pawnPositions: PawnPos[],
  ownPawnFiles: number[],
  enemyPawnFiles: number[],
  enemyPawnPositions: PawnPos[],
  pawnColor: Color,
  evalColor: Color,
  phase: number,
  board: Board,
  rookFiles: number[],
): number {
  let bonus = 0;
  const sign = pawnColor === evalColor ? 1 : -1;

  for (let pi = 0; pi < pawnPositions.length; pi++) {
    const pawn = pawnPositions[pi]!;
    const { file, rank } = pawn;

    // Doubled pawn penalty
    if (ownPawnFiles[file]! > 1) {
      bonus -= DOUBLED_PAWN_PENALTY / ownPawnFiles[file]!;
    }

    // Isolated pawn penalty
    const leftFile = file > 0 ? ownPawnFiles[file - 1] : 0;
    const rightFile = file < 7 ? ownPawnFiles[file + 1] : 0;
    if (leftFile === 0 && rightFile === 0) {
      bonus -= ISOLATED_PAWN_PENALTY;
    } else if (isBackwardPawn(file, rank, pawnColor, pawnPositions, enemyPawnPositions)) {
      let backMg = 12;
      let backEg = 8;
      if (enemyPawnFiles[file] === 0) {
        backMg *= 2;
        backEg *= 2;
      }
      bonus -= lerp(backEg, backMg, phase);
    }

    // Passed pawn bonus (tapered)
    if (isPassedPawn(file, rank, pawnColor, enemyPawnPositions)) {
      // Index by true advancement toward promotion (a1=0 indexing: white
      // advances as rank increases, black as rank decreases).
      const advancementRank = pawnColor === "white" ? rank : 7 - rank;
      const mgBonus = PASSED_PAWN_BONUS_MG[advancementRank]!;
      const egBonus = PASSED_PAWN_BONUS_EG[advancementRank]!;
      bonus += lerp(egBonus, mgBonus, phase);

      // Connected passed pawn bonus: adjacent file also has a passed pawn
      for (let pi2 = 0; pi2 < pawnPositions.length; pi2++) {
        if (pi2 === pi) continue;
        const adj = pawnPositions[pi2]!;
        if (
          Math.abs(adj.file - file) === 1 &&
          isPassedPawn(adj.file, adj.rank, pawnColor, enemyPawnPositions)
        ) {
          bonus += CONNECTED_PASSED_BONUS;
          break; // count once
        }
      }

      // Blocked passed pawn penalty
      const aheadRank = pawnColor === "white" ? rank + 1 : rank - 1;
      if (aheadRank >= 0 && aheadRank <= 7) {
        const aheadIndex = aheadRank * 8 + file;
        if (bAt(board, aheadIndex)) {
          bonus -= BLOCKED_PASSED_PENALTY;
        }
      }

      // Rook behind passed pawn bonus
      for (const rookFile of rookFiles) {
        if (rookFile === file) {
          bonus += ROOK_BEHIND_PASSED_BONUS;
          break;
        }
      }
    }
  }

  return bonus * sign;
}

/**
 * Check if a pawn is passed.
 */
function isPassedPawn(
  file: number,
  rank: number,
  pawnColor: Color,
  enemyPawns: PawnPos[],
): boolean {
  // Only enemy pawns ahead on this or an adjacent file can stop a passer.
  // Scan each pawn once instead of rescanning the list for every forward rank.
  for (const pawn of enemyPawns) {
    if (
      Math.abs(pawn.file - file) <= 1 &&
      (pawnColor === "white" ? pawn.rank > rank : pawn.rank < rank)
    )
      return false;
  }
  return true;
}

/**
 * Evaluate rook placement on open/semi-open files.
 */
function evaluateRooks(
  rookFiles: number[],
  ownPawnFiles: number[],
  enemyPawnFiles: number[],
  rookColor: Color,
  evalColor: Color,
): number {
  let bonus = 0;
  const sign = rookColor === evalColor ? 1 : -1;

  for (const file of rookFiles) {
    const ownPawnsOnFile = ownPawnFiles[file]!;
    const enemyPawnsOnFile = enemyPawnFiles[file]!;

    if (ownPawnsOnFile === 0 && enemyPawnsOnFile === 0) {
      bonus += ROOK_OPEN_FILE_BONUS;
    } else if (ownPawnsOnFile === 0) {
      bonus += ROOK_SEMI_OPEN_FILE_BONUS;
    }
  }

  return bonus * sign;
}

function evaluateRookActivity(
  board: Board,
  rookIndexes: number[],
  enemyKingIndex: number,
  enemyPawns: PawnPos[],
  rookColor: Color,
  evalColor: Color,
): number {
  let bonus = 0;
  const sign = rookColor === evalColor ? 1 : -1;
  const seventhRank = rookColor === "white" ? 6 : 1;

  for (const rookIndex of rookIndexes) {
    const rank = Math.floor(rookIndex / 8);
    if (rank === seventhRank) {
      // Enemy pawns sit on the rook's 7th rank (6 for white, 1 for black);
      // a confined enemy king sits on its OWN back rank (7 for white's target,
      // 0 for black's target) — these are different ranks.
      const pawnTargetRank = rookColor === "white" ? 6 : 1;
      const kingConfinedRank = rookColor === "white" ? 7 : 0;
      const kingOn8th = enemyKingIndex >= 0 && Math.floor(enemyKingIndex / 8) === kingConfinedRank;
      const hasTargets = enemyPawns.some((p) => p.rank === pawnTargetRank) || kingOn8th;
      if (hasTargets) {
        bonus += kingOn8th ? ROOK_SEVENTH_RANK_BONUS * 2 : ROOK_SEVENTH_RANK_BONUS;
      }
    }

    if (enemyKingIndex >= 0 && rookHasLineToKing(board, rookIndex, enemyKingIndex)) {
      bonus += ROOK_KING_FILE_PRESSURE_BONUS;
    }
  }

  return bonus * sign;
}

function rookHasLineToKing(board: Board, rookIndex: number, kingIndex: number): boolean {
  const rf = rookIndex % 8;
  const rr = Math.floor(rookIndex / 8);
  const kf = kingIndex % 8;
  const kr = Math.floor(kingIndex / 8);

  let step: number;
  if (rf === kf) step = kr > rr ? 8 : -8;
  else if (rr === kr) step = kf > rf ? 1 : -1;
  else return false;

  for (let i = rookIndex + step; i !== kingIndex; i += step) {
    if (bAt(board, i)) return false;
  }
  return true;
}

/**
 * Map index for PST; mirror ranks for black.
 */
function pstIndex(index: number, color: Color | null): number {
  if (color === "white") return index;
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const mirroredRank = 7 - rank;
  return mirroredRank * 8 + file;
}

/**
 * Evaluate king safety.
 */
function evaluateKingSafety(
  kingIndex: number,
  ownPawnFiles: number[],
  _enemyPawnFiles: number[],
  kingColor: Color,
  evalColor: Color,
): number {
  if (kingIndex < 0) return 0;

  let bonus = 0;
  const sign = kingColor === evalColor ? 1 : -1;

  const kingFile = kingIndex % 8;
  const kingRank = Math.floor(kingIndex / 8);

  const isOnBackRank =
    (kingColor === "white" && kingRank === 0) || (kingColor === "black" && kingRank === 7);

  if (isOnBackRank && (kingFile === 6 || kingFile === 2)) {
    bonus += CASTLED_KING_BONUS;
  }

  if (isOnBackRank) {
    const shieldFiles = [];
    if (kingFile > 0) shieldFiles.push(kingFile - 1);
    shieldFiles.push(kingFile);
    if (kingFile < 7) shieldFiles.push(kingFile + 1);

    for (const file of shieldFiles) {
      if (ownPawnFiles[file]! > 0) {
        bonus += PAWN_SHIELD_BONUS;
      }
    }
  }

  const nearbyFiles = [];
  if (kingFile > 0) nearbyFiles.push(kingFile - 1);
  nearbyFiles.push(kingFile);
  if (kingFile < 7) nearbyFiles.push(kingFile + 1);

  for (const file of nearbyFiles) {
    if (ownPawnFiles[file]! === 0) {
      bonus -= OPEN_FILE_NEAR_KING_PENALTY;
    }
  }

  return bonus * sign;
}

function evaluateKingPressure(
  attacks: Uint8Array,
  kingIndex: number,
  kingColor: Color,
  evalColor: Color,
  phase: number,
): number {
  if (kingIndex < 0) return 0;

  const ownMask = kingColor === "white" ? WHITE_ATTACK : BLACK_ATTACK;
  const enemyMask = kingColor === "white" ? BLACK_ATTACK : WHITE_ATTACK;
  const sign = kingColor === evalColor ? 1 : -1;
  const attackPenalty = KING_RING_ATTACK_PENALTY + Math.round(5 * phase);
  let pressure = 0;

  // The king's square itself is part of its ring in this evaluation term.
  const kingAttacks = attacks[kingIndex]!;
  if (kingAttacks & enemyMask) {
    pressure += attackPenalty;
    if (!(kingAttacks & ownMask)) pressure += KING_RING_LOOSE_SQUARE_PENALTY;
  }
  for (const index of KING_TARGETS[kingIndex]!) {
    const squareAttacks = attacks[index]!;
    if (squareAttacks & enemyMask) {
      pressure += attackPenalty;
      if (!(squareAttacks & ownMask)) pressure += KING_RING_LOOSE_SQUARE_PENALTY;
    }
  }

  return -pressure * sign;
}

function evaluateLoosePieces(
  board: Board,
  attacks: Uint8Array,
  pieceColor: Color,
  evalColor: Color,
  phase: number,
): number {
  const ownMask = pieceColor === "white" ? WHITE_ATTACK : BLACK_ATTACK;
  const enemyMask = pieceColor === "white" ? BLACK_ATTACK : WHITE_ATTACK;
  const sign = pieceColor === evalColor ? 1 : -1;
  let penalty = 0;

  for (let i = 0; i < 64; i++) {
    const piece = bAt(board, i);
    if (!piece || getColorOf(piece) !== pieceColor || piece[1] === "K") continue;
    if (!(attacks[i]! & enemyMask)) continue;

    const defended = attacks[i]! & ownMask;
    const type = piece[1] as PieceType;
    let basePenalty = Math.round((PIECE_VALUES[type] || 0) * (type === "P" ? 0.08 : 0.12));
    basePenalty = Math.max(type === "P" ? 6 : 18, Math.min(basePenalty, type === "Q" ? 120 : 75));
    if (defended) basePenalty = Math.round(basePenalty * 0.45);
    penalty += Math.round(basePenalty * (0.75 + phase * 0.25));
  }

  return -penalty * sign;
}

/**
 * Counts pseudo-legal mobility with the same geometry as the attack map.
 * Pawns restrict knight/bishop/rook mobility; queen mobility is unrestricted.
 */
function evaluateMobility(
  board: Board,
  knights: number[],
  bishops: number[],
  rooks: number[],
  queens: number[],
  pieceColor: Color,
  evalColor: Color,
  attacks: Uint8Array,
): number {
  let bonus = 0;
  const sign = pieceColor === evalColor ? 1 : -1;
  const enemyPawnMask = pieceColor === "white" ? BLACK_PAWN_ATTACK : WHITE_PAWN_ATTACK;

  for (const index of knights) {
    let mobility = 0;
    for (const targetIndex of KNIGHT_TARGETS[index]!) {
      if (attacks[targetIndex]! & enemyPawnMask) continue;
      const target = bAt(board, targetIndex);
      if (!target || getColorOf(target) !== pieceColor) mobility++;
    }
    bonus += mobility * MOBILITY_KNIGHT;
  }

  for (const index of bishops) {
    bonus +=
      sliderMobility(board, BISHOP_RAYS[index]!, pieceColor, attacks, enemyPawnMask) *
      MOBILITY_BISHOP;
  }
  for (const index of rooks) {
    bonus +=
      sliderMobility(board, ROOK_RAYS[index]!, pieceColor, attacks, enemyPawnMask) * MOBILITY_ROOK;
  }
  for (const index of queens) {
    bonus += sliderMobility(board, QUEEN_RAYS[index]!, pieceColor, attacks, 0) * MOBILITY_QUEEN;
  }

  return bonus * sign;
}

function sliderMobility(
  board: Board,
  rays: number[][],
  pieceColor: Color,
  attacks: Uint8Array,
  enemyPawnMask: number,
): number {
  let mobility = 0;
  for (const ray of rays) {
    for (const index of ray) {
      const target = bAt(board, index);
      if (!(attacks[index]! & enemyPawnMask) && (!target || getColorOf(target) !== pieceColor)) {
        mobility++;
      }
      if (target) break;
    }
  }
  return mobility;
}

function evaluatePassedPawnRaces(
  whitePawns: PawnPos[],
  blackPawns: PawnPos[],
  whiteKingIdx: number,
  blackKingIdx: number,
  evalColor: Color,
  phase: number,
): number {
  if (phase > 0.75) return 0;

  let bonus = 0;
  const raceWeight = 1 - phase;

  for (const pawn of whitePawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "white", blackPawns)) continue;
    const promotionDistance = 7 - pawn.rank;
    const promoSquare = { file: pawn.file, rank: 7 };
    const enemyKingDistance = kingDistanceToSquare(blackKingIdx, promoSquare);
    const ownKingDistance = kingDistanceToSquare(whiteKingIdx, pawn);
    let raceBonus = Math.max(0, 7 - promotionDistance) * 6;
    if (enemyKingDistance > promotionDistance) raceBonus += 35;
    if (ownKingDistance <= promotionDistance + 1) raceBonus += 12;
    bonus += evalColor === "white" ? raceBonus * raceWeight : -raceBonus * raceWeight;
  }

  for (const pawn of blackPawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "black", whitePawns)) continue;
    const promotionDistance = pawn.rank;
    const promoSquare = { file: pawn.file, rank: 0 };
    const enemyKingDistance = kingDistanceToSquare(whiteKingIdx, promoSquare);
    const ownKingDistance = kingDistanceToSquare(blackKingIdx, pawn);
    let raceBonus = Math.max(0, 7 - promotionDistance) * 6;
    if (enemyKingDistance > promotionDistance) raceBonus += 35;
    if (ownKingDistance <= promotionDistance + 1) raceBonus += 12;
    bonus += evalColor === "black" ? raceBonus * raceWeight : -raceBonus * raceWeight;
  }

  return Math.round(bonus);
}

function kingDistanceToSquare(kingIndex: number, square: { file: number; rank: number }): number {
  if (kingIndex < 0) return 99;
  const kf = kingIndex % 8;
  const kr = Math.floor(kingIndex / 8);
  return Math.max(Math.abs(kf - square.file), Math.abs(kr - square.rank));
}

/**
 * King proximity to passed pawns in endgame.
 */
function evaluateKingPasserProximity(
  whitePawns: PawnPos[],
  blackPawns: PawnPos[],
  _whitePawnFiles: number[],
  _blackPawnFiles: number[],
  whiteKingIdx: number,
  blackKingIdx: number,
  evalColor: Color,
  phase: number,
): number {
  let bonus = 0;
  const egWeight = 1 - phase; // stronger as phase → 0

  // White passed pawns: own white king close = good, enemy black king close = bad
  for (const pawn of whitePawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "white", blackPawns)) continue;
    if (whiteKingIdx >= 0) {
      const kf = whiteKingIdx % 8;
      const kr = Math.floor(whiteKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxBonus = Math.max(0, 7 - dist) * KING_PASSER_PROXIMITY_OWN * egWeight;
      bonus += evalColor === "white" ? proxBonus : -proxBonus;
    }
    if (blackKingIdx >= 0) {
      const kf = blackKingIdx % 8;
      const kr = Math.floor(blackKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxPenalty = Math.max(0, 7 - dist) * KING_PASSER_PROXIMITY_ENEMY * egWeight;
      bonus += evalColor === "white" ? -proxPenalty : proxPenalty;
    }
  }

  // Black passed pawns
  for (const pawn of blackPawns) {
    if (!isPassedPawn(pawn.file, pawn.rank, "black", whitePawns)) continue;
    if (blackKingIdx >= 0) {
      const kf = blackKingIdx % 8;
      const kr = Math.floor(blackKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxBonus = Math.max(0, 7 - dist) * KING_PASSER_PROXIMITY_OWN * egWeight;
      bonus += evalColor === "black" ? proxBonus : -proxBonus;
    }
    if (whiteKingIdx >= 0) {
      const kf = whiteKingIdx % 8;
      const kr = Math.floor(whiteKingIdx / 8);
      const dist = Math.max(Math.abs(kf - pawn.file), Math.abs(kr - pawn.rank));
      const proxPenalty = Math.max(0, 7 - dist) * KING_PASSER_PROXIMITY_ENEMY * egWeight;
      bonus += evalColor === "black" ? -proxPenalty : proxPenalty;
    }
  }

  return bonus;
}

function evaluateKingTropism(
  kingIndex: number,
  enemyKnights: number[],
  enemyBishops: number[],
  enemyRooks: number[],
  enemyQueens: number[],
  kingColor: Color,
  evalColor: Color,
): number {
  if (kingIndex < 0) return 0;
  let penalty = 0;
  const kf = kingIndex % 8;
  const kr = Math.floor(kingIndex / 8);

  const addTropism = (pieces: number[], weight: number) => {
    for (const idx of pieces) {
      const f = idx % 8;
      const r = Math.floor(idx / 8);
      const dist = Math.max(Math.abs(kf - f), Math.abs(kr - r));
      if (dist <= 4) {
        penalty += (5 - dist) * weight;
      }
    }
  };

  addTropism(enemyKnights, 2);
  addTropism(enemyBishops, 2);
  addTropism(enemyRooks, 3);
  addTropism(enemyQueens, 5);

  const sign = kingColor === evalColor ? 1 : -1;
  return -penalty * sign;
}
