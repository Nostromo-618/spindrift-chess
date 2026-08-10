/**
 * ai.worker.ts — Spindrift Engine search off the main thread.
 */

import { AI, type SearchInfo } from "./engine/AI.js";
import type { Board, BoardSquare, Color, Move, RulesState } from "./engine/types.js";

export type { SearchInfo };

export interface WorkerSearchState {
  board: Board | Record<string, BoardSquare>;
  activeColor: Color;
  castlingRights: RulesState["castlingRights"];
  enPassantTarget?: string | null;
  halfmoveClock?: number;
  fullmoveNumber?: number;
}

export type WorkerFromMainMessage =
  | {
      type: "search";
      state: WorkerSearchState;
      level?: number;
      forColor?: Color;
      timeout?: number;
      history?: RulesState[];
      uncapped?: boolean;
    }
  | { type: "stop" };

export type WorkerToMainMessage =
  | { type: "ready" }
  | { type: "result"; move: Move | null; info?: SearchInfo }
  | { type: "info"; info: SearchInfo }
  | { type: "error"; message: string };

interface AbortFlag {
  aborted: boolean;
}

const ai = new AI();
let activeSignal: AbortFlag | null = null;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerFromMainMessage>) => {
  const data = event.data;
  const type = data?.type;

  if (type === "stop") {
    if (activeSignal) activeSignal.aborted = true;
    return;
  }

  if (type !== "search") {
    ctx.postMessage({
      type: "error",
      message: `Unknown message type: ${String(type)}`,
    } satisfies WorkerToMainMessage);
    return;
  }

  const { state, level, forColor, timeout, history, uncapped } = data;

  try {
    if (!state?.board) {
      throw new Error("Worker received state without board");
    }

    const board: Board = (
      Array.isArray(state.board) ? state.board.slice() : Object.values(state.board)
    ) as Board;

    if (board.length !== 64) {
      throw new Error(`Worker received board with ${board.length} elements, expected 64`);
    }

    const searchState: RulesState & {
      halfmoveClock: number;
      fullmoveNumber: number;
    } = {
      board,
      activeColor: state.activeColor,
      castlingRights: state.castlingRights,
      enPassantTarget: state.enPassantTarget ?? null,
      halfmoveClock: state.halfmoveClock ?? 0,
      fullmoveNumber: state.fullmoveNumber ?? 1,
    };

    const signal: AbortFlag = { aborted: false };
    activeSignal = signal;
    let move: Move | null;
    try {
      move = await ai.findBestMove(searchState, {
        level,
        forColor,
        timeout: timeout || 10000,
        history: Array.isArray(history) ? history : [],
        uncapped: !!uncapped,
        signal,
        onInfo: (info) => {
          ctx.postMessage({ type: "info", info } satisfies WorkerToMainMessage);
        },
      });
    } finally {
      if (activeSignal === signal) activeSignal = null;
    }

    ctx.postMessage({
      type: "result",
      move,
      info: ai.getLastSearchInfo(),
    } satisfies WorkerToMainMessage);
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    const errorMessage = err.stack
      ? `${err.message}\n${err.stack}`
      : err.message || "Spindrift AI search failed";
    ctx.postMessage({ type: "error", message: errorMessage } satisfies WorkerToMainMessage);
  }
};

ctx.postMessage({ type: "ready" } satisfies WorkerToMainMessage);
