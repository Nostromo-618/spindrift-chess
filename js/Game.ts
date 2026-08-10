import { GameState } from "./engine/GameState.js";
import { AI } from "./engine/AI.js";
import { generateLegalMoves, getCheckedKingSquare as kingSquareIfInCheck } from "./engine/Rules.js";
import {
  createEngineAdapter,
  ENGINE_IDS,
  type SpindriftAdapter,
  type SearchInfo,
} from "./engineAdapter.js";
import { MIN_THINK_TIME_MS, MAX_THINK_TIME_MS } from "./storage.js";
import type {
  Color,
  Move,
  PromotionPiece,
  GameSnapshot,
  LastMoveSquares,
  Square,
} from "./engine/types.js";

export type { Color, Move, PromotionPiece, GameSnapshot };
export type ColorChoice = Color | "random";

export interface MoveResult {
  success: boolean;
  move?: Move;
  error?: string;
}

export interface PlayerSelectionResult {
  changed: boolean;
  selected: Square | null;
  legalTargets: Square[];
  lastMove: LastMoveSquares | null;
}

export interface GameOptions {
  playerColor: ColorChoice;
  difficulty?: number;
  uncapped?: boolean;
  thinkTimeMs?: number;
  onUpdate?: (snapshot: GameSnapshot) => void;
}

export interface FromSavedOptions {
  difficulty?: number;
  uncapped?: boolean;
  thinkTimeMs?: number;
  onUpdate?: (snapshot: GameSnapshot) => void;
}

export interface ComputeAIMoveOptions {
  signal?: AbortSignal;
  onInfo?: (info: SearchInfo) => void;
  movetime?: number;
}

/**
 * Game.ts
 *
 * Orchestrates GameState (rules engine) with UI-facing callbacks.
 * Always uses the Spindrift engine adapter (Web Worker when available).
 */
export class Game {
  ai: AI;
  spindriftAdapter: SpindriftAdapter;
  onUpdate: (snapshot: GameSnapshot) => void;
  state: GameState;
  difficulty!: number;
  aiMoveTimeMs: number;
  /** When true, search uses uncapped depth (time-bound). */
  uncapped: boolean;

  constructor({ playerColor, difficulty, uncapped, thinkTimeMs, onUpdate }: GameOptions) {
    this.ai = new AI();
    this.spindriftAdapter = createEngineAdapter(ENGINE_IDS.SPINDRIFT, {
      ai: this.ai,
      useWorker: true,
    });
    this.onUpdate = onUpdate || (() => {});

    const resolvedPlayerColor: Color =
      playerColor === "white" || playerColor === "black"
        ? playerColor
        : Math.random() < 0.5
          ? "white"
          : "black";

    this.state = GameState.createStarting(resolvedPlayerColor);

    this.setDifficulty(difficulty || 6);
    this.uncapped = Boolean(uncapped);
    this.aiMoveTimeMs =
      typeof thinkTimeMs === "number" && Number.isFinite(thinkTimeMs) ? thinkTimeMs : 10000;
    this.notify();
  }

  /**
   * Restore a game from previously serialized state (e.g. localStorage).
   */
  static fromSaved(
    serialized: ConstructorParameters<typeof GameState>[0],
    { difficulty, uncapped, thinkTimeMs, onUpdate }: FromSavedOptions = {},
  ): Game {
    const instance = Object.create(Game.prototype) as Game;
    instance.ai = new AI();
    instance.spindriftAdapter = createEngineAdapter(ENGINE_IDS.SPINDRIFT, {
      ai: instance.ai,
      useWorker: true,
    });
    instance.onUpdate = onUpdate || (() => {});
    instance.state = new GameState(serialized);
    instance.setDifficulty(
      difficulty || (serialized as { difficulty?: number } | null)?.difficulty || 6,
    );
    instance.uncapped = Boolean(uncapped);
    instance.aiMoveTimeMs =
      typeof thinkTimeMs === "number" && Number.isFinite(thinkTimeMs) ? thinkTimeMs : 10000;
    instance.state.updateStatusText();
    instance.notify();
    return instance;
  }

  setDifficulty(level: number): void {
    const clamped = Math.max(1, Math.min(6, Number(level) || 6));
    this.difficulty = clamped;
  }

  setUncapped(on: boolean): void {
    this.uncapped = Boolean(on);
  }

  setThinkTimeMs(ms: number): void {
    const n = Number(ms);
    if (!Number.isFinite(n)) return;
    this.aiMoveTimeMs = Math.max(MIN_THINK_TIME_MS, Math.min(MAX_THINK_TIME_MS, Math.round(n)));
  }

  /**
   * Per-move time budget (ms) for human play, by difficulty. Levels 1–3 finish
   * at their tiny fixed depth well within any budget (kept snappy/CPU-light);
   * levels 4–6 deepen to fill their budget. Uncapped mode always uses
   * `aiMoveTimeMs`.
   */
  moveTimeForDifficulty(): number {
    if (this.uncapped) return this.aiMoveTimeMs;
    switch (this.difficulty) {
      case 1:
        return 400;
      case 2:
        return 700;
      case 3:
        return 1200;
      case 4:
        return 1500;
      case 5:
        return 4000;
      case 6:
        return this.aiMoveTimeMs;
      default:
        return this.aiMoveTimeMs;
    }
  }

  getBoard(): ReturnType<GameState["getBoardMap"]> {
    return this.state.getBoardMap();
  }

  getCheckedKingSquare(): Square | null {
    return kingSquareIfInCheck(this.state.asRulesState());
  }

  getPlayerColor(): Color {
    return this.state.playerColor;
  }

  getCurrentTurn(): Color {
    return this.state.activeColor;
  }

  isGameOver(): boolean {
    return this.state.isGameOver();
  }

  getGameState(): ReturnType<GameState["serialize"]> {
    return this.state.serialize();
  }

  getSnapshot(): GameSnapshot {
    return this.state.getSnapshot();
  }

  getLegalMovesForSquare(square: Square): Square[] {
    if (this.isGameOver()) return [];
    const allLegal = generateLegalMoves(this.state.asRulesState());
    return allLegal.filter((m) => m.from === square).map((m) => m.to);
  }

  isPromotionMove(from: Square, to: Square): boolean {
    if (this.isGameOver()) return false;
    const allLegal = generateLegalMoves(this.state.asRulesState());
    return allLegal.some((m) => m.from === from && m.to === to && !!m.promotion);
  }

  handlePlayerSquareSelection(
    square: Square,
    promotionChoice: PromotionPiece = "Q",
  ): PlayerSelectionResult {
    if (this.isGameOver()) {
      return {
        changed: false,
        selected: null,
        legalTargets: [],
        lastMove: this.state.lastMove,
      };
    }

    const color = this.getPlayerColor();
    const result = this.state.handleSelection(square, color, promotionChoice);
    if (result.moved) {
      this.notify();
    }
    return {
      changed: result.moved,
      selected: result.selectedSquare,
      legalTargets: result.legalTargets,
      lastMove: this.state.lastMove,
    };
  }

  handlePlayerMove(move: Pick<Move, "from" | "to"> & { promotion?: PromotionPiece }): MoveResult {
    if (this.isGameOver()) {
      return { success: false, error: "Game is over" };
    }

    if (this.getCurrentTurn() !== this.getPlayerColor()) {
      return { success: false, error: "Not your turn" };
    }

    const legalMoves = generateLegalMoves(this.state.asRulesState());
    const validMove = legalMoves.find(
      (m) =>
        m.from === move.from &&
        m.to === move.to &&
        (!move.promotion || m.promotion === move.promotion),
    );

    if (!validMove) {
      return { success: false, error: "Illegal move" };
    }

    this.state.applyMove(validMove);
    this.notify();
    return { success: true, move: validMove };
  }

  /** Apply a legal engine move for the current side to move. */
  handleEngineMove(move: Pick<Move, "from" | "to"> & { promotion?: PromotionPiece }): MoveResult {
    if (this.isGameOver()) {
      return { success: false, error: "Game is over" };
    }

    const legalMoves = generateLegalMoves(this.state.asRulesState());
    const validMove = legalMoves.find(
      (m) =>
        m.from === move.from &&
        m.to === move.to &&
        (!move.promotion || m.promotion === move.promotion),
    );

    if (!validMove) {
      return { success: false, error: "Illegal move" };
    }

    this.state.applyMove(validMove);
    this.notify();
    return { success: true, move: validMove };
  }

  /**
   * Whether an undo is currently meaningful and safe:
   * - the human has made at least one move (undo never reverts the computer's
   *   opening move when the human plays black), and
   * - the whole history is replayable long algebraic (legacy SAN saves are not).
   */
  canUndo(): boolean {
    const pliesPlayed = this.state.moveHistory.length;
    const minPlies = this.getPlayerColor() === "white" ? 1 : 2;
    if (pliesPlayed < minPlies) return false;
    return this.state.undoSupported();
  }

  /**
   * Take back the human's last move together with any computer replies after
   * it, so it is the human's turn again.
   * @returns number of half-moves undone (0 if undo was not possible)
   */
  undoToPlayerTurn(): number {
    if (!this.canUndo()) return 0;
    let undone = 0;
    do {
      if (!this.state.undoOnePly()) break;
      undone += 1;
    } while (this.state.moveHistory.length && this.state.activeColor !== this.getPlayerColor());
    if (undone > 0) this.notify();
    return undone;
  }

  /** Ask Spindrift to compute best move given current state and difficulty. */
  async computeAIMove({
    signal,
    onInfo,
    movetime,
  }: ComputeAIMoveOptions = {}): Promise<Move | null> {
    if (this.isGameOver()) return null;
    const aiColor = this.getCurrentTurn();
    const timeout = movetime || this.moveTimeForDifficulty();
    const opts = {
      difficulty: this.difficulty,
      movetime: timeout,
      signal,
      onInfo,
      forColor: aiColor,
      uncapped: this.uncapped,
      // Positions since the last irreversible move, so the search can detect a
      // repetition draw across played moves (not just within its own tree).
      history: this.state.getReversibleHistory(),
    };

    return this.spindriftAdapter.findBestMove(this.state, opts);
  }

  applyAIMove(move: Move | null | undefined): void {
    if (!move) return;
    this.state.applyMove(move);
    this.notify();
  }

  notify(): void {
    this.state.updateStatusText();
    this.onUpdate(this.state.getSnapshot());
  }
}
