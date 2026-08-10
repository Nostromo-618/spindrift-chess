/**
 * Engine adapter boundary for the Spindrift built-in search (Web Worker).
 */

import { AI } from "./engine/AI.js";
import type { Color, Move, FenState, RulesState } from "./engine/types.js";
import type { WorkerFromMainMessage, WorkerToMainMessage, SearchInfo } from "./ai.worker.js";

export const ENGINE_IDS = {
  SPINDRIFT: "spindrift",
} as const;

export type EngineId = (typeof ENGINE_IDS)[keyof typeof ENGINE_IDS];

export type { SearchInfo };

export interface FindBestMoveOptions {
  difficulty?: number;
  movetime?: number;
  signal?: AbortSignal;
  onInfo?: (info: SearchInfo) => void;
  forColor?: Color;
  history?: RulesState[];
  uncapped?: boolean;
}

export interface EngineAdapter {
  findBestMove(
    gameState: FenState | { board: unknown; activeColor: Color; [key: string]: unknown },
    options?: FindBestMoveOptions,
  ): Promise<Move | null>;
  stopSearch(): void;
}

export interface SpindriftAdapterOptions {
  ai?: AI | null;
  useWorker?: boolean;
}

interface PendingSearch {
  resolve: (move: Move | null) => void;
  reject: (error: Error) => void;
  onInfo?: (info: SearchInfo) => void;
}

let spindriftWorker: Worker | null = null;
let spindriftWorkerReady = false;
let spindriftPending: PendingSearch | null = null;
let spindriftReadyPromise: Promise<void> | null = null;
let spindriftReadyResolve: (() => void) | null = null;

function toSearchState(gameState: {
  board: unknown;
  activeColor: Color;
  castlingRights: unknown;
  enPassantTarget?: string | null;
  halfmoveClock?: number;
  fullmoveNumber?: number;
}) {
  return {
    board: Array.isArray(gameState.board)
      ? gameState.board.slice()
      : Object.values(gameState.board as Record<string, unknown>),
    activeColor: gameState.activeColor,
    castlingRights: JSON.parse(JSON.stringify(gameState.castlingRights)),
    enPassantTarget: gameState.enPassantTarget || null,
    halfmoveClock: gameState.halfmoveClock || 0,
    fullmoveNumber: gameState.fullmoveNumber || 1,
  };
}

function initSpindriftWorker(): void {
  if (spindriftWorker) return;

  spindriftReadyPromise = new Promise((resolve) => {
    spindriftReadyResolve = resolve;
  });

  try {
    spindriftWorker = new Worker(new URL("./ai.worker.ts", import.meta.url), { type: "module" });
    spindriftWorker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "ready") {
        spindriftWorkerReady = true;
        spindriftReadyResolve?.();
        return;
      }
      if (data.type === "info" && spindriftPending) {
        spindriftPending.onInfo?.(data.info);
        return;
      }
      if (data.type === "result" && spindriftPending) {
        const pending = spindriftPending;
        spindriftPending = null;
        pending.resolve((data.move as Move) || null);
        return;
      }
      if (data.type === "error" && spindriftPending) {
        const pending = spindriftPending;
        spindriftPending = null;
        pending.reject(new Error(data.message || "Spindrift worker search failed"));
      }
    };
    spindriftWorker.onerror = (error) => {
      if (spindriftPending) {
        const pending = spindriftPending;
        spindriftPending = null;
        pending.reject(error instanceof Error ? error : new Error("Spindrift worker failed"));
      }
      spindriftWorker = null;
      spindriftWorkerReady = false;
    };
  } catch {
    spindriftWorker = null;
    spindriftWorkerReady = false;
  }
}

function stopSpindriftWorkerSearch(): void {
  if (!spindriftWorker) return;
  if (spindriftPending) {
    const pending = spindriftPending;
    spindriftPending = null;
    pending.resolve(null);
  }
  spindriftWorker.terminate();
  spindriftWorker = null;
  spindriftWorkerReady = false;
}

export class SpindriftAdapter implements EngineAdapter {
  ai: AI;
  useWorker: boolean;

  constructor({ ai = null, useWorker = true }: SpindriftAdapterOptions = {}) {
    this.ai = ai || new AI();
    this.useWorker = useWorker;
    if (this.useWorker) initSpindriftWorker();
  }

  async findBestMove(
    gameState: {
      board: unknown;
      activeColor: Color;
      castlingRights: unknown;
      enPassantTarget?: string | null;
      halfmoveClock?: number;
      fullmoveNumber?: number;
    },
    {
      difficulty = 6,
      movetime = 10000,
      signal,
      onInfo,
      forColor,
      history,
      uncapped = false,
    }: FindBestMoveOptions = {},
  ): Promise<Move | null> {
    if (signal?.aborted) return null;

    const state = toSearchState(gameState);
    const color = forColor || state.activeColor;
    const timeout = Math.max(50, Number(movetime) || 10000);

    // Wait briefly for the worker to finish loading rather than running the very
    // first (often heaviest) search synchronously on the main thread.
    if (this.useWorker) {
      if (!spindriftWorker) initSpindriftWorker();
      if (!spindriftWorkerReady && spindriftReadyPromise) {
        await Promise.race([spindriftReadyPromise, new Promise<void>((r) => setTimeout(r, 1500))]);
      }
    }

    if (this.useWorker && spindriftWorker && spindriftWorkerReady && !spindriftPending) {
      return new Promise((resolve, reject) => {
        const abort = () => {
          stopSpindriftWorkerSearch();
          resolve(null);
        };
        if (signal) signal.addEventListener("abort", abort, { once: true });

        spindriftPending = {
          resolve: (move) => {
            if (signal) signal.removeEventListener("abort", abort);
            resolve(move);
          },
          reject: (error) => {
            if (signal) signal.removeEventListener("abort", abort);
            reject(error);
          },
          onInfo,
        };

        const message: WorkerFromMainMessage = {
          type: "search",
          state,
          level: difficulty,
          forColor: color,
          timeout,
          history,
          uncapped,
        };
        spindriftWorker!.postMessage(message);
      });
    }

    const move = await this.ai.findBestMove(state, {
      level: difficulty,
      forColor: color,
      timeout,
      signal,
      onInfo,
      history,
      uncapped,
    });
    return signal?.aborted ? null : (move as Move | null);
  }

  stopSearch(): void {
    stopSpindriftWorkerSearch();
  }
}

/** Always returns the Spindrift adapter (`engineId` is ignored). */
export function createEngineAdapter(
  _engineId?: string,
  options: SpindriftAdapterOptions = {},
): SpindriftAdapter {
  return new SpindriftAdapter(options);
}

export function getEngineDisplayName(_engineId?: string): string {
  return "Spindrift Engine";
}

export function getEngineStrengthLabel(_engineId: string | undefined, difficulty: number): string {
  const level = Math.max(1, Math.min(6, Number(difficulty) || 3));
  return `level ${level}`;
}

export function getEngineStrengthControlLabel(_engineId?: string): string {
  return "Spindrift strength";
}
