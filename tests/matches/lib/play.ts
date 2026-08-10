/**
 * Play one complete Spindrift-vs-Spindrift game.
 */
import type { Color, Move, Board } from "../../../js/engine/types.js";
import type { GameState } from "../../../js/engine/GameState.js";
import type * as RulesNS from "../../../js/engine/Rules.js";

export interface EngineBuild {
  GameState: {
    createStarting: (color: Color) => GameState;
    new (data: unknown): GameState;
  };
  Rules: typeof RulesNS;
  AI: new () => {
    findBestMove: (
      serialized: ReturnType<GameState["serialize"]>,
      opts: {
        level: number;
        forColor: Color;
        timeout: number;
        history: unknown[];
      },
    ) => Promise<Move | null>;
    getLastSearchInfo: () => {
      bestScore?: number;
      depthCompleted?: number;
      nodes?: number;
      qNodes?: number;
    };
  };
}

export interface Player {
  name: string;
  findBestMove: (
    serialized: ReturnType<GameState["serialize"]>,
    opts: {
      level: number;
      forColor: Color;
      timeout: number;
      history: unknown[];
    },
  ) => Promise<{
    move: Move | null;
    score: number;
    depth?: number;
    nodes?: number;
  }>;
}

export interface PlayResult {
  winner: Color | null;
  reason: string;
  plies: number;
  moves: string[];
}

function snapshot(serialized: ReturnType<GameState["serialize"]>) {
  return {
    board: (Array.isArray(serialized.board) ? serialized.board : []).slice(),
    activeColor: serialized.activeColor,
    castlingRights: structuredClone(serialized.castlingRights),
    enPassantTarget: serialized.enPassantTarget || null,
  };
}

function isIrreversible(gs: GameState, move: Move): boolean {
  const piece = gs.getPiece(move.from);
  return !!(
    move.captured ||
    move.isEnPassant ||
    move.isCastleKingSide ||
    move.isCastleQueenSide ||
    (piece && piece[1] === "P")
  );
}

function opposite(c: Color): Color {
  return c === "white" ? "black" : "white";
}

const VAL: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

function materialBalance(board: Board): number {
  let s = 0;
  for (const p of board) {
    if (!p) continue;
    const v = VAL[p[1]!] ?? 0;
    s += p[0] === "w" ? v : -v;
  }
  return s;
}

export async function playGame(opts: {
  driver: { GameState: EngineBuild["GameState"]; Rules: EngineBuild["Rules"] };
  white: Player;
  black: Player;
  level: number;
  movetime: number;
  maxPlies?: number;
  resignScore?: number;
  resignStreak?: number;
}): Promise<PlayResult> {
  const {
    driver,
    white,
    black,
    level,
    movetime,
    maxPlies = 400,
    resignScore = 2000,
    resignStreak = 6,
  } = opts;
  const { GameState, Rules } = driver;
  const gs = GameState.createStarting("white");
  const players = { white, black };

  let sinceIrrev: ReturnType<typeof snapshot>[] = [];
  const lowStreak: Record<Color, number> = { white: 0, black: 0 };
  const moves: string[] = [];
  let plies = 0;

  while (!gs.isGameOver() && plies < maxPlies) {
    const mover = gs.activeColor;
    const player = players[mover];
    const serialized = gs.serialize();
    const history = sinceIrrev.slice();

    let res: Awaited<ReturnType<Player["findBestMove"]>>;
    try {
      res = await player.findBestMove(serialized, {
        level,
        forColor: mover,
        timeout: movetime,
        history,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        winner: opposite(mover),
        reason: `${player.name} threw: ${message}`,
        plies,
        moves,
      };
    }

    const suggested = res.move;
    const legal = Rules.generateLegalMoves(gs.asRulesState());
    if (legal.length === 0) break;

    let chosen: Move | null = null;
    if (suggested) {
      const p = suggested.promotion ?? null;
      chosen =
        legal.find(
          (m) => m.from === suggested.from && m.to === suggested.to && (m.promotion ?? null) === p,
        ) ??
        legal.find((m) => m.from === suggested.from && m.to === suggested.to) ??
        null;
    }
    if (!chosen) {
      return {
        winner: opposite(mover),
        reason: `${player.name} returned no legal move`,
        plies,
        moves,
      };
    }

    sinceIrrev.push(snapshot(serialized));
    const irreversible = isIrreversible(gs, chosen);
    gs.applyMove(chosen);
    moves.push(`${chosen.from}${chosen.to}${chosen.promotion ?? ""}`);
    plies += 1;
    if (irreversible) sinceIrrev = [];

    const score = typeof res.score === "number" ? res.score : 0;
    if (score <= -resignScore) lowStreak[mover] += 1;
    else lowStreak[mover] = 0;
    if (lowStreak[mover]! >= resignStreak) {
      return {
        winner: opposite(mover),
        reason: `${mover} resigns (eval ${score})`,
        plies,
        moves,
      };
    }
  }

  if (gs.isGameOver()) {
    const r = gs.result;
    if (r?.outcome === "checkmate") {
      return { winner: (r.winner as Color) ?? null, reason: "checkmate", plies, moves };
    }
    return {
      winner: null,
      reason: r?.reason || r?.outcome || "draw",
      plies,
      moves,
    };
  }

  const mat = materialBalance(gs.board as Board);
  if (mat >= 300) {
    return { winner: "white", reason: `adjudicated +${mat}cp @plycap`, plies, moves };
  }
  if (mat <= -300) {
    return { winner: "black", reason: `adjudicated ${mat}cp @plycap`, plies, moves };
  }
  return { winner: null, reason: "adjudicated draw @plycap", plies, moves };
}

export function makePlayer(build: EngineBuild, label: string): Player {
  const ai = new build.AI();
  return {
    name: label,
    async findBestMove(serialized, opts) {
      const move = await ai.findBestMove(serialized, opts);
      const info = ai.getLastSearchInfo();
      return {
        move,
        score: info.bestScore ?? 0,
        depth: info.depthCompleted,
        nodes: (info.nodes ?? 0) + (info.qNodes ?? 0),
      };
    },
  };
}
