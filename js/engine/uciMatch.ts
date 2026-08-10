/**
 * Map UCI move strings (e2e4, e7e8q) to a legal Move from the rules engine.
 */

import type { Move, PromotionPiece } from "./types.js";

/**
 * Match a UCI move string against a list of legal moves.
 */
export function matchUciToLegalMove(uci: string, legalMoves: Move[]): Move | null {
  const s = uci.trim().toLowerCase();
  if (s === "(null)" || s === "null" || s === "0000") return null;

  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(s);
  if (!match) return null;

  const from = match[1]!;
  const to = match[2]!;
  const promChar = match[3];
  let promotion: PromotionPiece | undefined;
  if (promChar === "q") promotion = "Q";
  else if (promChar === "r") promotion = "R";
  else if (promChar === "b") promotion = "B";
  else if (promChar === "n") promotion = "N";

  const candidates = legalMoves.filter((m) => m.from === from && m.to === to);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0] ?? null;

  if (promotion) {
    const withProm = candidates.find((m) => m.promotion === promotion);
    return withProm || candidates[0] || null;
  }

  return candidates.find((m) => !m.promotion) || candidates[0] || null;
}

/**
 * Parse an engine output line like "bestmove e2e4" or "bestmove NULL".
 * @returns UCI move, null if no legal move, undefined if not a bestmove line
 */
export function parseBestMoveLine(line: string): string | null | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("bestmove ")) return undefined;
  const rest = trimmed.slice("bestmove ".length).split(/\s+/)[0];
  if (!rest || rest === "(null)" || rest.toUpperCase() === "NULL") return null;
  return rest;
}
